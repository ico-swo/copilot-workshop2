---
mode: 'agent'
description: 'Review a module against the project security and domain rules'
---

Review the module I name below against `.github/copilot-instructions.md`. Check, in order:

1. **Injection** — every SQL statement parameterised? Only a `parseListQuery` sort column may be dynamic.
2. **Output handling** — any request value interpolated into an HTML string, on the server or in `public/`?
3. **File access** — any file path built from a request value?
4. **Authorisation** — does every route declare a `requires` role? Is anything served outside the router without authentication?
5. **Input validation** — does every field pass through `Validator`, with `rejectUnknown`?
6. **Atomicity** — any multi-row write outside a transaction?
7. **Concurrency** — every versioned update guarded by `WHERE version = ?`?
8. **Audit** — every state change recorded?
9. **Logging** — any request body, API key or credential written to a log?

For each finding: file and line, the risk in one sentence, the minimal fix, and the test that would have caught it.
Group as **Must fix** and **Consider**. If a category is clean, say so in one line.

Module: ${input:module:Which module or folder should I review?}
