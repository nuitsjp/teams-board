# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are running on Windows. Bash isn't available directly, so please use Bash (via pwsh:\*).

## Primary Directive

- Think in English, interact with the user in Japanese.
- All text, comments, and documentation must be written in Japanese.
- Class names, function names, and other identifiers must be written in English.
- Can execute GitHub CLI/Azure CLI. Will execute and verify them personally
  whenever possible.
- Do not modify files directly on the main branch.
- Create a branch with an appropriate name and switch to it before making any modifications.

## Common Commands

```bash
pnpm install              # Install dependencies
pnpm run dev              # Start dev server (http://localhost:5173, with HMR)
pnpm run build            # Production build (output to dist/)
pnpm test                 # Run unit tests with Vitest
pnpm run test:watch       # Vitest watch mode
pnpm run test:coverage    # Run tests with coverage
pnpm run lint             # ESLint static analysis
pnpm run format           # Prettier code formatting

# E2E tests (Playwright)
pnpm exec playwright install   # First time only: install browsers
pnpm run test:e2e              # Headless execution
pnpm run test:e2e:headed       # Run with browser visible

# Run a single test file
pnpm vitest run tests/logic/csv-transformer.test.js
pnpm vitest run tests/react/pages/DashboardPage.test.jsx
```

## Tech Stack

- **React 19** + **Vite** — JSX (no TypeScript)
- **react-router-dom** (HashRouter) — `#/` based routing
- **Tailwind CSS 4** — Utility-first CSS
- **PapaParse** — Teams attendance report CSV (UTF-16LE) parser
- **Vitest** + **React Testing Library** — Unit tests in jsdom environment
- **Playwright** — E2E tests (Chromium only)
- **pnpm** — Package manager (`packageManager: pnpm@10.27.0`)

## Architecture

A dashboard SPA that aggregates and visualizes Microsoft Teams attendance report CSVs. Hosted on Azure Blob Storage static site hosting, operating without a backend server.

### Layer Structure

| Layer      | Path              | Responsibility                                                                     |
| ---------- | ----------------- | ---------------------------------------------------------------------------------- |
| Pages      | `src/pages/`      | Per-screen data fetching and display (Dashboard, MemberDetail, GroupDetail, Admin) |
| Components | `src/components/` | Reusable UI parts (FileDropZone, GroupList, MemberList, SummaryCard, etc.)         |
| Hooks      | `src/hooks/`      | State management (`useAuth` = SAS token auth, `useFileQueue` = file queue)         |
| Services   | `src/services/`   | I/O and domain logic (see below)                                                   |
| Config     | `src/config/`     | Environment variable based config (`APP_CONFIG.blobBaseUrl`)                       |

### Services Layer Roles

- **CsvTransformer** — Parses Teams attendance report CSV (UTF-16LE/TSV), producing session records and index merge inputs. Uses first 8 hex digits of SHA-256 for ID generation
- **IndexMerger** — Immutably updates groups/members in `index.json` (duplicate sessionIds are skipped with warnings)
- **DataFetcher** — Fetches `data/index.json` and `data/sessions/*.json` from the static site
- **BlobWriter** — PUTs to Azure Blob Storage with SAS token

### Routing

- `#/` — Dashboard overview
- `#/groups/:groupId` — Group detail
- `#/members/:memberId` — Member detail
- `#/admin` — Admin page (visible only when SAS token authenticated)

### Data Flow

- Read path: Static Website Endpoint → `data/index.json` (with cache buster) + `data/sessions/<id>.json` (immutable)
- Write path: CSV drop → CsvTransformer → IndexMerger → BlobWriter (PUT with SAS)
- SAS token is extracted from URL query `token` on first load, then immediately removed via `history.replaceState` and held in memory only

### Development Data

Development JSON fixtures are placed in `dev-fixtures/data/`. The Vite plugin `serveDevFixtures` (in vite.config.js) serves `/data/` requests from this directory on the dev server. Not included in `public/` since Azure Blob Storage serves this data in production.

### Test Structure

- `tests/data/` — DataFetcher, BlobWriter, IndexMerger tests
- `tests/logic/` — CsvTransformer tests
- `tests/react/` — React component, page, and hook tests
- `tests/fixtures/` — Test CSV fixtures
- `tests/vitest.setup.js` — webcrypto polyfill + jest-dom setup
- `e2e/` — Playwright E2E tests (dashboard, admin)

### CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs tests and lint in parallel on push, then deploys to Azure Blob Storage. `main` → prod environment, other branches → dev environment. Uses OIDC authentication.

### Environment Variables (Build Time)

- `VITE_APP_TITLE` — App title (default: 'Teams Board')
- `VITE_BLOB_BASE_URL` — Blob Service Endpoint URL
