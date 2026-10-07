---
applyTo: "src/modules/**/*.ts"
---

# Module conventions

- Keep the four-file split: `schema.ts`, `repository.ts`, `service.ts`, `routes.ts`.
- Route handlers contain no business logic and no SQL; every route declares a `requires` role.
- Services take `(db, audit)` and record an audit event for every state change.
- Repositories expose intention-revealing methods (`findBySku`, `countOpenOrderLines`), never a generic `query(sql)`.
- Multi-row writes use `BEGIN IMMEDIATE` / `COMMIT` with `ROLLBACK` in a catch block.
- Versioned updates use `WHERE id = ? AND version = ?` and return `undefined` when no row matched.
- List methods use `WhereBuilder` and `parseListQuery` with an explicit `sortable` allow-list.
- Register static route segments so they are not shadowed (`/api/parts/summary` before `/api/parts/:id`).
- Parsers must accept `""` from HTML forms and map it to `null` for nullable fields.
- New tables go into `src/db/schema.sql` with `CREATE TABLE IF NOT EXISTS`.
