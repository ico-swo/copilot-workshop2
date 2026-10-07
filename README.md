# Astra Parts Hub

Spare parts catalogue, supplier master data and procurement workflow — the reference
application for the **GitHub Copilot Refreshment Workshop, Part 2 (hands-on labs)** at
Astra Otoparts.

A full-stack application: a layered REST API and an interactive dashboard with full
create, read, update and delete. No runtime dependencies and no build step.

## Run it

Requires **Node.js 24 or later**.

```bash
npm install
npm run seed     # sample data plus three development API keys
npm run dev      # http://localhost:3000
npm test         # 67 passing, 1 skipped until Lab 1 is complete
```

Open `http://localhost:3000` and paste `aoph_operator_workshop_key` into the **API key**
field to unlock create, edit and delete.

## API keys

| Role | Key | Can do |
|---|---|---|
| viewer | `aoph_viewer_workshop_key` | Read |
| operator | `aoph_operator_workshop_key` | Create, edit, adjust stock, raise and receive orders, read audit |
| admin | `aoph_admin_workshop_key` | Approve orders, delete |

These are disposable workshop credentials. Never reuse them.

## Dashboard

| Tab | What you can do |
|---|---|
| Catalogue | Search, filter, **+ New part**, Edit, Adjust stock, Delete. Click a row for details and history |
| Reorder list | Parts at or below their reorder level, most urgent first |
| Purchase orders | **+ New order** with a line editor; Submit, Approve, Receive, Cancel |
| Suppliers | Full CRUD; delete is refused while a supplier is referenced |
| Audit trail | Every change, filterable by entity (operator and above) |

## Architecture

```
src/
  server.ts            process start-up; routes legacy label requests
  app.ts               module registration
  core/                errors, validation, list-query parsing
  http/                router, responses, static files
  legacy/              label-printer endpoint (outside the router)
  modules/
    parts/             reference module: schema → repository → service → routes
    suppliers/
    purchase-orders/   state machine and transactional goods receipt
    audit/             append-only change history
    auth/              API keys, roles, rate limiting, /api/me
public/                dashboard (api-client.js, forms.js, app.js)
tests/                 node:test unit and API tests
docs/labs/             lab guides 0–5
```

## Workshop labs

| Lab | Guide |
|---|---|
| 0 — Environment setup | [`docs/labs/lab0-environment.md`](docs/labs/lab0-environment.md) |
| 1 — From issue to pull request | [`docs/labs/lab1-issue-to-pr.md`](docs/labs/lab1-issue-to-pr.md) |
| 2 — Build a module in Agent mode | [`docs/labs/lab2-agent-mode.md`](docs/labs/lab2-agent-mode.md) |
| 3 — CI/CD with GitHub Actions | [`docs/labs/lab3-cicd.md`](docs/labs/lab3-cicd.md) |
| 4 — Security and code quality | [`docs/labs/lab4-security.md`](docs/labs/lab4-security.md) |
| 5 — Deploy to Azure and use the CLI | [`docs/labs/lab5-deploy.md`](docs/labs/lab5-deploy.md) |

Copilot configuration lives in `.github/`: repository instructions, path-specific
instructions, reusable prompt files, and the issue template for the coding agent.

Internal workshop material. © SoftwareOne.
