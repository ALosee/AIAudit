import { expect, test } from '@playwright/test'

import { defaultEffectiveBrand } from '@jingwei/module-branding/shared'
import type { NavigationNode, NavigationResponse } from '@jingwei/module-navigation/shared'

const id = (value: number) => '00000000-0000-7000-8000-' + String(value).padStart(12, '0')
const now = '2026-09-01T00:00:00.000Z'
const login: NavigationNode = {
  id: id(1),
  code: 'iam.login',
  name: '登录',
  type: 'PAGE',
  status: 'ENABLED',
  parentId: null,
  routeKey: 'iam.login',
  path: '/signin',
  layout: 'blank',
  icon: null,
  sortOrder: 0,
  accessMode: 'PUBLIC',
  href: null,
  externalTarget: null,
  params: {},
  query: {},
}
const projects: NavigationNode = {
  ...login,
  id: id(2),
  code: 'audit.projects',
  name: '审核项目',
  type: 'MENU',
  routeKey: 'audit.projects',
  path: '/audit/projects',
  layout: 'base',
  icon: 'lucide:folder-kanban',
  accessMode: 'PERMISSION',
}
const response = (nodes: NavigationNode[]): NavigationResponse => ({
  schemaVersion: 2,
  versionId: id(100),
  publishedRevision: 1,
  authEntryCode: login.code,
  homeCode: projects.code,
  nodes,
})

const project = {
  id: id(10),
  name: '中文文档上传联调',
  description: '自动联调样本；可在项目页面查看',
  status: 'ACTIVE',
  revision: 3,
  createdAt: now,
  updatedAt: now,
}
const archivedProject = {
  id: id(11),
  name: '历史合同归档',
  description: '去年已结束的审查批次',
  status: 'ARCHIVED',
  revision: 8,
  createdAt: now,
  updatedAt: now,
}
const task = {
  id: id(30),
  projectId: project.id,
  name: '主合同条款一致性',
  objective: '核对主合同与附件清单中的金额与交付日期',
  status: 'DRAFT',
  revision: 2,
  createdAt: now,
  updatedAt: now,
}
const document = {
  id: id(40),
  projectId: project.id,
  name: '主合同',
  latestVersionNumber: 2,
  createdAt: now,
  updatedAt: now,
}
const version = {
  id: id(41),
  documentId: document.id,
  versionNumber: 2,
  fileName: '主合同-v2.docx',
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  byteSize: 245_760,
  sha256: 'a'.repeat(64),
  createdAt: now,
}
const binding = {
  id: id(50),
  taskId: task.id,
  documentId: document.id,
  documentVersionId: version.id,
  documentName: document.name,
  versionNumber: 2,
  fileName: version.fileName,
  role: '待审核合同',
  createdAt: now,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/navigation/bootstrap', (route) =>
    route.fulfill({ json: response([login]) }),
  )
  await page.route('**/api/v1/iam/session', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        permissions: [
          'audit.project.view',
          'audit.project.manage',
          'audit.task.view',
          'audit.task.manage',
        ],
        user: { id: id(200), tenantId: id(201), displayName: '管理员', avatarUrl: null },
      },
    }),
  )
  await page.route('**/api/v1/navigation/me', (route) =>
    route.fulfill({ json: response([login, projects]) }),
  )
  await page.route('**/api/v1/branding/bootstrap*', (route) =>
    route.fulfill({ json: defaultEffectiveBrand }),
  )
  await page.route('**/api/v1/audit/projects?**', (route) => {
    const url = new URL(route.request().url())
    const status = url.searchParams.get('status') ?? 'ACTIVE'
    const items = status === 'ARCHIVED' ? [archivedProject] : [project]
    return route.fulfill({ json: { items, total: items.length, limit: 50, offset: 0 } })
  })
  await page.route(/\/api\/v1\/audit\/projects\/[^/]+\/tasks\/[^/]+\/documents(\?|$)/, (route) =>
    route.fulfill({ json: { items: [binding] } }),
  )
  await page.route(/\/api\/v1\/audit\/projects\/[^/]+\/documents\/[^/]+\/versions(\?|$)/, (route) =>
    route.fulfill({ json: { items: [version], total: 1, limit: 50, offset: 0 } }),
  )
  await page.route(/\/api\/v1\/audit\/projects\/[^/]+\/documents(\?|$)/, (route) =>
    route.fulfill({ json: { items: [document], total: 1, limit: 50, offset: 0 } }),
  )
  await page.route(/\/api\/v1\/audit\/projects\/[^/]+\/tasks(\?|$)/, (route) =>
    route.fulfill({ json: { items: [task], total: 1, limit: 50, offset: 0 } }),
  )
})

test('audit project workspace groups overview, tasks, and documents', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/audit/projects')

  await expect(page.getByRole('heading', { name: '项目列表' })).toBeVisible()
  await expect(page.getByRole('button', { name: /中文文档上传联调/ })).toBeVisible()
  await expect(page.getByText('选择左侧项目，或新建审核项目')).toBeVisible()

  await page.getByRole('button', { name: /中文文档上传联调/ }).click()
  await expect(page.getByRole('heading', { name: '中文文档上传联调' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '概览' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '审核任务' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '项目文档' })).toBeVisible()
  await expect(page.getByLabel('项目名称')).toHaveValue('中文文档上传联调')

  await page.getByRole('tab', { name: '审核任务' }).click()
  await expect(page.getByRole('heading', { name: '任务列表' })).toBeVisible()
  await page.getByRole('button', { name: /主合同条款一致性/ }).click()
  await expect(page.getByRole('heading', { name: '任务详情' })).toBeVisible()
  await expect(page.getByText('待审核合同')).toBeVisible()
  await expect(page.getByText('主合同-v2.docx')).toBeVisible()

  await page.getByRole('tab', { name: '项目文档' }).click()
  await expect(page.getByRole('heading', { name: '项目文档' })).toBeVisible()
  await page.getByRole('button', { name: /主合同/ }).click()
  await expect(page.getByText('主合同-v2.docx · 240.0 KB')).toBeVisible()
  await expect(page.getByText('共 1 个版本')).toBeVisible()
})

test('archived projects stay read-only in the overview', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/audit/projects')
  await page.getByRole('tab', { name: '已归档' }).click()
  await page.getByRole('button', { name: /历史合同归档/ }).click()
  await expect(page.getByText('项目已归档，资料只读')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存修改', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '归档', exact: true })).toHaveCount(0)
})

test('small screens switch between the project list and detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/audit/projects')
  await page.getByRole('button', { name: /中文文档上传联调/ }).click()
  await expect(page.getByRole('heading', { name: '中文文档上传联调' })).toBeVisible()
  await page.getByRole('button', { name: '返回列表' }).click()
  await expect(page.getByRole('heading', { name: '项目列表' })).toBeVisible()
})
