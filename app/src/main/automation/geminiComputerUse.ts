import { BrowserWindow, WebContents } from 'electron'
import { BrowserAutomationController } from './controller'

export type GeminiComputerUseConfig = {
  apiKey: string
  maxTurns?: number
  screenWidth?: number
  screenHeight?: number
}

export type GeminiFunctionCall = {
  name: string
  args: Record<string, any>
}

export type GeminiSafetyDecision = {
  decision: 'regular' | 'require_confirmation'
  explanation?: string
}

export type GeminiResponse = {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string
        function_call?: GeminiFunctionCall
      }>
    }
    safetyDecision?: GeminiSafetyDecision
  }>
}

/**
 * Gemini 2.5 Computer Use Agent
 *
 * Implements the official Gemini Computer Use pattern:
 * 1. Capture screenshot
 * 2. Send to Gemini model with Computer Use tool
 * 3. Receive function_call actions
 * 4. Execute actions locally
 * 5. Capture new screenshot and repeat
 */
export class GeminiComputerUseAgent {
  private controller: BrowserAutomationController
  private apiKey: string
  private maxTurns: number
  private screenWidth: number
  private screenHeight: number
  private conversationHistory: any[] = []

  constructor(config: GeminiComputerUseConfig) {
    this.controller = new BrowserAutomationController()
    this.apiKey = config.apiKey
    this.maxTurns = config.maxTurns || 10
    this.screenWidth = config.screenWidth || 1440
    this.screenHeight = config.screenHeight || 900
  }

  /**
   * Set the target browser window/webContents
   */
  setTarget(window: BrowserWindow, webContents?: WebContents) {
    this.controller.setTarget(window, webContents)
  }

  /**
   * Execute a task using Gemini Computer Use
   * @param goal User's goal/task description
   * @returns Final response text
   */
  async executeTask(goal: string): Promise<string> {
    console.log('[Gemini Computer Use] Starting task:', goal)

    // Reset conversation history
    this.conversationHistory = []

    // Capture initial screenshot
    const initialScreenshot = await this.captureScreenshot()

    // Add user message with goal and screenshot
    this.conversationHistory.push({
      role: 'user',
      parts: [
        { text: goal },
        {
          inline_data: {
            mime_type: 'image/png',
            data: initialScreenshot
          }
        }
      ]
    })

    // Agent loop
    for (let turn = 0; turn < this.maxTurns; turn++) {
      console.log(`[Gemini Computer Use] Turn ${turn + 1}/${this.maxTurns}`)

      try {
        // Send request to Gemini
        const response = await this.sendToGemini()

        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates in response')
        }

        const candidate = response.candidates[0]

        // Add assistant response to history
        this.conversationHistory.push({
          role: 'model',
          parts: candidate.content.parts
        })

        // Check if task is complete (no function calls)
        const hasFunctionCalls = candidate.content.parts.some((part) => part.function_call)

        if (!hasFunctionCalls) {
          // Task complete - extract final text response
          const textParts = candidate.content.parts
            .filter((part) => part.text)
            .map((part) => part.text)
            .join('\n')

          console.log('[Gemini Computer Use] Task completed')
          return textParts
        }

        // Execute function calls
        const functionResults = await this.executeFunctionCalls(candidate.content.parts)

        // Capture new screenshot after execution
        const newScreenshot = await this.captureScreenshot()

        // Build function response parts
        const functionResponseParts = functionResults.map((result) => ({
          function_response: {
            name: result.name,
            response: {
              ...result.response,
              screenshot: {
                inline_data: {
                  mime_type: 'image/png',
                  data: newScreenshot
                }
              }
            }
          }
        }))

        // Add function responses to history
        this.conversationHistory.push({
          role: 'user',
          parts: functionResponseParts
        })
      } catch (error) {
        console.error('[Gemini Computer Use] Error in turn', turn, error)
        throw error
      }
    }

    return 'Task exceeded maximum number of turns'
  }

  /**
   * Send current conversation to Gemini API
   */
  private async sendToGemini(): Promise<GeminiResponse> {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-computer-use-preview-10-2025:generateContent'

    const requestBody = {
      contents: this.conversationHistory,
      generationConfig: {
        tools: [
          {
            computer_use: {
              environment: 'ENVIRONMENT_BROWSER'
            }
          }
        ]
      }
    }

    const response = await fetch(`${url}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Execute all function calls from the model response
   */
  private async executeFunctionCalls(
    parts: any[]
  ): Promise<Array<{ name: string; response: any }>> {
    const results: Array<{ name: string; response: any }> = []

    for (const part of parts) {
      if (!part.function_call) continue

      const functionCall = part.function_call
      console.log(`[Gemini Computer Use] Executing: ${functionCall.name}`, functionCall.args)

      try {
        const result = await this.executeFunction(functionCall)
        results.push({
          name: functionCall.name,
          response: result
        })
      } catch (error) {
        console.error(`[Gemini Computer Use] Error executing ${functionCall.name}:`, error)
        results.push({
          name: functionCall.name,
          response: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }

    return results
  }

  /**
   * Execute a single function call
   * Translates Gemini function calls to BrowserAutomationController commands
   */
  private async executeFunction(functionCall: GeminiFunctionCall): Promise<any> {
    const { name, args } = functionCall

    // Convert normalized coordinates (0-1000) to pixel coordinates
    const denormalizeX = (x: number) => Math.round((x / 1000) * this.screenWidth)
    const denormalizeY = (y: number) => Math.round((y / 1000) * this.screenHeight)

    switch (name) {
      case 'open_web_browser':
        // Browser already open
        return { success: true }

      case 'navigate':
        return this.controller.executeCommand({
          type: 'open_url',
          url: args.url
        })

      case 'click_at':
        const clickX = denormalizeX(args.x)
        const clickY = denormalizeY(args.y)
        return this.controller.executeCommand({
          type: 'click',
          x: clickX,
          y: clickY
        })

      case 'type_text_at':
        const typeX = denormalizeX(args.x)
        const typeY = denormalizeY(args.y)
        return this.controller.executeCommand({
          type: 'type',
          text: args.text,
          x: typeX,
          y: typeY,
          pressEnter: args.press_enter !== false // Default true
        })

      case 'scroll_document':
        return this.controller.executeCommand({
          type: 'scroll',
          direction: args.direction === 'down' ? 'down' : 'up'
        })

      case 'wait_5_seconds':
        return this.controller.executeCommand({
          type: 'wait',
          ms: 5000
        })

      case 'go_back':
        return this.controller.executeCommand({
          type: 'go_back'
        })

      case 'go_forward':
        return this.controller.executeCommand({
          type: 'go_forward'
        })

      case 'search':
        return this.controller.executeCommand({
          type: 'open_url',
          url: 'https://www.google.com'
        })

      default:
        return {
          success: false,
          error: `Unknown function: ${name}`
        }
    }
  }

  /**
   * Capture screenshot from current browser state
   */
  private async captureScreenshot(): Promise<string> {
    const result = await this.controller.executeCommand({
      type: 'screenshot',
      fullPage: false
    })

    if (!result.success || !result.screenshot) {
      throw new Error('Failed to capture screenshot')
    }

    // Remove data URL prefix to get just the base64 data
    return result.screenshot.replace(/^data:image\/png;base64,/, '')
  }

  /**
   * Reset the agent state
   */
  reset() {
    this.conversationHistory = []
    this.controller.reset()
  }
}
