# Lab 3 — CI/CD with GitHub Actions

**20 minutes.** Outcome: a green pipeline, and the skill to fix a red one.

## 1. Generate the workflow

```text
Create .github/workflows/ci.yml. It runs on pull requests to main and pushes to main:
checkout, set up Node, install dependencies, run `npm run typecheck`, run `npm test`.
Read the Node version from the engines field in #file:package.json. Use minimal
permissions, a job timeout, and pin actions to a major version.
```

Check before committing:

- Node version must be **24** (`node:sqlite` and native TypeScript do not exist on 20).
- `permissions:` is present and minimal.
- `timeout-minutes` is set.

## 2. Commit and watch

```bash
git checkout -b lab3/ci
git add .github/workflows/ci.yml
git commit -m "ci: add build and test workflow"
git push -u origin lab3/ci
```

Open a pull request and watch the **Actions** tab.

## 3. Break it on purpose

| Break | Lesson |
|---|---|
| `node-version: '20'` | The failure is a runtime error far from the YAML you changed |
| Remove the install step | The error appears nowhere near its cause |
| Change a reorder level in `src/db/seed.ts` | A real assertion failure with a useful diff |

## 4. Debug with evidence

Copy the **actual failing log**, then:

```text
This workflow run failed with the log below. Explain the root cause in two sentences,
then give me the minimal fix. Do not restructure the workflow.

<paste the log>
```

## 5. Fix, push, confirm green

## Checkpoint

- [ ] One red run and one green run in the Actions tab
- [ ] You diagnosed the failure from the log

**Discussion:** with this check marked as required on `main`, a red PR — including one
from the coding agent — cannot be merged.
