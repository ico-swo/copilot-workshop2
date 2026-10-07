---
applyTo: "tests/**/*.ts"
---

# Test conventions

- Use `node:test` with `node:assert/strict`.
- Use the helpers in `tests/helpers.ts`: `seededDatabase()` for service-level tests, `startServer()` for API-level tests.
- One behaviour per test. The name states the behaviour, not the function.
  Good: `refuses approval by the person who raised the order`. Bad: `approve test 3`.
- Assert on `error.status`, `error.code` and the keys of `error.details`. Never on message wording.
- For anything that moves stock, assert the balance — and for the failure case, assert it did not move.
- Cover the shapes the dashboard sends, including `""` from an unselected dropdown.
- Never hard-code a port. Never add a mocking library or snapshot tests.
