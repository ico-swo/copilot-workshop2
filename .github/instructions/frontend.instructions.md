---
applyTo: "public/**/*.js"
---

# Dashboard conventions

- **Never assign to `innerHTML`.** Build DOM with `element()` from `forms.js` and set `textContent`.
- **Never duplicate server validation.** Submit, catch `ApiError`, and let `forms.js` place `error.details` next to the matching input.
- **Never infer permissions.** Read `me.can` from `/api/me` to show or hide write actions.
- **Never hard-code the purchase-order state machine.** Read `/api/purchase-orders/transitions`.
- Writes to a versioned entity pass its `version`, so the server can reject a stale write with 412.
- `api-client.js` is the only module that calls `fetch`.
- After a successful write, call `refresh()` rather than mutating local state.
