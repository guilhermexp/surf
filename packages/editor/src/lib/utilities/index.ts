import { isMac as detectIsMac } from '@deta/utils/system'

export * from './Suggestion/index'
export * from './misc/content'

export const isMac = () => detectIsMac()
