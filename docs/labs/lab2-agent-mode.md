# Lab 2 — Build a module in Agent mode

**25 minutes.** Outcome: a working stock request module — API, tests and dashboard tab —
that you can explain. Work in pairs: one drives, one reads every diff.

## 1. Switch to Agent mode

In Copilot Chat, change the mode from **Ask** to **Agent**.

## 2. Attach the specification

```text
Implement the stock request module described in #file:docs/spec-stock-requests.md.

Use #file:src/modules/purchase-orders/service.ts as the reference for the state machine
and the transactional stock movement, and #file:src/modules/parts/repository.ts for the
query and version-guard patterns. Register routes in #file:src/app.ts, document them in
#file:src/openapi.ts, and add the table to src/db/schema.sql.

Do not add dependencies or modify the parts or purchase-orders modules.
Run `npm test` and `npm run typecheck`, fix what fails, then summarise every file changed.
```

## 3. Supervise — watch for these

| Watch for | Why |
|---|---|
| Approval inside `BEGIN IMMEDIATE` / `COMMIT` | Otherwise stock can drop without the approval being saved |
| Availability re-checked at approval time | Stock may have moved since the request was raised |
| Transitions as a map, not `if` chains | The repository standard requires it |
| Every route has `requires` | A missing one makes the endpoint public |

## 4. Ask for the tests

```text
Add tests/stock-requests.test.ts following #file:.github/instructions/tests.instructions.md,
covering every case in the spec's definition of done. Run the suite and show the output.
```

The case agents usually forget: stock moving between creation and approval. Ask for it by name.

## 5. Build the dashboard tab

```text
Add the Stock requests tab following #file:.github/instructions/frontend.instructions.md.
Add the entity to #file:public/api-client.js, a view config and actions to
#file:public/app.js, and a tab in #file:public/index.html. Read transitions from the API,
gate actions on me.can.write, and do not validate anything in the client.
```

Then search the diff for `innerHTML` (must be none) and for any validation rule copied
into `app.js` from `schema.ts`.

## 6. Prove you own it

Close the chat. Explain to another pair, without re-reading: where stock is decremented,
why it is in a transaction, and what happens if two operators approve at once.

## Checkpoint

- [ ] Module, routes, OpenAPI entry and table in place
- [ ] Dashboard tab: create, approve, reject, cancel
- [ ] `npm test` and `npm run typecheck` pass

**Short of time?** Deliver create and approve only. Keep the transaction and the tests.
