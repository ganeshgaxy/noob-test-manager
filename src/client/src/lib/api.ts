import type {
  App,
  CreateAppPayload,
  UpdateAppPayload,
  Space,
  CreateSpacePayload,
  Folder,
  CreateFolderPayload,
  Test,
  TestDetail,
  TestHistory,
  CreateTestPayload,
  TestStep,
  BddScenario,
  BddStep,
  TestRun,
  CreateRunPayload,
  RunResult,
  RunReport,
  CustomField,
  CustomFieldValue,
  AppSettings,
  AppIntegration,
  AuthUser,
  ApiToken,
  ApiTokenCreated,
  AppMember,
  SpaceMember,
  Group,
  GroupMember,
  AppGroupAccess,
  SpaceGroupAccess,
  AppTheme,
  GlobalTag,
  SpaceTag,
} from '../types/index.js'

const BASE = '/api'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 401) {
    // Notify AuthContext so it can redirect to login
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string }
    throw new Error(err.error || res.statusText)
  }
  return res.json() as Promise<T>
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export const api = {
  apps: {
    list: () => req<App[]>(`${BASE}/apps`),
    get: (id: number) => req<App>(`${BASE}/apps/${id}`),
    create: (data: CreateAppPayload) =>
      req<App>(`${BASE}/apps`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UpdateAppPayload) =>
      req<App>(`${BASE}/apps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`${BASE}/apps/${id}`, { method: 'DELETE' }),
  },

  // ─── Spaces ───────────────────────────────────────────────────────────────

  spaces: {
    list: (appId: number) => req<Space[]>(`${BASE}/apps/${appId}/spaces`),
    get: (appId: number, spaceId: number) => req<Space>(`${BASE}/apps/${appId}/spaces/${spaceId}`),
    create: (appId: number, data: CreateSpacePayload) =>
      req<Space>(`${BASE}/apps/${appId}/spaces`, { method: 'POST', body: JSON.stringify(data) }),
    update: (appId: number, spaceId: number, data: Partial<CreateSpacePayload>) =>
      req<Space>(`${BASE}/apps/${appId}/spaces/${spaceId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (appId: number, spaceId: number) =>
      req<{ success: boolean }>(`${BASE}/apps/${appId}/spaces/${spaceId}`, { method: 'DELETE' }),
  },

  // ─── Folders ──────────────────────────────────────────────────────────────

  folders: {
    list: (spaceId: number) => req<Folder[]>(`${BASE}/spaces/${spaceId}/folders`),
    create: (spaceId: number, data: CreateFolderPayload) =>
      req<Folder>(`${BASE}/spaces/${spaceId}/folders`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (spaceId: number, folderId: number, data: Partial<CreateFolderPayload>) =>
      req<Folder>(`${BASE}/spaces/${spaceId}/folders/${folderId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (spaceId: number, folderId: number) =>
      req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/folders/${folderId}`, {
        method: 'DELETE',
      }),
  },

  // ─── Tests ────────────────────────────────────────────────────────────────

  tests: {
    list: (folderId: number) => req<Test[]>(`${BASE}/folders/${folderId}/tests`),
    get: (folderId: number, testId: number) =>
      req<TestDetail>(`${BASE}/folders/${folderId}/tests/${testId}`),
    create: (folderId: number, data: CreateTestPayload) =>
      req<Test>(`${BASE}/folders/${folderId}/tests`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      folderId: number,
      testId: number,
      data: Partial<CreateTestPayload> & { updatedBy: string }
    ) =>
      req<Test>(`${BASE}/folders/${folderId}/tests/${testId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (folderId: number, testId: number) =>
      req<{ success: boolean }>(`${BASE}/folders/${folderId}/tests/${testId}`, {
        method: 'DELETE',
      }),
    history: (folderId: number, testId: number) =>
      req<TestHistory[]>(`${BASE}/folders/${folderId}/tests/${testId}/history`),
    // Traditional steps
    steps: {
      list: (folderId: number, testId: number) =>
        req<TestStep[]>(`${BASE}/folders/${folderId}/tests/${testId}/steps`),
      create: (
        folderId: number,
        testId: number,
        data: { action: string; expectedResult?: string; order?: number }
      ) =>
        req<TestStep>(`${BASE}/folders/${folderId}/tests/${testId}/steps`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        folderId: number,
        testId: number,
        stepId: number,
        data: Partial<{ action: string; expectedResult: string; order: number }>
      ) =>
        req<TestStep>(`${BASE}/folders/${folderId}/tests/${testId}/steps/${stepId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (folderId: number, testId: number, stepId: number) =>
        req<{ success: boolean }>(`${BASE}/folders/${folderId}/tests/${testId}/steps/${stepId}`, {
          method: 'DELETE',
        }),
    },
    // BDD scenarios
    scenarios: {
      list: (folderId: number, testId: number) =>
        req<BddScenario[]>(`${BASE}/folders/${folderId}/tests/${testId}/scenarios`),
      create: (
        folderId: number,
        testId: number,
        data: { feature?: string; scenario: string; order?: number }
      ) =>
        req<BddScenario>(`${BASE}/folders/${folderId}/tests/${testId}/scenarios`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        folderId: number,
        testId: number,
        scenarioId: number,
        data: { feature?: string; scenario?: string; order?: number }
      ) =>
        req<BddScenario>(`${BASE}/folders/${folderId}/tests/${testId}/scenarios/${scenarioId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (folderId: number, testId: number, scenarioId: number) =>
        req<{ success: boolean }>(
          `${BASE}/folders/${folderId}/tests/${testId}/scenarios/${scenarioId}`,
          { method: 'DELETE' }
        ),
      steps: {
        create: (
          folderId: number,
          testId: number,
          scenarioId: number,
          data: { type: string; text: string; order?: number }
        ) =>
          req<BddStep>(
            `${BASE}/folders/${folderId}/tests/${testId}/scenarios/${scenarioId}/steps`,
            { method: 'POST', body: JSON.stringify(data) }
          ),
        update: (
          folderId: number,
          testId: number,
          scenarioId: number,
          stepId: number,
          data: { type?: string; text?: string; order?: number }
        ) =>
          req<BddStep>(
            `${BASE}/folders/${folderId}/tests/${testId}/scenarios/${scenarioId}/steps/${stepId}`,
            { method: 'PUT', body: JSON.stringify(data) }
          ),
        delete: (folderId: number, testId: number, scenarioId: number, stepId: number) =>
          req<{ success: boolean }>(
            `${BASE}/folders/${folderId}/tests/${testId}/scenarios/${scenarioId}/steps/${stepId}`,
            { method: 'DELETE' }
          ),
      },
    },
  },

  // ─── Runs ─────────────────────────────────────────────────────────────────

  runs: {
    list: (appId: number) => req<TestRun[]>(`${BASE}/apps/${appId}/runs`),
    get: (appId: number, runId: number) => req<TestRun>(`${BASE}/apps/${appId}/runs/${runId}`),
    create: (appId: number, data: CreateRunPayload) =>
      req<TestRun>(`${BASE}/apps/${appId}/runs`, { method: 'POST', body: JSON.stringify(data) }),
    setStatus: (appId: number, runId: number, status: string) =>
      req<TestRun>(`${BASE}/apps/${appId}/runs/${runId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    delete: (appId: number, runId: number) =>
      req<{ success: boolean }>(`${BASE}/apps/${appId}/runs/${runId}`, { method: 'DELETE' }),
    duplicate: (appId: number, runId: number) =>
      req<TestRun>(`${BASE}/apps/${appId}/runs/${runId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    results: (appId: number, runId: number) =>
      req<RunResult[]>(`${BASE}/apps/${appId}/runs/${runId}/results`),
    markResult: (
      appId: number,
      runId: number,
      resultId: number,
      data: {
        status: 'pass' | 'fail' | 'skip' | 'blocked'
        notes?: string
        executedBy?: string
        propagateToSteps?: boolean
      }
    ) =>
      req<RunResult>(`${BASE}/apps/${appId}/runs/${runId}/results/${resultId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    markBulk: (
      appId: number,
      runId: number,
      data: {
        scopeType: 'space' | 'folder'
        scopeId: number
        status: 'pass' | 'fail' | 'skip' | 'blocked'
        executedBy?: string
        propagateToSteps?: boolean
      }
    ) =>
      req<{ updated: number }>(`${BASE}/apps/${appId}/runs/${runId}/results/bulk`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    markStep: (
      appId: number,
      runId: number,
      resultId: number,
      stepResultId: number,
      data: {
        status: 'pass' | 'fail' | 'skip'
        notes?: string
      }
    ) =>
      req<{ id: number }>(
        `${BASE}/apps/${appId}/runs/${runId}/results/${resultId}/steps/${stepResultId}`,
        { method: 'PATCH', body: JSON.stringify(data) }
      ),
    report: (appId: number, runId: number) =>
      req<RunReport>(`${BASE}/apps/${appId}/runs/${runId}/report`),
    addItems: (
      appId: number,
      runId: number,
      pack: Array<{ scopeType: 'space' | 'folder' | 'test'; scopeId: number }>
    ) =>
      req<{ added: number }>(`${BASE}/apps/${appId}/runs/${runId}/items`, {
        method: 'POST',
        body: JSON.stringify({ pack }),
      }),
    resetProgress: (appId: number, runId: number, folderId?: number) =>
      req<{ reset: number }>(`${BASE}/apps/${appId}/runs/${runId}/results/reset`, {
        method: 'POST',
        body: JSON.stringify(folderId != null ? { folderId } : {}),
      }),
    resetResult: (appId: number, runId: number, resultId: number) =>
      req<{ reset: boolean }>(`${BASE}/apps/${appId}/runs/${runId}/results/${resultId}/reset`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    removeResult: (appId: number, runId: number, resultId: number) =>
      req<{ success: boolean }>(`${BASE}/apps/${appId}/runs/${runId}/results/${resultId}`, {
        method: 'DELETE',
      }),
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  settings: {
    get: (appId: number) => req<AppSettings>(`${BASE}/apps/${appId}/app-settings`),
    set: (appId: number, key: string, value: unknown) =>
      req<AppSettings>(`${BASE}/apps/${appId}/app-settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
  },

  // ─── Custom Fields ────────────────────────────────────────────────────────

  fields: {
    list: (appId: number) => req<CustomField[]>(`${BASE}/apps/${appId}/fields`),
    create: (
      appId: number,
      data: {
        name: string
        type: string
        options?: string[]
        required?: boolean
        defaultValue?: string
        order?: number
      }
    ) =>
      req<CustomField>(`${BASE}/apps/${appId}/fields`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      appId: number,
      fieldId: number,
      data: Partial<{
        name: string
        type: string
        options: string[]
        required: boolean
        defaultValue: string
        order: number
      }>
    ) =>
      req<CustomField>(`${BASE}/apps/${appId}/fields/${fieldId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (appId: number, fieldId: number) =>
      req<{ success: boolean }>(`${BASE}/apps/${appId}/fields/${fieldId}`, { method: 'DELETE' }),
    values: {
      list: (appId: number, testId: number) =>
        req<CustomFieldValue[]>(`${BASE}/apps/${appId}/fields/values/${testId}`),
      set: (appId: number, testId: number, fieldId: number, value: string) =>
        req<CustomFieldValue>(`${BASE}/apps/${appId}/fields/values/${testId}`, {
          method: 'PUT',
          body: JSON.stringify({ fieldId, value }),
        }),
    },
  },

  // ─── Bulk operations ──────────────────────────────────────────────────────

  bulk: {
    tests: {
      duplicate: (data: { testIds: number[]; targetFolderId: number; actor?: string }) =>
        req<{ duplicated: number[] }>(`${BASE}/bulk/tests/duplicate`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      move: (data: { testIds: number[]; targetFolderId: number }) =>
        req<{ moved: number[] }>(`${BASE}/bulk/tests/move`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (data: { testIds: number[] }) =>
        req<{ trashed: number[] }>(`${BASE}/bulk/tests/delete`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (data: {
        testIds: number[]
        updates: {
          priority?: string
          status?: string
          assigneeId?: string
          tags?: string[]
          tagsMode?: 'replace' | 'append'
        }
      }) =>
        req<{ updated: number }>(`${BASE}/bulk/tests/update`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
    },
    folders: {
      duplicate: (data: {
        folderIds: number[]
        targetParentFolderId?: number | null
        spaceId: number
        actor?: string
      }) =>
        req<{ duplicated: number[] }>(`${BASE}/bulk/folders/duplicate`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      move: (data: { folderIds: number[]; targetParentFolderId: number | null }) =>
        req<{ moved: number[] }>(`${BASE}/bulk/folders/move`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
    },
  },

  // ─── Trash ────────────────────────────────────────────────────────────────

  trash: {
    list: (spaceId: number) =>
      req<{ folders: Folder[]; tests: Test[] }>(`${BASE}/spaces/${spaceId}/trash`),
    restoreTests: (spaceId: number, testIds: number[]) =>
      req<{ restored: number[] }>(`${BASE}/spaces/${spaceId}/trash/tests/restore`, {
        method: 'POST',
        body: JSON.stringify({ testIds }),
      }),
    restoreFolders: (spaceId: number, folderIds: number[]) =>
      req<{ restored: number[] }>(`${BASE}/spaces/${spaceId}/trash/folders/restore`, {
        method: 'POST',
        body: JSON.stringify({ folderIds }),
      }),
    deleteTestPermanently: (spaceId: number, testId: number) =>
      req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/trash/tests/${testId}`, {
        method: 'DELETE',
      }),
    deleteFolderPermanently: (spaceId: number, folderId: number) =>
      req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/trash/folders/${folderId}`, {
        method: 'DELETE',
      }),
  },

  // ─── Integrations ─────────────────────────────────────────────────────────

  integrations: {
    list: (appId: number) => req<AppIntegration[]>(`${BASE}/apps/${appId}/integrations`),
    upsert: (appId: number, type: string, config: Record<string, string>, enabled?: boolean) =>
      req<AppIntegration>(`${BASE}/apps/${appId}/integrations/${type}`, {
        method: 'PUT',
        body: JSON.stringify({ config, enabled }),
      }),
    delete: (appId: number, type: string) =>
      req<{ success: boolean }>(`${BASE}/apps/${appId}/integrations/${type}`, { method: 'DELETE' }),
  },

  // ─── Auth ─────────────────────────────────────────────────────────────────

  auth: {
    login: (email: string, password: string) =>
      req<{ user: AuthUser }>(`${BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => req<{ ok: boolean }>(`${BASE}/auth/logout`, { method: 'POST' }),
    me: () => req<AuthUser>(`${BASE}/auth/me`),
    forgotPassword: (email: string) =>
      req<{ ok: boolean; tempPassword?: string }>(`${BASE}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      req<{ ok: boolean }>(`${BASE}/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      req<{ ok: boolean }>(`${BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  // ─── API tokens ───────────────────────────────────────────────────────────

  tokens: {
    list: () => req<ApiToken[]>(`${BASE}/tokens`),
    create: (name: string, expiresAt?: string) =>
      req<ApiTokenCreated>(`${BASE}/tokens`, {
        method: 'POST',
        body: JSON.stringify({ name, expiresAt }),
      }),
    delete: (id: number) => req<{ success: boolean }>(`${BASE}/tokens/${id}`, { method: 'DELETE' }),
  },

  // ─── Members ──────────────────────────────────────────────────────────────

  members: {
    app: {
      list: (appId: number) => req<AppMember[]>(`${BASE}/apps/${appId}/members`),
      add: (appId: number, userId: number, role: 'admin' | 'member' | 'viewer') =>
        req<AppMember>(`${BASE}/apps/${appId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId, role }),
        }),
      update: (appId: number, userId: number, role: 'admin' | 'member' | 'viewer') =>
        req<AppMember>(`${BASE}/apps/${appId}/members/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        }),
      remove: (appId: number, userId: number) =>
        req<{ success: boolean }>(`${BASE}/apps/${appId}/members/${userId}`, { method: 'DELETE' }),
    },
    space: {
      list: (spaceId: number) => req<SpaceMember[]>(`${BASE}/spaces/${spaceId}/members`),
      add: (spaceId: number, userId: number, role: 'admin' | 'member' | 'viewer') =>
        req<SpaceMember>(`${BASE}/spaces/${spaceId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId, role }),
        }),
      update: (spaceId: number, userId: number, role: 'admin' | 'member' | 'viewer') =>
        req<SpaceMember>(`${BASE}/spaces/${spaceId}/members/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        }),
      remove: (spaceId: number, userId: number) =>
        req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/members/${userId}`, {
          method: 'DELETE',
        }),
    },
    appGroups: {
      list: (appId: number) => req<AppGroupAccess[]>(`${BASE}/apps/${appId}/group-access`),
      add: (appId: number, groupId: number, role: 'admin' | 'member' | 'viewer') =>
        req<AppGroupAccess>(`${BASE}/apps/${appId}/group-access`, {
          method: 'POST',
          body: JSON.stringify({ groupId, role }),
        }),
      update: (appId: number, groupId: number, role: 'admin' | 'member' | 'viewer') =>
        req<AppGroupAccess>(`${BASE}/apps/${appId}/group-access/${groupId}`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        }),
      remove: (appId: number, groupId: number) =>
        req<{ success: boolean }>(`${BASE}/apps/${appId}/group-access/${groupId}`, {
          method: 'DELETE',
        }),
    },
    spaceGroups: {
      list: (spaceId: number) => req<SpaceGroupAccess[]>(`${BASE}/spaces/${spaceId}/group-access`),
      add: (spaceId: number, groupId: number, role: 'admin' | 'member' | 'viewer') =>
        req<SpaceGroupAccess>(`${BASE}/spaces/${spaceId}/group-access`, {
          method: 'POST',
          body: JSON.stringify({ groupId, role }),
        }),
      update: (spaceId: number, groupId: number, role: 'admin' | 'member' | 'viewer') =>
        req<SpaceGroupAccess>(`${BASE}/spaces/${spaceId}/group-access/${groupId}`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
        }),
      remove: (spaceId: number, groupId: number) =>
        req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/group-access/${groupId}`, {
          method: 'DELETE',
        }),
    },
  },

  // ─── Groups ───────────────────────────────────────────────────────────────

  groups: {
    list: () => req<Group[]>(`${BASE}/groups`),
    create: (data: { name: string; description?: string }) =>
      req<Group>(`${BASE}/groups`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; description?: string }) =>
      req<Group>(`${BASE}/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`${BASE}/groups/${id}`, { method: 'DELETE' }),
    members: {
      list: (groupId: number) => req<GroupMember[]>(`${BASE}/groups/${groupId}/members`),
      add: (groupId: number, userId: number) =>
        req<GroupMember>(`${BASE}/groups/${groupId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        }),
      remove: (groupId: number, userId: number) =>
        req<{ success: boolean }>(`${BASE}/groups/${groupId}/members/${userId}`, {
          method: 'DELETE',
        }),
    },
  },

  // ─── Users (super_admin) ──────────────────────────────────────────────────

  users: {
    list: () => req<AuthUser[]>(`${BASE}/users`),
    search: (q: string) =>
      req<{ id: number; email: string; name: string | null }[]>(
        `${BASE}/users/search?q=${encodeURIComponent(q)}`
      ),
    create: (data: { email: string; name?: string; password: string; globalRole?: string }) =>
      req<AuthUser>(`${BASE}/users`, { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: number,
      data: Partial<{ name: string; email: string; globalRole: string; isActive: boolean }>
    ) => req<AuthUser>(`${BASE}/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    resetPassword: (id: number) =>
      req<{ ok: boolean; tempPassword?: string }>(`${BASE}/users/${id}/reset-password`, {
        method: 'POST',
      }),
    delete: (id: number) => req<{ success: boolean }>(`${BASE}/users/${id}`, { method: 'DELETE' }),
  },

  // ─── Auth config (super_admin) ────────────────────────────────────────────

  authConfig: {
    get: () => req<Record<string, unknown>>(`${BASE}/auth-config`),
    update: (data: Record<string, unknown>) =>
      req<{ ok: boolean }>(`${BASE}/auth-config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    testEmail: (data: Record<string, unknown>) =>
      req<{ ok: boolean; sentTo?: string; error?: string }>(`${BASE}/auth-config/test-email`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ─── SSO (public — no auth required) ─────────────────────────────────────

  sso: {
    config: () =>
      req<{ enabled: boolean; provider: 'oidc' | 'github' | null }>(`${BASE}/auth/sso/config`),
  },

  // ─── Cache config ─────────────────────────────────────────────────────────

  cacheConfig: {
    get: () =>
      req<{ type: string; lruMax: number; redisUrl: string; ttl: number; active: string }>(
        `${BASE}/cache-config`
      ),
    test: (data: { type: string; redisUrl?: string }) =>
      req<{ ok: boolean; error?: string; message?: string }>(`${BASE}/cache-config/test`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (data: { type: string; lruMax?: number; redisUrl?: string; ttl?: number }) =>
      req<{ ok: boolean; type: string; message?: string; error?: string }>(`${BASE}/cache-config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // ─── Theme ────────────────────────────────────────────────────────────────

  theme: {
    get: () => req<AppTheme>(`${BASE}/theme`),
    update: (data: Partial<AppTheme>) =>
      req<AppTheme>(`${BASE}/theme`, { method: 'PUT', body: JSON.stringify(data) }),
    reset: () => req<AppTheme>(`${BASE}/theme/reset`, { method: 'POST', body: '{}' }),
  },

  // ─── Global tags ──────────────────────────────────────────────────────────

  globalTags: {
    list: () => req<GlobalTag[]>(`${BASE}/global-tags`),
    create: (data: { name: string; color?: string }) =>
      req<GlobalTag>(`${BASE}/global-tags`, { method: 'POST', body: JSON.stringify(data) }),
    update: (tagId: number, data: { name?: string; color?: string }) =>
      req<GlobalTag>(`${BASE}/global-tags/${tagId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (tagId: number) =>
      req<{ success: boolean }>(`${BASE}/global-tags/${tagId}`, { method: 'DELETE' }),
  },

  // ─── Space tags ───────────────────────────────────────────────────────────

  spaceTags: {
    list: (spaceId: number) => req<SpaceTag[]>(`${BASE}/spaces/${spaceId}/space-tags`),
    create: (spaceId: number, data: { name: string; color?: string }) =>
      req<SpaceTag>(`${BASE}/spaces/${spaceId}/space-tags`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (spaceId: number, tagId: number, data: { name?: string; color?: string }) =>
      req<SpaceTag>(`${BASE}/spaces/${spaceId}/space-tags/${tagId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (spaceId: number, tagId: number) =>
      req<{ success: boolean }>(`${BASE}/spaces/${spaceId}/space-tags/${tagId}`, {
        method: 'DELETE',
      }),
  },

  // ─── Database config ──────────────────────────────────────────────────────

  dbConfig: {
    get: () =>
      req<{ type: string; url: string; hasToken: boolean; connected: boolean }>(
        `${BASE}/db-config`
      ),
    test: (data: { type: string; url: string; token?: string }) =>
      req<{ ok: boolean; error?: string; message?: string }>(`${BASE}/db-config/test`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (data: { type: string; url: string; token?: string }) =>
      req<{ ok: boolean; type: string; message?: string; error?: string }>(`${BASE}/db-config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
}
