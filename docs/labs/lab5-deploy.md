# Lab 5 — Deploy to Azure and use Copilot CLI

**10 minutes.** The facilitator demonstrates the deployment; everyone runs the CLI part.

## 1. Deployment (facilitator demo)

The deploy job from `docs/deploy-azure.md` is added to `ci.yml` and merged to `main`.
Watch it run in the **Actions** tab, then:

```bash
APP=https://<app-name>.azurewebsites.net
curl -s $APP/health
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/parts    # 401
```

Open the deployed dashboard: it shows no data until a key is entered. In the Codespace it
did — because `AUTH_DISABLED` is set there and deliberately not in Azure.

## 2. Copilot CLI (everyone)

In the Codespace terminal:

```bash
copilot
```

Confirm you trust the folder, then:

```text
> Summarise every change merged to main today, grouped by pull request, and draft
  release notes for version 1.1.0 in CHANGELOG.md.

> Then create the git tag v1.1.0 and show me the command before you run it.
```

Approve each tool use explicitly. The CLI asks before it reads, changes or runs anything.

## Checkpoint

- [ ] You saw `/health` respond in Azure and `/api/parts` refuse without a key
- [ ] Release notes drafted and tag created through Copilot CLI
