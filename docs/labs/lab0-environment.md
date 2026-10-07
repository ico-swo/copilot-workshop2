# Lab 0 — Environment setup

**10 minutes.** Outcome: everyone is working in an identical, ready environment.

## 1. Open the Codespace

1. Open your team repository on GitHub.
2. **Code → Codespaces → Create codespace on main**.
3. Wait for setup to finish. It installs dependencies and seeds the sample data.

## 2. Check Copilot knows this repository

Open Copilot Chat and ask:

```text
Trace what happens when a purchase order is received. Which files are involved,
and where does the part stock actually change? #codebase
```

A good answer names `routes.ts → service.ts → repository.receive()` and mentions the
`BEGIN IMMEDIATE` transaction. If it invents file names, wait a moment and ask again.

## 3. Run the app

```bash
npm test          # expect 67 passing, 1 skipped
npm run dev
```

Open the forwarded port 3000. The status pill reads **Health endpoint not implemented** —
that is Lab 1's work.

## 4. Watch the interface change with each role

Paste each key into the **API key** field at the top right:

| Role | Key | What appears |
|---|---|---|
| viewer | `aoph_viewer_workshop_key` | Read only. No New or Edit buttons |
| operator | `aoph_operator_workshop_key` | **+ New part**, **+ New order**, Edit, Adjust stock, Audit trail |
| admin | `aoph_admin_workshop_key` | Also **Approve** and **Delete** |

The dashboard asks `GET /api/me` what you may do. The server enforces it independently:

```bash
curl -i -X POST localhost:3000/api/parts \
  -H "Authorization: Bearer aoph_viewer_workshop_key" \
  -H "Content-Type: application/json" -d '{}' | head -1
```

That returns **403**. The hidden button is a convenience; the 403 is the control.

## 5. Try one write and one mistake

With the operator key:

1. **+ New part** → SKU `BRK-1`, leave the name blank → **Create part**.
2. Both errors appear under their own inputs. That is the server's `error.details` — the
   browser holds no copy of the rules.
3. Fix the SKU to `AOP-BRK-1500`, complete the form, and save.

## 6. Read the standards

Open `.github/copilot-instructions.md`. Then ask Copilot:

```text
If I add a new endpoint that changes stock, what does this project require me to do?
```

A grounded answer mentions a transaction, an audit event, a version guard, a `requires`
role and the OpenAPI document.

## Checkpoint

- [ ] Codespace running and Copilot answering with real file names
- [ ] Dashboard loads; you swapped all three keys
- [ ] You created one part and saw inline validation errors
