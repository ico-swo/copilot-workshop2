import { createServer } from "node:http";
import { config } from "./config.ts";
import { getDatabase, closeDatabase } from "./db/index.ts";
import { createApp } from "./app.ts";
import { handleLegacyLabel, isLegacyLabelRequest } from "./legacy/label-printer.ts";

const db = getDatabase();
const app = createApp(db);

const server = createServer((req, res) => {
  // The label printers cannot authenticate, so their endpoint is served
  // before the router. See src/legacy/label-printer.ts.
  if (isLegacyLabelRequest(req.url)) {
    handleLegacyLabel(req, res, db);
    return;
  }
  void app(req, res);
});

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Astra Parts Hub started",
      port: config.port,
      environment: config.environment,
      version: config.version,
      authDisabled: config.authDisabled,
    }),
  );
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", message: "Shutting down", signal }));
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
