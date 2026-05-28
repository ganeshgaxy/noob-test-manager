/**
 * Cleanup script — removes all spaces, folders, tests (and related data)
 * from the local SQLite database without triggering cascade recursion errors.
 *
 * Run: node scripts/cleanup-data.mjs
 */

import { createClient } from '@libsql/client'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'

const configPath = resolve(process.cwd(), 'noob-sdet.config.json')
let dbUrl = `file:${resolve(process.cwd(), 'noob-sdet.db')}`

if (existsSync(configPath)) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (cfg.url) dbUrl = cfg.url
  } catch { /* ignore parse errors */ }
}

console.log(`Connecting to: ${dbUrl}`)
const client = createClient({ url: dbUrl })

async function run(sql) {
  await client.execute(sql)
}

async function count(table) {
  const res = await client.execute(`SELECT COUNT(*) as n FROM ${table}`)
  return res.rows[0].n
}

async function main() {
  // Turn off FK enforcement so we can delete in any order
  await run('PRAGMA foreign_keys = OFF')

  const tables = [
    'run_step_results',
    'run_results',
    'test_pack_items',
    'bdd_steps',
    'bdd_scenarios',
    'test_steps',
    'test_history',
    'tests',
    'folders',
    'space_members',
    'space_group_access',
    'spaces',
  ]

  console.log('\nBefore cleanup:')
  for (const t of ['spaces', 'folders', 'tests']) {
    console.log(`  ${t}: ${await count(t)}`)
  }

  for (const table of tables) {
    await run(`DELETE FROM ${table}`)
    console.log(`  ✓ Cleared ${table}`)
  }

  await run('PRAGMA foreign_keys = ON')

  console.log('\nAfter cleanup:')
  for (const t of ['spaces', 'folders', 'tests']) {
    console.log(`  ${t}: ${await count(t)}`)
  }

  console.log('\nDone. Restart the server to see the changes.')
  client.close()
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
