import type { AITool } from '@deta/types'
import { getToolListForUI } from '../ai/tools/manifest'

export const AI_TOOLS = getToolListForUI() as AITool[]
