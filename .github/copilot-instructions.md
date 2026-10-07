# Copilot instructions — Astra Parts Hub

Spare parts catalogue, supplier master data and procurement workflow for Astra Otoparts.

## Stack

- Node.js 24, TypeScript run directly by Node (native type stripping). No build step.
- Zero runtime dependencies: `node:http`, `node:sqlite`, `node:crypto`, `node:test` only.
- Frontend is plain ES modules in `public/`, served by the same process. No framework, no bundler.

Do not add a runtime dependency. If a task appears to need one, say so and stop.

## Commands

- `npm start` — run the service
- `npm run dev` — run with file watching
- `npm test` — run the full suite
- `npm run typecheck` — type check without emitting
- `npm run seed` — load reference data and issue the development API keys

Run `npm test` and `npm run typecheck` after every change.

## Architecture

```
src/core/       errors, validation kit, list-query parsing (no HTTP, no SQL)
src/http/       router, response helpers, static assets
src/modules/    one folder per feature
src/legacy/     endpoints served outside the router (label printers)
src/openapi.ts  hand-maintained API description, served at /openapi.json
public/         dashboard: api-client.js, forms.js, app.js
```

Each feature module has four files:

| File | Responsibility |
|---|---|
| `schema.ts` | Parse and validate input. Throws `AppError.badRequest` with a field-level `details` map. Holds the domain types. |
| `repository.ts` | SQL only. Parameterised statements. Maps `snake_case` rows to `camelCase` objects. |
| `service.ts` | Business rules, cross-entity checks, audit writes. Throws `AppError`. Knows nothing about HTTP. |
| `routes.ts` | Thin handlers: parse input, call the service, send a response. Declares the required role. |

`src/modules/parts/` is the reference implementation. Mirror it.
Register new routes in `src/app.ts`, and document new endpoints in `src/openapi.ts`.

## Conventions

- TypeScript is strict. No `any`. No non-null assertions (`!`).
- Do not use TypeScript parameter properties in constructors — Node's type stripping rejects them. Declare a `#private` field and assign it in the constructor body.
- Errors: always `AppError` from `src/core/errors.ts`, with a specific `code`.
- Responses: always the helpers in `src/http/respond.ts`. Use `sendVersioned` for anything carrying a `version`.
- Validation: always the `Validator` from `src/core/validation.ts`, calling `rejectUnknown`.
- List endpoints return `{ items, total, limit, offset }` and parse their query with `parseListQuery`.
- Timestamps are ISO 8601 UTC strings. Money is an integer number of Rupiah. Never a float.
- Log as single-line JSON: `{ level, message, ...context }`.

## Domain rules

- **Concurrency.** Every mutable entity carries a `version`. Updates use `WHERE version = ?` and return 412 on mismatch. Callers pass the version through `If-Match`.
- **Stock.** Never set to an absolute value. It moves only through `POST /api/parts/:id/adjust-stock` (with a reason) or goods receipt on a purchase order.
- **Transactions.** Any operation touching more than one row runs inside `BEGIN IMMEDIATE` / `COMMIT`, with `ROLLBACK` on failure.
- **Audit.** Every state change calls `AuditService.record`. The audit table is append-only.
- **State machine.** Purchase order transitions live in `ALLOWED_TRANSITIONS`. Add a transition to that map, never as an `if`.
- **Segregation of duties.** The person who raised a purchase order cannot approve it.
- **Referential integrity.** Referenced entities are deactivated, not deleted. Deletion returns 409.

## Security rules

- Build SQL with bound parameters only. The only exception is the sort column, resolved through the `parseListQuery` allow-list.
- Never render a request value into an HTML string, on the server or in the client.
- Never build a file path from a request value. Resolve against a fixed directory and an allow-list.
- Every route declares a `requires` role, or is deliberately public (`/`, static assets, `/openapi.json`, `/health`).
- Never log a request body, a credential, an API key, or a connection string.

## Testing

- Tests live in `tests/` and use `node:test` with `node:assert/strict`.
- Use `seededDatabase()` for service-level tests and `startServer()` for API-level tests (`tests/helpers.ts`).
- Assert on `status`, `code` and `details` keys — never on message wording.
- Every new endpoint needs: a success case, a validation failure, an authorisation failure, and the relevant conflict case.
- Anything that changes stock must assert the resulting balance, and that a failed attempt left it unchanged.
