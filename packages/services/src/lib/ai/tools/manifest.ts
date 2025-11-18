import type { AITool } from '@deta/types'
import type { SFFS } from '../../sffs'

export type ToolHandler = (...args: any[]) => Promise<any> | any

type ManifestUI = {
  id: string
  name: string
  icon: string
  active?: boolean
  disabled?: boolean
}

export type ToolManifestEntry = {
  backendId?: string
  handler?: ToolHandler
  description?: string
  ui?: ManifestUI
}

export const TOOL_IDS = {
  WEB_SEARCH_DONE_CALLBACK: 'web_search_done_callback',
  SCRAPE_URL: 'scrape_url',
  SURFLET_DONE_CALLBACK: 'surflet_done_callback',
  IMAGE_GENERATE: 'image_generate',
  VIDEO_GENERATE: 'video_generate',
  BROWSER_CONTROL: 'browser_control'
} as const

const noopHandler: ToolHandler = async (...args: any[]) => {
  console.warn('[AI Tools] handler invoked without implementation', args)
  return null
}

const DUCKDUCKGO_ENDPOINT = 'https://api.duckduckgo.com/'
const DEFAULT_SEARCH_LIMIT = 5

type DuckDuckGoTopic = {
  Text?: string
  FirstURL?: string
  Name?: string
  Topics?: DuckDuckGoTopic[]
}

const flattenTopics = (
  topics: DuckDuckGoTopic[],
  acc: DuckDuckGoTopic[] = []
): DuckDuckGoTopic[] => {
  for (const topic of topics) {
    if (Array.isArray(topic.Topics)) {
      flattenTopics(topic.Topics, acc)
    } else {
      acc.push(topic)
    }
  }
  return acc
}

const webSearchHandler: ToolHandler = async (query: string, maxResults = DEFAULT_SEARCH_LIMIT) => {
  if (!query?.trim()) {
    return []
  }

  const url = new URL(DUCKDUCKGO_ENDPOINT)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('no_redirect', '1')
  url.searchParams.set('no_html', '1')
  url.searchParams.set('skip_disambig', '1')

  let payload: any
  try {
    const response = await fetch(url.toString())
    payload = await response.json()
  } catch (error) {
    console.error('[AI Tools] DuckDuckGo request failed', error)
    return []
  }

  const related = Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : []
  const flattened = flattenTopics(related)
    .filter((topic) => typeof topic.FirstURL === 'string' && typeof topic.Text === 'string')
    .slice(0, maxResults)

  return flattened.map((topic) => ({
    title: topic.Text?.split(' - ')[0] ?? topic.Text,
    url: topic.FirstURL,
    content: topic.Text
  }))
}

const fetchWithFallback = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.text()
  } catch (error) {
    const proxyUrl = `https://r.jina.ai/${url.startsWith('https://') ? 'https' : 'http'}://${url.replace(
      /^https?:\/\//,
      ''
    )}`
    const res = await fetch(proxyUrl)
    if (!res.ok) {
      throw error
    }
    return await res.text()
  }
}

const extractTextContent = (doc: Document): string => {
  const paragraphs = Array.from(doc.querySelectorAll('p'))
  const text = paragraphs
    .map((p) => p.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')
  return text.slice(0, 4000)
}

const scrapeHandler: ToolHandler = async (url: string) => {
  if (!url) {
    return {
      title: 'Unknown source',
      content: null,
      raw_html: null,
      screenshot: null
    }
  }

  try {
    const html = await fetchWithFallback(url)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const title = doc.querySelector('title')?.textContent?.trim() ?? url
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')
    const bodyText = extractTextContent(doc) || description || null
    const rawHtml = html.length > 20000 ? html.slice(0, 20000) : html

    return {
      title,
      content: bodyText,
      raw_html: rawHtml,
      screenshot: null
    }
  } catch (error) {
    console.error('[AI Tools] Failed to scrape URL', url, error)
    return {
      title: url,
      content: null,
      raw_html: null,
      screenshot: null
    }
  }
}

const imageGenerateHandler: ToolHandler = async (
  prompt: string,
  options?: { size?: string; style?: string }
) => {
  if (!prompt?.trim()) {
    return { error: 'Prompt is required for image generation' }
  }

  try {
    const apiKey = (globalThis as any).process?.env?.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('[AI Tools] OPENAI_API_KEY not configured for image generation')
      return { error: 'API key not configured' }
    }

    const size = options?.size || '1024x1024'
    const style = options?.style || 'vivid'

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        style: style
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[AI Tools] DALL-E API error:', error)
      return { error: error.error?.message || 'Failed to generate image' }
    }

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url

    if (!imageUrl) {
      return { error: 'No image URL in response' }
    }

    return {
      url: imageUrl,
      prompt: prompt,
      size: size,
      style: style,
      revised_prompt: data.data[0]?.revised_prompt
    }
  } catch (error) {
    console.error('[AI Tools] Image generation failed:', error)
    return { error: String(error) }
  }
}

