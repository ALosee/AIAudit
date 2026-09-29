import { defineModule } from '@jingwei/module-sdk'

export const manifest = defineModule({
  id: 'audit',
  name: 'AI 智能审核',
  category: 'business',
  dependencies: ['iam'],
  optionalDependencies: [],
  capabilities: [{ id: 'audit.projects', name: '审核项目工作区' }],
  permissions: [
    { code: 'audit.project.view', name: '查看审核项目' },
    { code: 'audit.project.manage', name: '管理审核项目' },
  ],
  routeDefinitions: [
    {
      key: 'audit.projects',
      page: 'ProjectList',
      layout: 'base',
      allowedAccessModes: ['PERMISSION'],
      requiredCapability: 'audit.projects',
      requiredPermission: 'audit.project.view',
    },
  ],
  navigationItems: [
    {
      code: 'audit.projects',
      name: '审核项目',
      type: 'MENU',
      parentCode: 'workspace',
      routeKey: 'audit.projects',
      path: '/audit/projects',
      accessMode: 'PERMISSION',
      sortOrder: 10,
      icon: 'lucide:folder-kanban',
    },
  ],
})
