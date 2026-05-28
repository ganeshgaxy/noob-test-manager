# noob-test-manager

![License](https://img.shields.io/badge/license-MIT-blue) ![Version](https://img.shields.io/badge/version-0.1.0-green)

A lightweight, self-hosted test case management tool for SDETs. Run it as a CLI, it spins up a local server and opens a browser UI — all data stored in a SQLite file in your project directory. No SaaS subscription, no data leaving your machine.

---

## Install

```bash
npm install -g @ganeshgaxy/noob-test-manager
```

Or run without installing globally:

```bash
npm install @ganeshgaxy/noob-test-manager
npx @ganeshgaxy/noob-test-manager start
```

Then open `http://localhost:3000`. To use a different port:

```bash
noob-sdet start --port 4000
```

A `noob-sdet.db` file is created in your current directory on first run — that's your entire database.

---

## How to Use

### 1. Create an App

From the home screen click **New App**. Apps are the top-level container — think "product" or "project".

### 2. Create a Space

Inside an app, create a Space. A space maps to a feature area, squad or test suite. Each space has its own folder tree, tags and member access.

### 3. Organise with Folders

Folders nest infinitely. Use them to mirror your feature structure or test pyramid layers (Smoke / Regression / E2E).

### 4. Write Tests

Click **New Test** inside a folder. Choose between:

- **Traditional** — numbered action + expected result steps
- **BDD / Gherkin** — Given / When / Then scenarios with multiple scenarios per test

Fill in the right-hand metadata panel: category, priority, status, automation status, estimated time, Jira key, assignee, tags.

### 5. Create a Run

Go to **Runs** in the sidebar → **New Run**. Give it a name and an optional environment label (e.g. `staging`). Click **Add Tests** to pick spaces, folders or individual tests.

### 6. Execute

Click **Start** on the run. Tests are grouped by folder. Click a test to open the step-by-step panel on the right. Mark steps individually or use the quick **Pass / Fail / Skip / Block** buttons on each row. Use **bulk select** (checkbox on hover) to mark many tests at once.

### 7. Filter & Sort

Use the filter bar above the test list to narrow by **Status**, **Priority**, **Category** or **Tags**. Toggle the **Folders A→Z** sort to reorder accordion groups.

### 8. Import from TestMu

In a Space, click **Import → Import from TestMu**. Enter your TestMu host URL, email and API token, then pick a project. The import runs server-side with a live progress stream and preserves the full folder hierarchy, test steps, BDD scenarios, priorities, statuses, tags and Jira links.

---

## Features

### 🗂 Test Organisation

- **Apps** → **Spaces** → **Folders** → **Tests** hierarchy
- Traditional step-by-step tests and BDD/Gherkin scenarios
- Rich text editor for descriptions, preconditions, step actions and expected results
- Full metadata per test: category, priority, status, automation status, estimated time, Jira issue key, assignee, tags

### 🏃 Test Runs

- Create named runs with optional environment label
- Add tests by selecting whole spaces, folders or individual tests
- Mark each test as **Pass / Fail / Skip / Blocked** — with per-step granularity
- Bulk mark multiple tests at once
- Filter results by status, priority, category and tags
- Sort folder groups alphabetically
- Live pass-rate progress bar and summary stats (total / pass / fail / skip / block / pending)
- Reset individual tests, folders or the whole run
- Remove tests from a run without deleting the test

### 📋 Test Detail Panel

- Step-by-step execution view slides in on the right when you click a test in a run
- Mark individual BDD scenario steps or traditional steps independently
- Notes field per result for recording observations

### 🔖 Tagging

- Global tags (shared across all apps) and space-scoped tags
- Tag picker with search, creation and coloured pills
- Tags displayed inline in test list rows and filterable in runs

### 🔄 TestMu Import

- Import entire projects from [TestMu](https://testmu.io) directly into a space
- Preserves folder structure, test steps, BDD scenarios, priorities, statuses, tags, Jira links and test categories
- Server-side streaming import with live progress feed

### 👥 Users & Access Control

- User accounts with email/password auth
- Global roles: `super_admin` and `member`
- Per-app and per-space roles: `admin`, `member`, `viewer`
- User groups for bulk permission management
- API tokens for programmatic access
- SSO support (configurable)

### 🎨 Themes

- Four built-in presets: **Dark** (default), **Purple Night**, **Light**, **Navy**
- Full custom theme editor — every colour, font and radius is configurable
- Theme persisted per-browser

### ⚙️ Settings

- Custom fields per app (text, number, dropdown, multi-select, date, checkbox, URL)
- Integrations: Jira, GitHub, Slack (configurable webhooks)
- Tag management at app and space level

### 🗑 Trash

- Soft-delete for tests and folders
- Restore or permanently delete from the trash view

---

## CLI Reference

The CLI can manage everything headlessly — useful for scripting or CI pipelines.

### Apps

```bash
noob-sdet app list
noob-sdet app create "My App" --description "Optional description"
noob-sdet app delete <appId>
```

### Spaces

```bash
noob-sdet space list <appId>
noob-sdet space create <appId> "My Space" --description "Optional"
noob-sdet space delete <appId> <spaceId>
```

### Folders

```bash
noob-sdet folder list <spaceId>
noob-sdet folder create <spaceId> "My Folder"
```

### Tests

```bash
noob-sdet test list <folderId>
noob-sdet test create <folderId> "Test title" --priority High --status Ready
noob-sdet test show <folderId> <testId>
noob-sdet test delete <folderId> <testId>
```

### Runs

```bash
noob-sdet run list <appId>
noob-sdet run create <appId> "Sprint 42 Regression"
```

---

## Data Storage

Everything lives in a single SQLite file:

```
./noob-sdet.db
```

Back it up with a file copy. Restore by putting the file back and restarting.

---

## Development

```bash
git clone https://github.com/ganeshgaxy/noob-test-manager.git
cd noob-test-manager
npm install

# Run client + server in parallel
npm run dev:client   # Vite dev server at :5173
npm run dev:server   # Hono API server at :3000

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Tech Stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| UI       | React 18, Vite, Tailwind CSS v4, Radix UI, Phosphor Icons, Tiptap |
| Server   | Hono on Node.js                                                   |
| Database | SQLite via Drizzle ORM                                            |
| Auth     | bcrypt password hashing, API tokens                               |
| CLI      | Commander.js                                                      |
| Testing  | Vitest, Testing Library                                           |

---

## Contributing

Contributions are welcome. Please open a pull request — direct pushes to `main` are restricted.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a PR

---

## License

MIT
