---
mode: 'agent'
description: 'Scaffold a new feature module end to end, including the dashboard tab'
---

Create a new feature module using `src/modules/parts/` as the reference and following
`.github/instructions/modules.instructions.md`:

1. `schema.ts`, `repository.ts`, `service.ts`, `routes.ts`.
2. The table in `src/db/schema.sql` (`CREATE TABLE IF NOT EXISTS`).
3. Routes registered in `src/app.ts`, documented in `src/openapi.ts`.
4. The entity in `public/api-client.js`, a view config and actions in `public/app.js`, and a tab in
   `public/index.html`, following `.github/instructions/frontend.instructions.md`.
5. `tests/<module>.test.ts`.

Then run `npm test` and `npm run typecheck`, fix what fails, and summarise every file you changed.

Module: ${input:module:What is the module called and what does it do?}
