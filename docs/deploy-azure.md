# Lab 5 — Deploying to Azure App Service

Steps 1–2 are done by the facilitator before the workshop.

## 1. Provision

```bash
az group create --name rg-astra-parts-hub --location southeastasia
az appservice plan create --name asp-astra-parts-hub --resource-group rg-astra-parts-hub --sku B1 --is-linux
az webapp create --resource-group rg-astra-parts-hub --plan asp-astra-parts-hub \
  --name <unique-app-name> --runtime "NODE:24-lts"
az webapp config appsettings set --resource-group rg-astra-parts-hub --name <unique-app-name> \
  --settings NODE_ENV=production APP_VERSION=1.1.0 DATABASE_FILE=/home/data/parts-hub.db
```

`/home` is persistent on App Service, so the database survives restarts.
Do **not** set `AUTH_DISABLED` in Azure.

## 2. Grant the workflow access (OIDC)

```bash
az ad sp create-for-rbac --name "gh-astra-parts-hub" --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-astra-parts-hub --json-auth
```

Add a federated credential for the repository, then store `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` as repository secrets.

## 3. Deploy job (added to `.github/workflows/ci.yml` in the lab)

```yaml
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
          app-name: <unique-app-name>
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
