import { createClient } from '@libsql/client'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'
import { readDbConfig, type DbConfig } from './config.js'

// ESM live binding — all importers always see the current value after reinit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let db: any = null
export let currentDbConfig: DbConfig = { type: 'sqlite', url: '' }

/** Active pg Pool — kept so we can drain it on re-init */
let pgPool: pg.Pool | null = null

/**
 * Initialises (or re-initialises) the database connection.
 * Pass an explicit config to switch databases at runtime; omit to read from
 * the config file / env vars.
 */
export async function initDb(config?: DbConfig): Promise<void> {
  const resolvedConfig = config ?? (await readDbConfig())
  currentDbConfig = resolvedConfig

  if (resolvedConfig.type === 'postgres') {
    // Drain the old pool before creating a new one
    if (pgPool) {
      await pgPool.end().catch(() => {})
      pgPool = null
    }

    // pg-connection-string warns when sslmode is 'prefer', 'require', or 'verify-ca'
    // because it already treats them as 'verify-full'. Normalise to 'verify-full'
    // explicitly so the warning is suppressed without changing the effective behaviour.
    const pgUrl = resolvedConfig.url.replace(
      /\bsslmode=(prefer|require|verify-ca)\b/gi,
      'sslmode=verify-full'
    )

    pgPool = new pg.Pool({
      connectionString: pgUrl,
      max: resolvedConfig.poolMax ?? 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true, // don't keep the process alive when pool is idle
    })

    // Surface pool errors instead of letting them crash the process silently
    pgPool.on('error', (err) => {
      console.error('[pg pool] idle client error:', err.message)
    })

    // Verify the pool works (throws if credentials are wrong)
    const probe = await pgPool.connect()
    probe.release()

    db = drizzlePg(pgPool, { schema })

    // Create schema if not already present (idempotent DDL — runs sequentially)
    const pgDDL = [
      `CREATE TABLE IF NOT EXISTS apps (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'traditional' CHECK(type IN ('traditional','bdd')),
        title TEXT NOT NULL,
        description TEXT,
        preconditions TEXT,
        notes TEXT,
        priority TEXT NOT NULL DEFAULT 'Medium',
        status TEXT NOT NULL DEFAULT 'Draft',
        tags TEXT,
        assignee_id TEXT,
        estimated_time INTEGER,
        automation_status TEXT,
        category TEXT,
        jira_issue_key TEXT,
        internal_id TEXT UNIQUE,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        is_trashed INTEGER NOT NULL DEFAULT 0,
        trashed_at TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS test_steps (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        "order" INTEGER NOT NULL DEFAULT 0,
        action TEXT NOT NULL,
        expected_result TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS bdd_scenarios (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        feature TEXT,
        scenario TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS bdd_steps (
        id SERIAL PRIMARY KEY,
        scenario_id INTEGER NOT NULL REFERENCES bdd_scenarios(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('given','when','then','and','but')),
        "order" INTEGER NOT NULL DEFAULT 0,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS test_history (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS test_runs (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        environment TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','passed','failed','aborted')),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS test_pack_items (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL CHECK(scope_type IN ('space','folder','test')),
        scope_id INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS run_results (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        test_id INTEGER NOT NULL REFERENCES tests(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pass','fail','skip','blocked')),
        notes TEXT,
        executed_by TEXT,
        executed_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS run_step_results (
        id SERIAL PRIMARY KEY,
        run_result_id INTEGER NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
        step_type TEXT NOT NULL CHECK(step_type IN ('traditional','bdd')),
        step_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pass','fail','skip')),
        notes TEXT,
        executed_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS custom_fields (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','number','dropdown','multiselect','date','checkbox','url')),
        options TEXT,
        required INTEGER NOT NULL DEFAULT 0,
        default_value TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS custom_field_values (
        id SERIAL PRIMARY KEY,
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
        value TEXT,
        UNIQUE(test_id, field_id)
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(app_id, key)
      )`,
      `CREATE TABLE IF NOT EXISTS app_integrations (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('jira','github','slack')),
        config TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(app_id, type)
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        global_role TEXT NOT NULL DEFAULT 'member' CHECK(global_role IN ('super_admin','member')),
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        sso_provider TEXT,
        sso_subject TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS api_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS app_members (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(app_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS space_members (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(space_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(group_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS app_group_access (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','member','viewer')),
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(app_id, group_id)
      )`,
      `CREATE TABLE IF NOT EXISTS space_group_access (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','member','viewer')),
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(space_id, group_id)
      )`,
      `CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(app_id, name)
      )`,
      `CREATE TABLE IF NOT EXISTS test_tags (
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (test_id, tag_id)
      )`,
      `CREATE TABLE IF NOT EXISTS global_tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`,
      `CREATE TABLE IF NOT EXISTS space_tags (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(space_id, name)
      )`,
    ]
    // Run all DDL in one transaction — single round-trip instead of 16
    const pgClient = await pgPool.connect()
    try {
      await pgClient.query('BEGIN')
      for (const sql of pgDDL) await pgClient.query(sql)
      await pgClient.query('COMMIT')
    } catch (err) {
      await pgClient.query('ROLLBACK')
      throw err
    } finally {
      pgClient.release()
    }

    // Migrations for existing Postgres databases — each statement is idempotent
    const pgMigClient = await pgPool.connect()
    const pgMigrate = async (sql: string) => pgMigClient.query(sql).catch(() => {})
    try {
      // users
      await pgMigrate(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider TEXT`)
      await pgMigrate(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_subject TEXT`)
      // folders
      await pgMigrate(
        `ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_trashed INTEGER NOT NULL DEFAULT 0`
      )
      await pgMigrate(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS trashed_at TEXT`)
      // tests — new columns
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS estimated_time INTEGER`)
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS automation_status TEXT`)
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS category TEXT`)
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS jira_issue_key TEXT`)
      await pgMigrate(
        `ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_trashed INTEGER NOT NULL DEFAULT 0`
      )
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS trashed_at TEXT`)
      // internal_id — add then index separately (ADD COLUMN UNIQUE can fail if rows exist)
      await pgMigrate(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS internal_id TEXT`)
      await pgMigrate(
        `CREATE UNIQUE INDEX IF NOT EXISTS tests_internal_id_unique ON tests(internal_id)`
      )
      // tags + test_tags — safe even if created by the DDL block above
      await pgMigrate(`CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(app_id, name)
      )`)
      await pgMigrate(`CREATE TABLE IF NOT EXISTS test_tags (
        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (test_id, tag_id)
      )`)
      await pgMigrate(`CREATE TABLE IF NOT EXISTS global_tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )`)
      await pgMigrate(`CREATE TABLE IF NOT EXISTS space_tags (
        id SERIAL PRIMARY KEY,
        space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(space_id, name)
      )`)
    } finally {
      pgMigClient.release()
    }
    return
  }

  // SQLite (local file) or Turso — both use the libsql client
  const client = createClient({
    url: resolvedConfig.url,
    ...(resolvedConfig.token ? { authToken: resolvedConfig.token } : {}),
  })
  db = drizzleLibsql(client, { schema })

  // Concurrency pragmas — applied before schema DDL
  // journal_mode=WAL MUST run outside a transaction (libsql batch() is transactional)
  // so we execute it alone first, then batch the rest.
  const isLocal = resolvedConfig.url.startsWith('file:') || resolvedConfig.url === ':memory:'
  if (isLocal) {
    // None of these pragmas can run inside a transaction — execute each standalone
    await client.execute(`PRAGMA journal_mode=WAL`)
    await client.execute(`PRAGMA busy_timeout=5000`)
    await client.execute(`PRAGMA cache_size=-65536`)
    await client.execute(`PRAGMA synchronous=NORMAL`)
  } else {
    // Turso (remote) — WAL is managed server-side; only set timeout
    await client.execute(`PRAGMA busy_timeout=5000`)
  }

  await client.batch([
    `CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      parent_folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'traditional' CHECK(type IN ('traditional','bdd')),
      title TEXT NOT NULL,
      description TEXT,
      preconditions TEXT,
      notes TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Draft',
      tags TEXT,
      assignee_id TEXT,
      estimated_time INTEGER,
      automation_status TEXT,
      category TEXT,
      jira_issue_key TEXT,
      internal_id TEXT UNIQUE,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(app_id, name)
    )`,

    `CREATE TABLE IF NOT EXISTS test_tags (
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (test_id, tag_id)
    )`,

    `CREATE TABLE IF NOT EXISTS test_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL DEFAULT 0,
      action TEXT NOT NULL,
      expected_result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS bdd_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      feature TEXT,
      scenario TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS bdd_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER NOT NULL REFERENCES bdd_scenarios(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('given','when','then','and','but')),
      "order" INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS test_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      environment TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','passed','failed','aborted')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS test_pack_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL CHECK(scope_type IN ('space','folder','test')),
      scope_id INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS run_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      test_id INTEGER NOT NULL REFERENCES tests(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pass','fail','skip','blocked')),
      notes TEXT,
      executed_by TEXT,
      executed_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS run_step_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_result_id INTEGER NOT NULL REFERENCES run_results(id) ON DELETE CASCADE,
      step_type TEXT NOT NULL CHECK(step_type IN ('traditional','bdd')),
      step_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pass','fail','skip')),
      notes TEXT,
      executed_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','number','dropdown','multiselect','date','checkbox','url')),
      options TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      value TEXT,
      UNIQUE(test_id, field_id)
    )`,

    `CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      UNIQUE(app_id, key)
    )`,

    `CREATE TABLE IF NOT EXISTS app_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('jira','github','slack')),
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(app_id, type)
    )`,

    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      global_role TEXT NOT NULL DEFAULT 'member' CHECK(global_role IN ('super_admin','member')),
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      sso_provider TEXT,
      sso_subject TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS app_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(app_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS space_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(space_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS app_group_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','member','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(app_id, group_id)
    )`,

    `CREATE TABLE IF NOT EXISTS space_group_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','member','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(space_id, group_id)
    )`,
  ])

  // Migrations for existing databases — silently ignored if column already exists
  await client
    .execute(`ALTER TABLE tests ADD COLUMN is_trashed INTEGER NOT NULL DEFAULT 0`)
    .catch(() => {})
  await client.execute(`ALTER TABLE tests ADD COLUMN trashed_at TEXT`).catch(() => {})
  await client
    .execute(`ALTER TABLE folders ADD COLUMN is_trashed INTEGER NOT NULL DEFAULT 0`)
    .catch(() => {})
  await client.execute(`ALTER TABLE folders ADD COLUMN trashed_at TEXT`).catch(() => {})
  // SSO columns
  await client.execute(`ALTER TABLE users ADD COLUMN sso_provider TEXT`).catch(() => {})
  await client.execute(`ALTER TABLE users ADD COLUMN sso_subject TEXT`).catch(() => {})
  // TestMu import fields
  await client.execute(`ALTER TABLE tests ADD COLUMN estimated_time INTEGER`).catch(() => {})
  await client.execute(`ALTER TABLE tests ADD COLUMN automation_status TEXT`).catch(() => {})
  await client.execute(`ALTER TABLE tests ADD COLUMN category TEXT`).catch(() => {})
  await client.execute(`ALTER TABLE tests ADD COLUMN jira_issue_key TEXT`).catch(() => {})
  await client.execute(`ALTER TABLE tests ADD COLUMN internal_id TEXT`).catch(() => {})
  await client
    .execute(`CREATE UNIQUE INDEX IF NOT EXISTS tests_internal_id_unique ON tests(internal_id)`)
    .catch(() => {})
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(app_id, name)
  )`
    )
    .catch(() => {})
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS test_tags (
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (test_id, tag_id)
  )`
    )
    .catch(() => {})
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS global_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`
    )
    .catch(() => {})
  await client
    .execute(
      `CREATE TABLE IF NOT EXISTS space_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(space_id, name)
  )`
    )
    .catch(() => {})

  // If the tests table still has the old CHECK constraints on priority/status,
  // recreate it without them. SQLite cannot ALTER CHECK constraints.
  const schemaRes = await client.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'`
  )
  const tablesSql = (schemaRes.rows[0]?.[0] ?? '') as string
  if (tablesSql.includes("'low','medium','high','critical'")) {
    // legacy_alter_table prevents SQLite from rewriting FK references in other
    // tables (test_tags, test_steps, etc.) when we rename the tests table.
    // legacy_alter_table = ON prevents SQLite from rewriting FK references in
    // dependent tables (test_steps, run_results, etc.) when we rename.
    await client.execute(`PRAGMA legacy_alter_table = ON`)
    await client.execute(`PRAGMA foreign_keys = OFF`)
    await client.execute(`ALTER TABLE tests RENAME TO tests_old`)
    await client.execute(`CREATE TABLE tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'traditional',
      title TEXT NOT NULL,
      description TEXT,
      preconditions TEXT,
      notes TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Draft',
      tags TEXT,
      assignee_id TEXT,
      estimated_time INTEGER,
      automation_status TEXT,
      category TEXT,
      jira_issue_key TEXT,
      internal_id TEXT,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      trashed_at TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    await client.execute(`INSERT INTO tests (
      id, folder_id, type, title, description, preconditions, notes,
      priority, status, tags, assignee_id,
      estimated_time, automation_status, category,
      jira_issue_key, internal_id,
      is_trashed, trashed_at, created_by, updated_by, created_at, updated_at
    ) SELECT
      id, folder_id, type, title, description, preconditions, notes,
      priority, status, tags, assignee_id,
      estimated_time, automation_status, category,
      jira_issue_key, internal_id,
      is_trashed, trashed_at, created_by, updated_by, created_at, updated_at
    FROM tests_old`)
    await client.execute(`DROP TABLE tests_old`)
    await client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS tests_internal_id_unique ON tests(internal_id)`
    )
    await client.execute(`PRAGMA foreign_keys = ON`)
    await client.execute(`PRAGMA legacy_alter_table = OFF`)
  }
}
