# Lab 1 — From issue to pull request

**20 minutes.** Outcome: a reviewed pull request, authored by an agent, owned by a human.

You will add `GET /health`. The endpoint is small on purpose; this lab is about delegation and review.

## 1. Draft the issue with Copilot

```text
Draft a GitHub issue for adding a GET /health endpoint to this service, using the
template in .github/ISSUE_TEMPLATE/copilot-task.yml. Follow #file:src/app.ts and
#file:src/http/respond.ts. It returns status, version and uptimeSeconds, needs no
API key, and makes no database query.
```

## 2. Check the four sections

| Section | Must contain |
|---|---|
| Outcome | `GET /health` returns 200 with `status`, `version`, `uptimeSeconds` |
| Context | `src/app.ts`, `src/http/respond.ts`, `src/config.ts` |
| Constraints | No new dependency, no database call, public route (no `requires`) |
| Acceptance | `npm test` passes **and** the skipped `/health` test in `tests/api.test.ts` is enabled |

The test already exists with a `skip`, so the agent has an exact definition of done.

## 3. Create and assign

1. **Issues → New issue → Copilot task**, paste the content, **Create**.
2. In **Assignees**, choose **Copilot**.
3. A draft pull request appears and the agent starts pushing commits.

## 4. Review it as engineering work

- Read the diff, not just the summary.
- Did it remove the `skip` from the existing test, or write a new easier test?
- Did it add the endpoint to `src/openapi.ts` as the instructions require?
- Leave at least one comment so you see the revision loop:

```text
@copilot uptimeSeconds must be an integer. Round it and assert that in the test.
```

## 5. Merge

Approve and merge. Reload the dashboard: the status pill now reads **Healthy · v1.0.0**,
without anyone touching the frontend.

## Checkpoint

- [ ] Draft PR opened by the agent, one review comment, agent revised
- [ ] `/health` test enabled and passing; PR merged
- [ ] Dashboard status pill reads Healthy

**Discussion:** whose name is on the merge? The agent authored it; a person approved it.
