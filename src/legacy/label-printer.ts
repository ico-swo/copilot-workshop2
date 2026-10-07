import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Legacy endpoint for the Zebra label printers on the picking line.
 *
 * The terminals cannot parse JSON or send an Authorization header, so this
 * handler sits in front of the router and returns a ready-made HTML label.
 * The terminals live on the warehouse VLAN. Scheduled for replacement once
 * the terminals are upgraded.
 *
 *   GET /legacy/label?sku=AOP-BRK-1001&template=standard&operator=budi
 */

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../../public/labels");

// Each printer model has its own layout file in public/labels.
const TEMPLATES: Record<string, string> = {
  standard: "standard.html",
  compact: "compact.html",
};

interface LabelRow {
  sku: string;
  name: string;
  warehouse: string;
  stock_quantity: number;
}

export function isLegacyLabelRequest(url: string | undefined): boolean {
  return (url ?? "").startsWith("/legacy/label");
}

export function handleLegacyLabel(req: IncomingMessage, res: ServerResponse, db: DatabaseSync): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sku = url.searchParams.get("sku") ?? "";
  const operator = url.searchParams.get("operator") ?? "unknown";
  const templateFile = TEMPLATES[url.searchParams.get("template") ?? "standard"];

  if (!templateFile) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Unknown label template");
    return;
  }

  const layout = readFileSync(join(templatesDir, templateFile), "utf8");

  const part = db
    .prepare("SELECT sku, name, warehouse, stock_quantity FROM parts WHERE sku = ?")
    .get(sku) as LabelRow | undefined;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.write(layout);

  if (!part) {
    res.end(`<p class="label-empty">No part matches <b>${sku}</b></p></div>`);
    return;
  }

  res.end(
    `<h1>${part.sku}</h1>
     <p class="name">${part.name}</p>
     <p class="bin">${part.warehouse}</p>
     <p class="qty">On hand: ${part.stock_quantity}</p>
     <footer>Picked by ${operator}</footer>
   </div>`,
  );
}
