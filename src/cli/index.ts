import { Command } from 'commander'
import { startServer } from '../server/index.js'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import open from 'open'
import { initDb, db } from '../server/db/client.js'
import { users } from '../server/db/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientDir = resolve(__dirname, 'client')

const program = new Command()

program
  .name('noob-sdet')
  .description('Test manager — manage apps, spaces, test cases and runs from the CLI')
  .version('0.1.0')

// ─── start ────────────────────────────────────────────────────────────────────

program
  .command('start', { isDefault: true })
  .description('Start the noob-sdet server and open the UI')
  .option('-p, --port <port>', 'port to run on', '3000')
  .action(async (options) => {
    const port = Number(options.port)
    console.log('\n  noob-sdet starting…\n')
    await startServer(port, clientDir)
    const url = `http://localhost:${port}`
    console.log(`  Running at ${url}\n`)
    await open(url)
  })

// ─── Helper: JSON fetch against running server ────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit, port = 3000): Promise<T> {
  const res = await fetch(`http://localhost:${port}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await res.json()) as T
  if (!res.ok) {
    const err = body as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return body
}

// ─── app ──────────────────────────────────────────────────────────────────────

const appCmd = program.command('app').description('Manage apps')

appCmd
  .command('list')
  .description('List all apps')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (opts) => {
    const apps = await apiFetch<Array<{ id: number; name: string; description: string | null }>>(
      '/api/apps',
      undefined,
      Number(opts.port)
    )
    if (!apps.length) {
      console.log('No apps.')
      return
    }
    apps.forEach((a) =>
      console.log(`  [${a.id}] ${a.name}${a.description ? ` — ${a.description}` : ''}`)
    )
  })

appCmd
  .command('create <name>')
  .description('Create a new app')
  .option('-d, --description <desc>', 'Optional description')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (name, opts) => {
    const app = await apiFetch<{ id: number; name: string }>(
      '/api/apps',
      {
        method: 'POST',
        body: JSON.stringify({ name, description: opts.description }),
      },
      Number(opts.port)
    )
    console.log(`  Created app [${app.id}] ${app.name}`)
  })

appCmd
  .command('delete <id>')
  .description('Delete an app by ID')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (id, opts) => {
    await apiFetch(`/api/apps/${id}`, { method: 'DELETE' }, Number(opts.port))
    console.log(`  Deleted app ${id}`)
  })

// ─── space ────────────────────────────────────────────────────────────────────

const spaceCmd = program.command('space').description('Manage spaces')

spaceCmd
  .command('list <appId>')
  .description('List spaces for an app')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, opts) => {
    const spaces = await apiFetch<Array<{ id: number; name: string; description: string | null }>>(
      `/api/apps/${appId}/spaces`,
      undefined,
      Number(opts.port)
    )
    if (!spaces.length) {
      console.log('No spaces.')
      return
    }
    spaces.forEach((s) =>
      console.log(`  [${s.id}] ${s.name}${s.description ? ` — ${s.description}` : ''}`)
    )
  })

spaceCmd
  .command('create <appId> <name>')
  .description('Create a space inside an app')
  .option('-d, --description <desc>', 'Optional description')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, name, opts) => {
    const space = await apiFetch<{ id: number; name: string }>(
      `/api/apps/${appId}/spaces`,
      {
        method: 'POST',
        body: JSON.stringify({ name, description: opts.description }),
      },
      Number(opts.port)
    )
    console.log(`  Created space [${space.id}] ${space.name}`)
  })

spaceCmd
  .command('delete <appId> <spaceId>')
  .description('Delete a space')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, spaceId, opts) => {
    await apiFetch(`/api/apps/${appId}/spaces/${spaceId}`, { method: 'DELETE' }, Number(opts.port))
    console.log(`  Deleted space ${spaceId}`)
  })

// ─── folder ───────────────────────────────────────────────────────────────────

const folderCmd = program.command('folder').description('Manage folders')

folderCmd
  .command('list <spaceId>')
  .description('List folders in a space')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (spaceId, opts) => {
    const folders = await apiFetch<
      Array<{ id: number; name: string; parentFolderId: number | null }>
    >(`/api/spaces/${spaceId}/folders`, undefined, Number(opts.port))
    if (!folders.length) {
      console.log('No folders.')
      return
    }
    folders.forEach((f) =>
      console.log(
        `  [${f.id}] ${f.name}${f.parentFolderId ? ` (parent: ${f.parentFolderId})` : ''}`
      )
    )
  })

folderCmd
  .command('create <spaceId> <name>')
  .description('Create a folder inside a space')
  .option('--parent <parentId>', 'Parent folder ID for nesting')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (spaceId, name, opts) => {
    const folder = await apiFetch<{ id: number; name: string }>(
      `/api/spaces/${spaceId}/folders`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          parentFolderId: opts.parent ? Number(opts.parent) : undefined,
        }),
      },
      Number(opts.port)
    )
    console.log(`  Created folder [${folder.id}] ${folder.name}`)
  })

// ─── test ─────────────────────────────────────────────────────────────────────

const testCmd = program.command('test').description('Manage test cases')

testCmd
  .command('list <folderId>')
  .description('List tests in a folder')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (folderId, opts) => {
    const tests = await apiFetch<
      Array<{ id: number; type: string; title: string; status: string; priority: string }>
    >(`/api/folders/${folderId}/tests`, undefined, Number(opts.port))
    if (!tests.length) {
      console.log('No tests.')
      return
    }
    tests.forEach((t) =>
      console.log(`  [${t.id}] [${t.type}] ${t.title} — ${t.status} / ${t.priority}`)
    )
  })

testCmd
  .command('create <folderId> <title>')
  .description('Create a test case')
  .option('--type <type>', 'traditional or bdd', 'traditional')
  .option('--priority <p>', 'low|medium|high|critical', 'medium')
  .option('--by <user>', 'Creator identity', 'cli')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (folderId, title, opts) => {
    const test = await apiFetch<{ id: number; title: string }>(
      `/api/folders/${folderId}/tests`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          type: opts.type,
          priority: opts.priority,
          createdBy: opts.by,
        }),
      },
      Number(opts.port)
    )
    console.log(`  Created test [${test.id}] ${test.title}`)
  })

testCmd
  .command('show <folderId> <testId>')
  .description('Show a test with its steps/scenarios')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (folderId, testId, opts) => {
    const test = await apiFetch<Record<string, unknown>>(
      `/api/folders/${folderId}/tests/${testId}`,
      undefined,
      Number(opts.port)
    )
    console.log(JSON.stringify(test, null, 2))
  })

testCmd
  .command('delete <folderId> <testId>')
  .description('Delete a test')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (folderId, testId, opts) => {
    await apiFetch(
      `/api/folders/${folderId}/tests/${testId}`,
      { method: 'DELETE' },
      Number(opts.port)
    )
    console.log(`  Deleted test ${testId}`)
  })

// ─── run ──────────────────────────────────────────────────────────────────────

const runCmd = program.command('run').description('Manage test runs')

runCmd
  .command('list <appId>')
  .description('List runs for an app')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, opts) => {
    const runs = await apiFetch<
      Array<{ id: number; name: string; status: string; environment: string | null }>
    >(`/api/apps/${appId}/runs`, undefined, Number(opts.port))
    if (!runs.length) {
      console.log('No runs.')
      return
    }
    runs.forEach((r) =>
      console.log(
        `  [${r.id}] ${r.name} — ${r.status}${r.environment ? ` (${r.environment})` : ''}`
      )
    )
  })

runCmd
  .command('create <appId> <name>')
  .description('Create a run from all spaces in an app')
  .option('--env <environment>', 'Environment label')
  .option('--by <user>', 'Creator identity', 'cli')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, name, opts) => {
    const port = Number(opts.port)
    // Collect all spaces and use them as pack
    const spaces = await apiFetch<Array<{ id: number }>>(
      `/api/apps/${appId}/spaces`,
      undefined,
      port
    )
    if (!spaces.length) {
      console.log('No spaces found — add spaces first.')
      return
    }
    const pack = spaces.map((s) => ({ scopeType: 'space', scopeId: s.id }))
    const run = await apiFetch<{ id: number; name: string }>(
      `/api/apps/${appId}/runs`,
      {
        method: 'POST',
        body: JSON.stringify({ name, environment: opts.env, createdBy: opts.by, pack }),
      },
      port
    )
    console.log(`  Created run [${run.id}] ${run.name}`)
  })

runCmd
  .command('report <appId> <runId>')
  .description('Print a summary report for a run')
  .option('-p, --port <port>', 'server port', '3000')
  .action(async (appId, runId, opts) => {
    const report = await apiFetch<{
      run: { name: string; status: string }
      summary: {
        total: number
        pass: number
        fail: number
        skip: number
        blocked: number
        pending: number
        passRate: number
      }
    }>(`/api/apps/${appId}/runs/${runId}/report`, undefined, Number(opts.port))
    const { run, summary } = report
    console.log(`\n  Run: ${run.name} [${run.status}]`)
    console.log(`  ─────────────────────────────`)
    console.log(`  Total:   ${summary.total}`)
    console.log(`  Pass:    ${summary.pass}`)
    console.log(`  Fail:    ${summary.fail}`)
    console.log(`  Skip:    ${summary.skip}`)
    console.log(`  Blocked: ${summary.blocked}`)
    console.log(`  Pending: ${summary.pending}`)
    console.log(`  Pass rate: ${summary.passRate}%\n`)
  })

// ─── user ─────────────────────────────────────────────────────────────────────

const userCmd = program.command('user').description('Manage users')

userCmd
  .command('create')
  .description('Create a new user directly in the database (no server required)')
  .requiredOption('-e, --email <email>', 'User email')
  .requiredOption('-n, --name <name>', 'User display name')
  .requiredOption('-p, --password <password>', 'Password (min 8 chars)')
  .option('-r, --role <role>', 'Global role: super_admin | member', 'member')
  .action(async (opts) => {
    if (opts.password.length < 8) {
      console.error('  ✖ Password must be at least 8 characters')
      process.exit(1)
    }
    if (!['super_admin', 'member'].includes(opts.role)) {
      console.error('  ✖ Role must be super_admin or member')
      process.exit(1)
    }
    await initDb()
    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(opts.password, 12)
    try {
      const [user] = await db
        .insert(users)
        .values({
          email: (opts.email as string).toLowerCase(),
          name: opts.name as string,
          passwordHash,
          globalRole: opts.role as 'super_admin' | 'member',
        })
        .returning()
      console.log(`\n  ✔ Created user [${user.id}] ${user.email} (${user.globalRole})\n`)
    } catch {
      console.error('  ✖ Email already in use')
      process.exit(1)
    }
    process.exit(0)
  })

userCmd
  .command('list')
  .description('List all users')
  .action(async () => {
    await initDb()
    const all = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        globalRole: users.globalRole,
        isActive: users.isActive,
      })
      .from(users)
    if (!all.length) {
      console.log('  No users found.')
      process.exit(0)
    }
    all.forEach(
      (u: { id: number; email: string; name: string; globalRole: string; isActive: boolean }) =>
        console.log(
          `  [${u.id}] ${u.email}  ${u.name}  (${u.globalRole})${u.isActive ? '' : '  [disabled]'}`
        )
    )
    process.exit(0)
  })

program.parse()
