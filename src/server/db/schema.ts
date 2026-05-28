import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(), // SSO-only users get a random placeholder
    globalRole: text('global_role', { enum: ['super_admin', 'member'] })
      .notNull()
      .default('member'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    mustChangePassword: integer('must_change_password', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** SSO provider name: 'oidc' | 'github', or null for password-only users */
    ssoProvider: text('sso_provider'),
    /** Unique subject identifier from the SSO provider (e.g. GitHub user ID or OIDC sub) */
    ssoSubject: text('sso_subject'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('users_sso_unique').on(t.ssoProvider, t.ssoSubject)]
)

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // random 32-byte hex token stored as-is
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── API Tokens ───────────────────────────────────────────────────────────────

export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g. "CI Pipeline"
  tokenHash: text('token_hash').notNull().unique(), // SHA-256 of the actual token
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'), // null = never expires
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── App Members ──────────────────────────────────────────────────────────────

export const appMembers = sqliteTable(
  'app_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    appId: integer('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('member'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('app_members_app_user_unique').on(t.appId, t.userId)]
)

// ─── Space Members ────────────────────────────────────────────────────────────

export const spaceMembers = sqliteTable(
  'space_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('member'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('space_members_space_user_unique').on(t.spaceId, t.userId)]
)

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // SHA-256 of the actual token
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'), // null = not yet used
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Apps ────────────────────────────────────────────────────────────────────

export const apps = sqliteTable('apps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Spaces ───────────────────────────────────────────────────────────────────

export const spaces = sqliteTable('spaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Folders (nestable via parent_folder_id) ──────────────────────────────────

export const folders = sqliteTable('folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  spaceId: integer('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  parentFolderId: integer('parent_folder_id'), // self-reference handled at app layer
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').notNull().default(0),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
  trashedAt: text('trashed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Tests ────────────────────────────────────────────────────────────────────

export const tests = sqliteTable('tests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  folderId: integer('folder_id')
    .notNull()
    .references(() => folders.id, { onDelete: 'cascade' }),
  // DB column is 'type'
  type: text('type', { enum: ['traditional', 'bdd'] })
    .notNull()
    .default('traditional'),
  title: text('title').notNull(),
  description: text('description'),
  preconditions: text('preconditions'),
  notes: text('notes'),
  priority: text('priority', {
    enum: ['Lowest', 'Low', 'Medium', 'High', 'Highest', 'Normal'],
  })
    .notNull()
    .default('Medium'),
  status: text('status', {
    enum: ['Draft', 'Deprecated', 'Unverified', 'Faulty', 'Ready', 'Live', 'Archived'],
  })
    .notNull()
    .default('Draft'),
  tags: text('tags'), // JSON array stored as text
  assigneeId: text('assignee_id'),
  estimatedTime: integer('estimated_time'), // minutes
  automationStatus: text('automation_status', {
    enum: ['Automated', 'Not Automated', 'To Be Automated'],
  }),
  // DB column is 'category'
  category: text('category', {
    enum: [
      'Accessibility',
      'Acceptance',
      'Compatibility',
      'Destructive',
      'Performance',
      'Integration',
      'Functional',
      'Regression',
      'Smoke & Sanity',
      'Security',
      'User Interface',
      'Usability',
      'Other',
    ],
  }),
  jiraIssueKey: text('jira_issue_key'),
  internalId: text('internal_id').unique(),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
  trashedAt: text('trashed_at'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Global tags (per app) ────────────────────────────────────────────────────

export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    appId: integer('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('tags_app_name_unique').on(t.appId, t.name)]
)

// ─── Test ↔ Tag join ──────────────────────────────────────────────────────────

export const testTags = sqliteTable(
  'test_tags',
  {
    testId: integer('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('test_tags_unique').on(t.testId, t.tagId)]
)

// ─── Traditional test steps ───────────────────────────────────────────────────

export const testSteps = sqliteTable('test_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id')
    .notNull()
    .references(() => tests.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  action: text('action').notNull(),
  expectedResult: text('expected_result'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── BDD scenarios ────────────────────────────────────────────────────────────

export const bddScenarios = sqliteTable('bdd_scenarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id')
    .notNull()
    .references(() => tests.id, { onDelete: 'cascade' }),
  feature: text('feature'), // Feature: ... label
  scenario: text('scenario').notNull(), // Scenario title
  order: integer('order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── BDD steps ────────────────────────────────────────────────────────────────

export const bddSteps = sqliteTable('bdd_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scenarioId: integer('scenario_id')
    .notNull()
    .references(() => bddScenarios.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['given', 'when', 'then', 'and', 'but'] }).notNull(),
  order: integer('order').notNull().default(0),
  text: text('text').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Test history (audit log) ─────────────────────────────────────────────────

export const testHistory = sqliteTable('test_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id')
    .notNull()
    .references(() => tests.id, { onDelete: 'cascade' }),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedBy: text('changed_by').notNull(),
  changedAt: text('changed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Test runs ────────────────────────────────────────────────────────────────

export const testRuns = sqliteTable('test_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  environment: text('environment'), // e.g. staging, production
  status: text('status', { enum: ['pending', 'running', 'passed', 'failed', 'aborted'] })
    .notNull()
    .default('pending'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Test pack items (what's included in a run) ───────────────────────────────
// scope_type + scope_id defines the selection: a whole space, a folder, or a single test.
// At run-start, these are expanded into run_results rows for each test.

export const testPackItems = sqliteTable('test_pack_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: integer('run_id')
    .notNull()
    .references(() => testRuns.id, { onDelete: 'cascade' }),
  scopeType: text('scope_type', { enum: ['space', 'folder', 'test'] }).notNull(),
  scopeId: integer('scope_id').notNull(),
})

// ─── Run results (one per test per run) ───────────────────────────────────────

export const runResults = sqliteTable('run_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: integer('run_id')
    .notNull()
    .references(() => testRuns.id, { onDelete: 'cascade' }),
  testId: integer('test_id')
    .notNull()
    .references(() => tests.id),
  status: text('status', { enum: ['pending', 'pass', 'fail', 'skip', 'blocked'] })
    .notNull()
    .default('pending'),
  notes: text('notes'),
  executedBy: text('executed_by'),
  executedAt: text('executed_at'),
})

// ─── Run step results (one per step per run) ──────────────────────────────────
// step_type distinguishes between traditional steps and bdd steps.

export const runStepResults = sqliteTable('run_step_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runResultId: integer('run_result_id')
    .notNull()
    .references(() => runResults.id, { onDelete: 'cascade' }),
  stepType: text('step_type', { enum: ['traditional', 'bdd'] }).notNull(),
  stepId: integer('step_id').notNull(), // references test_steps.id or bdd_steps.id
  status: text('status', { enum: ['pending', 'pass', 'fail', 'skip'] })
    .notNull()
    .default('pending'),
  notes: text('notes'),
  executedAt: text('executed_at'),
})

// ─── Custom fields (per-app field definitions) ────────────────────────────────

export const customFields = sqliteTable('custom_fields', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['text', 'number', 'dropdown', 'multiselect', 'date', 'checkbox', 'url'],
  })
    .notNull()
    .default('text'),
  options: text('options'), // JSON array of strings for dropdown/multiselect
  required: integer('required', { mode: 'boolean' }).notNull().default(false),
  defaultValue: text('default_value'),
  order: integer('order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Custom field values (per-test) ──────────────────────────────────────────

export const customFieldValues = sqliteTable('custom_field_values', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id')
    .notNull()
    .references(() => tests.id, { onDelete: 'cascade' }),
  fieldId: integer('field_id')
    .notNull()
    .references(() => customFields.id, { onDelete: 'cascade' }),
  value: text('value'),
})

// ─── App settings (key/value per app) ────────────────────────────────────────

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(), // JSON
})

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Group Members ────────────────────────────────────────────────────────────

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('group_members_group_user_unique').on(t.groupId, t.userId)]
)

// ─── App Group Access ─────────────────────────────────────────────────────────
// Grants a group a role on an App (overrides nothing — additive with appMembers)

export const appGroupAccess = sqliteTable(
  'app_group_access',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    appId: integer('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('viewer'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('app_group_access_app_group_unique').on(t.appId, t.groupId)]
)

// ─── Space Group Access ───────────────────────────────────────────────────────
// Grants a group a role on a Space (overrides app-level role for that space)

export const spaceGroupAccess = sqliteTable(
  'space_group_access',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'member', 'viewer'] })
      .notNull()
      .default('viewer'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('space_group_access_space_group_unique').on(t.spaceId, t.groupId)]
)

// ─── App integrations ─────────────────────────────────────────────────────────

export const appIntegrations = sqliteTable('app_integrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['jira', 'github', 'slack'] }).notNull(),
  config: text('config').notNull().default('{}'), // JSON
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Inferred types ───────────────────────────────────────────────────────────

export type App = typeof apps.$inferSelect
export type NewApp = typeof apps.$inferInsert

export type Space = typeof spaces.$inferSelect
export type NewSpace = typeof spaces.$inferInsert

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert

export type Test = typeof tests.$inferSelect
export type NewTest = typeof tests.$inferInsert

export type TestStep = typeof testSteps.$inferSelect
export type NewTestStep = typeof testSteps.$inferInsert

export type BddScenario = typeof bddScenarios.$inferSelect
export type NewBddScenario = typeof bddScenarios.$inferInsert

export type BddStep = typeof bddSteps.$inferSelect
export type NewBddStep = typeof bddSteps.$inferInsert

export type TestHistory = typeof testHistory.$inferSelect

export type TestRun = typeof testRuns.$inferSelect
export type NewTestRun = typeof testRuns.$inferInsert

export type TestPackItem = typeof testPackItems.$inferSelect
export type NewTestPackItem = typeof testPackItems.$inferInsert

export type RunResult = typeof runResults.$inferSelect
export type NewRunResult = typeof runResults.$inferInsert

export type RunStepResult = typeof runStepResults.$inferSelect
export type NewRunStepResult = typeof runStepResults.$inferInsert

export type CustomField = typeof customFields.$inferSelect
export type NewCustomField = typeof customFields.$inferInsert

export type CustomFieldValue = typeof customFieldValues.$inferSelect
export type NewCustomFieldValue = typeof customFieldValues.$inferInsert

export type AppSetting = typeof appSettings.$inferSelect
export type AppIntegration = typeof appIntegrations.$inferSelect

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type TestTag = typeof testTags.$inferSelect

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type ApiToken = typeof apiTokens.$inferSelect
export type NewApiToken = typeof apiTokens.$inferInsert

export type AppMember = typeof appMembers.$inferSelect
export type NewAppMember = typeof appMembers.$inferInsert

export type SpaceMember = typeof spaceMembers.$inferSelect
export type NewSpaceMember = typeof spaceMembers.$inferInsert

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert

export type Group = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert

export type GroupMember = typeof groupMembers.$inferSelect
export type NewGroupMember = typeof groupMembers.$inferInsert

export type AppGroupAccess = typeof appGroupAccess.$inferSelect
export type NewAppGroupAccess = typeof appGroupAccess.$inferInsert

export type SpaceGroupAccess = typeof spaceGroupAccess.$inferSelect
export type NewSpaceGroupAccess = typeof spaceGroupAccess.$inferInsert
