import type { WebModule } from '@jingwei/module-sdk/web'

import { manifest } from '../manifest.js'

export const webModule: WebModule = {
  manifest,
  pages: [{ routeKey: 'audit.projects', pageKey: 'ProjectList' }],
}