const videoGenerateHandler: ToolHandler = async (
  prompt: string,
  options?: { duration?: number; aspect_ratio?: string }
) => {
  if (!prompt?.trim()) {
    return { error: 'Prompt is required for video generation' }
  }

  console.warn('[AI Tools] Video generation requested but not yet implemented:', prompt, options)

  return {
    status: 'not_implemented',
    message: 'Video generation requires integration with Luma AI or Runway API',
    prompt: prompt,
    requested_options: options
  }
}

const browserControlHandler: ToolHandler = async (command: any) => {
  console.warn('[AI Tools] Browser automation requested:', command)

  // Note: BrowserAutomationController is implemented in app/src/main/automation/controller.ts
  // To fully integrate browser automation, it needs to be exposed via IPC or as a separate
  // backend tool that can access the main process. The controller infrastructure is ready,
  // but the bridge from AI tools to the controller requires IPC integration.

  return {
    status: 'not_implemented',
    message: 'Browser automation controller is implemented but not yet integrated with AI tools',
    command: command,
    note: 'Controller available at app/src/main/automation/controller.ts - requires IPC bridge'
  }
}

export const TOOL_MANIFEST: ToolManifestEntry[] = [
  {
    backendId: TOOL_IDS.WEB_SEARCH_DONE_CALLBACK,
    handler: webSearchHandler,
    description: 'Executes a remote web search and returns structured results.',
    ui: {
      id: 'websearch',
      name: 'Web Search',
      icon: 'world',
      active: true
    }
  },
  {
    backendId: TOOL_IDS.SCRAPE_URL,
    handler: scrapeHandler,
    description: 'Fetches and summarizes content from a URL.'
  },
  {
    backendId: TOOL_IDS.SURFLET_DONE_CALLBACK,
    handler: noopHandler,
    description: 'Handles create/update callbacks for Surflet experiences.',
    ui: {
      id: 'surflet',
      name: 'App Generation',
      icon: 'code',
      active: true
    }
  },
  {
    backendId: TOOL_IDS.IMAGE_GENERATE,
    handler: imageGenerateHandler,
    description: 'Generates images using DALL-E 3 based on text prompts.',
    ui: {
      id: 'image-generation',
      name: 'Image Generation',
      icon: 'screenshot',
      active: true,
      disabled: false
    }
  },
  {
    backendId: TOOL_IDS.VIDEO_GENERATE,
    handler: videoGenerateHandler,
    description: 'Generates videos from text prompts (placeholder for Luma/Runway integration).',
    ui: {
      id: 'video-generation',
      name: 'Video Generation',
      icon: 'video',
      active: false,
      disabled: true
    }
  },
  {
    backendId: TOOL_IDS.BROWSER_CONTROL,
    handler: browserControlHandler,
    description: 'Controls browser automation (open_url, click, type, scroll, screenshot).',
    ui: {
      id: 'browser-automation',
      name: 'Browser Automation',
      icon: 'cursor',
      active: false,
      disabled: true
    }
  }
]

let registered = false

export async function registerAITools(sffs: SFFS): Promise<void> {
  if (registered) return
  for (const tool of TOOL_MANIFEST) {
    if (!tool.backendId || !tool.handler) {
      continue
    }
    try {
      await sffs.registerTool(tool.backendId, tool.handler)
    } catch (error) {
      console.error(`[AI Tools] Failed to register tool ${tool.backendId}`, error)
    }
  }
  registered = true
}

export const getToolListForUI = (): AITool[] =>
  TOOL_MANIFEST.filter((tool) => Boolean(tool.ui)).map((tool) => ({
    id: tool.ui!.id,
    name: tool.ui!.name,
    icon: tool.ui!.icon,
    active: tool.ui!.active ?? true,
    disabled: tool.ui!.disabled ?? false
  }))
