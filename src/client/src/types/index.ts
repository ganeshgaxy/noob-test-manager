// ─── Auth / Users ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  email: string
  name: string | null
  globalRole: 'super_admin' | 'member'
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface ApiToken {
  id: number
  name: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface ApiTokenCreated extends ApiToken {
  /** Raw token — shown exactly once on creation */
  token: string
}

export interface AppMember {
  id: number
  userId: number
  email: string
  name: string | null
  role: 'admin' | 'member' | 'viewer'
  createdAt: string
}

export interface SpaceMember {
  id: number
  userId: number
  email: string
  name: string | null
  role: 'admin' | 'member' | 'viewer'
  createdAt: string
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: number
  groupId: number
  userId: number
  email: string
  name: string | null
  createdAt: string
}

export interface AppGroupAccess {
  id: number
  groupId: number
  groupName: string
  groupDescription: string | null
  role: 'admin' | 'member' | 'viewer'
  createdAt: string
}

export interface SpaceGroupAccess {
  id: number
  groupId: number
  groupName: string
  groupDescription: string | null
  role: 'admin' | 'member' | 'viewer'
  createdAt: string
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export interface App {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppPayload {
  name: string
  description?: string
}

export interface UpdateAppPayload {
  name?: string
  description?: string
}

// ─── Spaces ───────────────────────────────────────────────────────────────────

export interface Space {
  id: number
  appId: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  folderCount?: number
  testCount?: number
}

export interface CreateSpacePayload {
  name: string
  description?: string
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export interface Folder {
  id: number
  spaceId: number
  parentFolderId: number | null
  name: string
  description: string | null
  order: number
  isTrashed: boolean
  trashedAt: string | null
  createdAt: string
  updatedAt: string
  testCount?: number
}

export interface FolderNode extends Folder {
  children: FolderNode[]
}

export interface CreateFolderPayload {
  name: string
  description?: string
  parentFolderId?: number
  order?: number
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export type TestFashion = 'traditional' | 'bdd'
export type TestType =
  | 'Accessibility'
  | 'Acceptance'
  | 'Compatibility'
  | 'Destructive'
  | 'Performance'
  | 'Integration'
  | 'Functional'
  | 'Regression'
  | 'Smoke & Sanity'
  | 'Security'
  | 'User Interface'
  | 'Usability'
  | 'Other'
export type TestPriority = 'Lowest' | 'Low' | 'Medium' | 'High' | 'Highest' | 'Normal'
export type TestStatus =
  | 'Draft'
  | 'Deprecated'
  | 'Unverified'
  | 'Faulty'
  | 'Ready'
  | 'Live'
  | 'Archived'
export type AutomationStatus = 'Automated' | 'Not Automated' | 'To Be Automated'

export interface Test {
  id: number
  folderId: number
  type: TestFashion
  category: TestType | null
  title: string
  description: string | null
  preconditions: string | null
  notes: string | null
  priority: TestPriority
  status: TestStatus
  tags: string | null // JSON array string
  assigneeId: string | null
  estimatedTime: number | null
  automationStatus: AutomationStatus | null
  jiraIssueKey: string | null
  internalId: string | null
  isTrashed: boolean
  trashedAt: string | null
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface TestStep {
  id: number
  testId: number
  order: number
  action: string
  expectedResult: string | null
  createdAt: string
  updatedAt: string
}

export interface BddScenario {
  id: number
  testId: number
  feature: string | null
  scenario: string
  order: number
  createdAt: string
  updatedAt: string
  steps: BddStep[]
}

export interface BddStep {
  id: number
  scenarioId: number
  type: 'given' | 'when' | 'then' | 'and' | 'but'
  order: number
  text: string
  createdAt: string
}

export interface TestDetail extends Test {
  steps?: TestStep[]
  scenarios?: BddScenario[]
}

export interface TestHistory {
  id: number
  testId: number
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
}

export interface Tag {
  id: number
  appId: number
  name: string
  color: string | null
  createdAt: string
}

export interface CreateTestPayload {
  type?: TestFashion
  category?: TestType
  title: string
  description?: string
  preconditions?: string
  notes?: string
  priority?: TestPriority
  status?: TestStatus
  tags?: string[]
  assigneeId?: string
  estimatedTime?: number
  automationStatus?: AutomationStatus
  jiraIssueKey?: string
  tagNames?: string[]
  createdBy: string
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'aborted'
export type ResultStatus = 'pending' | 'pass' | 'fail' | 'skip' | 'blocked'
export type StepResultStatus = 'pending' | 'pass' | 'fail' | 'skip'

export interface TestRun {
  id: number
  appId: number
  name: string
  description: string | null
  environment: string | null
  status: RunStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  testCount?: number
}

export interface PackItem {
  scopeType: 'space' | 'folder' | 'test'
  scopeId: number
}

export interface CreateRunPayload {
  name: string
  description?: string
  environment?: string
  createdBy: string
  pack?: PackItem[]
}

export interface RunStepResult {
  id: number
  runResultId: number
  stepType: 'traditional' | 'bdd'
  stepId: number
  status: StepResultStatus
  notes: string | null
  executedAt: string | null
  // enriched by server
  action: string
  expectedResult: string | null
  // BDD-only enriched fields
  scenarioId?: number | null
  scenarioName?: string | null
  featureName?: string | null
}

export interface RunResult {
  id: number
  runId: number
  testId: number
  status: ResultStatus
  notes: string | null
  executedBy: string | null
  executedAt: string | null
  stepResults: RunStepResult[]
  // enriched by server
  testTitle: string
  testType: 'traditional' | 'bdd'
  preconditions: string | null
  folderId: number | null
  folderName: string
  folderPath: string[]
  spaceId: number | null
  spaceName: string
}

export interface RunReport {
  run: TestRun
  summary: {
    total: number
    pass: number
    fail: number
    skip: number
    blocked: number
    pending: number
    passRate: number
  }
  results: RunResult[]
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'dropdown'
  | 'multiselect'
  | 'date'
  | 'checkbox'
  | 'url'

export interface CustomField {
  id: number
  appId: number
  name: string
  type: CustomFieldType
  options: string | null // JSON array string for dropdown/multiselect
  required: boolean
  defaultValue: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface CustomFieldValue {
  id: number
  testId: number
  fieldId: number
  value: string | null
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface AppTheme {
  /** Human-readable name shown in the preset selector */
  name: string

  // ── Backgrounds ────────────────────────────────────────────────────────────
  /** Page / outermost container  e.g. #000 */
  bgBase: string
  /** Elevated cards / sections  e.g. #0d0d0d */
  bgSurface: string
  /** Sidebar / panel bg  e.g. #111 */
  bgPanel: string
  /** Dropdown / popup bg  e.g. #141414 */
  bgElevated: string
  /** Row / item hover highlight  e.g. #111 dark, #ebebeb light */
  bgHover: string

  // ── Borders ────────────────────────────────────────────────────────────────
  /** Hairline dividers  e.g. #1a1a1a */
  borderSubtle: string
  /** Regular element borders  e.g. #222 */
  borderDefault: string
  /** Button / strong borders  e.g. #333 */
  borderStrong: string

  // ── Text ───────────────────────────────────────────────────────────────────
  /** Main body text  e.g. #ededed */
  textPrimary: string
  /** Secondary / label text  e.g. #888 */
  textSecondary: string
  /** Placeholder / disabled text  e.g. #555 */
  textMuted: string

  // ── Accents ────────────────────────────────────────────────────────────────
  /** Error / destructive  e.g. #e5484d */
  accentDanger: string
  /** Success / pass  e.g. #1a9e5e */
  accentSuccess: string
  /** Warning / caution  e.g. #b45309 */
  accentWarning: string

  // ── Typography ─────────────────────────────────────────────────────────────
  fontSans: string
  fontMono: string

  // ── Shape ──────────────────────────────────────────────────────────────────
  /** Base border-radius used for panels/cards  e.g. 8 (px) */
  radius: number
}

export interface AppSettings {
  tags?: string[]
  defaultPriority?: string
  defaultStatus?: string
  defaultAssignee?: string
  statusLabels?: Record<string, { label: string; color: string }>
  priorityLabels?: Record<string, { label: string; color: string }>
}

export type IntegrationType = 'jira' | 'github' | 'slack'

export interface JiraConfig {
  host: string
  projectKey: string
  email: string
  token: string
}
export interface GitHubConfig {
  owner: string
  repo: string
  token: string
}
export interface SlackConfig {
  webhookUrl: string
  channel: string
}

export interface AppIntegration {
  id: number
  appId: number
  type: IntegrationType
  config: JiraConfig | GitHubConfig | SlackConfig | Record<string, string>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// ─── Navigation state ─────────────────────────────────────────────────────────

export type View =
  | { type: 'apps' }
  | { type: 'spaces'; appId: number }
  | { type: 'tests'; appId: number; spaceId: number; folderId?: number; selectedTestId?: number }
  | { type: 'test-editor'; appId: number; spaceId: number; folderId: number; testId?: number }
  | { type: 'runs'; appId: number }
  | { type: 'run-execution'; appId: number; runId: number }
  | { type: 'settings'; appId: number; section?: 'tests' | 'members' }
  | { type: 'trash'; appId: number; spaceId: number }
  | { type: 'users'; section?: 'users' | 'user-groups' }
  | { type: 'admin-settings' }
