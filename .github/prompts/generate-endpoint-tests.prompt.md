---
mode: 'agent'
description: 'Generate node:test coverage for an endpoint following project conventions'
---

Write tests for the endpoint below, following `.github/instructions/tests.instructions.md`. Cover:

- the success path, asserting status and response shape,
- a validation failure (400) with the expected key in `error.details`,
- an authorisation failure (403) for a role without access,
- the relevant conflict: duplicate, invalid transition, or stale version (412),
- any stock side effect, asserting the balance before and after,
- the shapes the dashboard sends, including `""` for an unselected dropdown.

Do not add a dependency. Run `npm test` and report the result.

Endpoint: ${input:endpoint:Which endpoint should I test?}
