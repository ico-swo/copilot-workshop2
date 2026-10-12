# Lab 5 — Deploying to Azure App Service

Steps 1–2 are done by the facilitator before the workshop.

## 1. Provision

### Option A — Azure CLI

```bash
az group create --name rg-astra-parts-hub --location southeastasia
az appservice plan create --name asp-astra-parts-hub --resource-group rg-astra-parts-hub --sku B1 --is-linux
az webapp create --resource-group rg-astra-parts-hub --plan asp-astra-parts-hub \
  --name <unique-app-name> --runtime "NODE:24-lts"
az webapp config appsettings set --resource-group rg-astra-parts-hub --name <unique-app-name> \
  --settings NODE_ENV=production APP_VERSION=1.1.0 DATABASE_FILE=/home/data/parts-hub.db
```

### Option B — Azure Portal (GUI)

1. Go to [portal.azure.com](https://portal.azure.com) → **Resource groups** → **Create**.
   - Name: `rg-astra-parts-hub`
   - Region: `Southeast Asia`
   - Click **Review + create** → **Create**.
2. In the new resource group, click **Create** → search **Web App** → **Create**.
   - **Resource group:** `rg-astra-parts-hub`
   - **Name:** `<unique-app-name>` (must be globally unique, becomes `<name>.azurewebsites.net`)
   - **Publish:** Code
   - **Runtime stack:** Node 24 LTS
   - **Operating System:** Linux
   - **Region:** Southeast Asia
   - Under **App Service Plan**, click **Create new**, name it `asp-astra-parts-hub`, **Pricing plan:** `B1 (Basic)`.
   - Click **Review + create** → **Create**. Wait for deployment to finish, then **Go to resource**.
3. On the Web App page, open **Settings → Environment variables** (older portals: **Configuration → Application settings**).
   - Click **Add** for each of the following, then **Apply**:
     - `NODE_ENV` = `production`
     - `APP_VERSION` = `1.1.0`
     - `DATABASE_FILE` = `/home/data/parts-hub.db`
   - Do **not** add `AUTH_DISABLED` — leave it unset in Azure.
   - Click **Save** at the top, confirm the restart.

`/home` is persistent on App Service, so the database survives restarts.
Do **not** set `AUTH_DISABLED` in Azure.

## 2. Grant the workflow access (OIDC)

### Option A — Azure CLI

```bash
az ad sp create-for-rbac --name "gh-astra-parts-hub" --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-astra-parts-hub --json-auth
```

Add a federated credential for the repository, then store `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` as repository secrets.

### Option B — Azure Portal (GUI)

1. **Create the App Registration (service principal):**
   - Go to **Microsoft Entra ID** → **App registrations** → **New registration**.
   - Name: `gh-astra-parts-hub`. Leave other defaults. Click **Register**.
   - Copy the **Application (client) ID** and **Directory (tenant) ID** from the Overview page — these become `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.
2. **Grant it Contributor on the resource group:**
   - Go to the `rg-astra-parts-hub` resource group → **Access control (IAM)** → **Add** → **Add role assignment**.
   - Role: `Contributor`.
   - Members: select your app registration `gh-astra-parts-hub`.
   - Click **Review + assign**.
3. **Add a federated credential (so GitHub Actions can log in without a secret):**
   - Back in the app registration → **Certificates & secrets** → **Federated credentials** tab → **Add credential**.
   - Scenario: **GitHub Actions deploying Azure resources**.
   - Organization: your GitHub org, Repository: this repo's name.
   - Entity type: `Branch`, Branch name: `main` (add another credential with Entity type `Environment` → `production` if the workflow uses an `environment:`).
   - Name it, e.g. `gh-main-branch`, then **Add**.
4. **Get the subscription ID:**
   - Go to **Subscriptions** in the portal, copy the **Subscription ID** — this is `AZURE_SUBSCRIPTION_ID`.
5. **Store the secrets in GitHub:**
   - Repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` with the values collected above.

## 3. Deploy job (added to `.github/workflows/ci.yml` in the lab)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test

  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@v3
        with:
          app-name: astra-copilot-h0b6a4hac6dxapb9
          package: .

```

## 4. Seed once (App Service SSH console)

```bash
cd /home/site/wwwroot && npm run seed
```

## 5. Verify

```bash
APP=https://<unique-app-name>.azurewebsites.net
curl -s $APP/health
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/parts          # must be 401
curl -s -H "Authorization: Bearer aoph_viewer_workshop_key" "$APP/api/parts?limit=3"
```
