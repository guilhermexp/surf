import { BrowserWindow, WebContents } from 'electron'

export type AutomationCommand =
  | { type: 'open_url'; url: string }
  | { type: 'click'; selector?: string; x?: number; y?: number }
  | { type: 'type'; selector?: string; text: string; x?: number; y?: number; pressEnter?: boolean }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'screenshot'; fullPage?: boolean }
  | { type: 'get_text'; selector: string }
  | { type: 'wait'; ms: number }
  | { type: 'go_back' }
  | { type: 'go_forward' }

export type AutomationResult = {
  success: boolean
  data?: any
  error?: string
  screenshot?: string
}

export type AutomationPermission = 'granted' | 'denied' | 'pending'

export class BrowserAutomationController {
  private window: BrowserWindow | null = null
  private webContents: WebContents | null = null
  private permission: AutomationPermission = 'pending'
  private commandLog: Array<{
    command: AutomationCommand
    timestamp: number
    result: AutomationResult
  }> = []

  constructor(private maxLogSize: number = 100) {}

  setTarget(window: BrowserWindow, webContents?: WebContents) {
    this.window = window
    this.webContents = webContents || window.webContents
  }

  requestPermission(callback: (permission: AutomationPermission) => void) {
    // In a real implementation, this would show a dialog to the user
    // For now, we'll auto-grant for development
    this.permission = 'granted'
    callback(this.permission)
  }

  getPermission(): AutomationPermission {
    return this.permission
  }

  async executeCommand(command: AutomationCommand): Promise<AutomationResult> {
    if (this.permission !== 'granted') {
      return {
        success: false,
        error: 'Automation permission not granted'
      }
    }

    if (!this.webContents) {
      return {
        success: false,
        error: 'No target webContents set'
      }
    }

    const timestamp = Date.now()
    let result: AutomationResult

    try {
      switch (command.type) {
        case 'open_url':
          result = await this.executeOpenUrl(command.url)
          break

        case 'click':
          result = await this.executeClick(command.selector, command.x, command.y)
          break

        case 'type':
          result = await this.executeType(
            command.selector,
            command.text,
            command.x,
            command.y,
            command.pressEnter
          )
          break

        case 'scroll':
          result = await this.executeScroll(command.direction, command.amount)
          break

        case 'screenshot':
          result = await this.executeScreenshot(command.fullPage)
          break

        case 'get_text':
          result = await this.executeGetText(command.selector)
          break

        case 'wait':
          result = await this.executeWait(command.ms)
          break

        case 'go_back':
          result = await this.executeGoBack()
          break

        case 'go_forward':
          result = await this.executeGoForward()
          break

        default:
          result = {
            success: false,
            error: `Unknown command type: ${(command as any).type}`
          }
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    this.logCommand(command, timestamp, result)
    return result
  }

  private async executeOpenUrl(url: string): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    await this.webContents.loadURL(url)

    // Wait for page to load
    await new Promise<void>((resolve) => {
      const handler = () => {
        this.webContents?.off('did-finish-load', handler)
        resolve()
      }
      this.webContents?.on('did-finish-load', handler)
    })

    return {
      success: true,
      data: { url }
    }
  }

  private async executeClick(selector?: string, x?: number, y?: number): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    // If coordinates provided, click at coordinates
    if (x !== undefined && y !== undefined) {
      const result = await this.webContents.executeJavaScript(`
        (function() {
          const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: ${x},
            clientY: ${y}
          });
          const element = document.elementFromPoint(${x}, ${y});
          if (element) {
            element.dispatchEvent(event);
            return { success: true, data: { x: ${x}, y: ${y} } };
          }
          return { success: false, error: 'No element at coordinates' };
        })()
      `)
      return result
    }

    // Otherwise use selector
    if (!selector) {
      return { success: false, error: 'Either selector or coordinates required' }
    }

    const result = await this.webContents.executeJavaScript(`
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!element) {
          return { success: false, error: 'Element not found' };
        }
        element.click();
        return { success: true };
      })()
    `)

    return result
  }

  private async executeType(
    selector?: string,
    text?: string,
    x?: number,
    y?: number,
    pressEnter?: boolean
  ): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    if (!text) {
      return { success: false, error: 'Text is required' }
    }

    // If coordinates provided, click at coordinates first then type
    if (x !== undefined && y !== undefined) {
      // Click to focus
      await this.executeClick(undefined, x, y)

      // Clear existing text (Ctrl+A, Backspace)
      await this.webContents.executeJavaScript(`
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      `)

      // Type the text character by character
      for (const char of text) {
        await this.webContents.executeJavaScript(`
          (function() {
            const element = document.activeElement;
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              element.value += '${char.replace(/'/g, "\\'")}';
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
          })()
        `)
      }

      // Press Enter if requested
      if (pressEnter) {
        await this.webContents.executeJavaScript(`
          document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        `)
      }

      return { success: true, data: { text, x, y, pressEnter } }
    }

    // Otherwise use selector
    if (!selector) {
      return { success: false, error: 'Either selector or coordinates required' }
    }

    const result = await this.webContents.executeJavaScript(`
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!element) {
          return { success: false, error: 'Element not found' };
        }
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.value = '${text.replace(/'/g, "\\'")}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.textContent = '${text.replace(/'/g, "\\'")}';
        }
        ${pressEnter ? `element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));` : ''}
        return { success: true };
      })()
    `)

    return result
  }

  private async executeScroll(
    direction: 'up' | 'down',
    amount?: number
  ): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    const scrollAmount = amount || (direction === 'down' ? 500 : -500)

    await this.webContents.executeJavaScript(`
      window.scrollBy(0, ${scrollAmount});
    `)

    return {
      success: true,
      data: { direction, amount: scrollAmount }
    }
  }

  private async executeScreenshot(fullPage?: boolean): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    const image = await this.webContents.capturePage()
    const dataUrl = image.toDataURL()

    return {
      success: true,
      data: { screenshot: dataUrl },
      screenshot: dataUrl
    }
  }

  private async executeGetText(selector: string): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    const result = await this.webContents.executeJavaScript(`
      (function() {
        const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
        if (!element) {
          return { success: false, error: 'Element not found' };
        }
        return { success: true, data: { text: element.textContent || element.innerText } };
      })()
    `)

    return result
  }

  private async executeWait(ms: number): Promise<AutomationResult> {
    await new Promise((resolve) => setTimeout(resolve, ms))
    return {
      success: true,
      data: { waited: ms }
    }
  }

  private async executeGoBack(): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    if (this.webContents.canGoBack()) {
      this.webContents.goBack()
      return { success: true }
    }

    return { success: false, error: 'Cannot go back' }
  }

  private async executeGoForward(): Promise<AutomationResult> {
    if (!this.webContents) {
      return { success: false, error: 'No webContents' }
    }

    if (this.webContents.canGoForward()) {
      this.webContents.goForward()
      return { success: true }
    }

    return { success: false, error: 'Cannot go forward' }
  }

  private logCommand(command: AutomationCommand, timestamp: number, result: AutomationResult) {
    this.commandLog.push({ command, timestamp, result })

    // Keep log size under limit
    if (this.commandLog.length > this.maxLogSize) {
      this.commandLog = this.commandLog.slice(-this.maxLogSize)
    }
  }

  getCommandLog() {
    return this.commandLog
  }

  clearCommandLog() {
    this.commandLog = []
  }

  reset() {
    this.permission = 'pending'
    this.commandLog = []
    this.window = null
    this.webContents = null
  }
}

// Singleton instance
export const browserAutomation = new BrowserAutomationController()
