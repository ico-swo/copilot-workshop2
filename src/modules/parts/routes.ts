import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../../http/router.ts";
import { sendJson, sendNoContent, sendVersioned } from "../../http/respond.ts";
import type { AuditService } from "../audit/service.ts";
import { PartsService } from "./service.ts";
import { parseCreatePart, parseStockAdjustment, parseUpdatePart } from "./schema.ts";

/**
 * HTTP routes for the parts module. This is the reference pattern: a new
 * module mirrors this structure (schema -> repository -> service -> routes).
 */
export function partsRoutes(db: DatabaseSync, audit: AuditService): RouteDefinition[] {
  const service = new PartsService(db, audit);

  return [
    { method: "GET", path: "/api/parts", requires: "viewer", handler: (ctx) => sendJson(ctx.res, 200, service.list(ctx.query)) },
    { method: "GET", path: "/api/parts/summary", requires: "viewer", handler: (ctx) => sendJson(ctx.res, 200, service.summary()) },
    {
      method: "GET",
      path: "/api/parts/reorder-list",
      requires: "viewer",
      handler: (ctx) => sendJson(ctx.res, 200, { items: service.reorderList() }),
    },
    {
      method: "GET",
      path: "/api/parts/options",
      requires: "viewer",
      handler: (ctx) => sendJson(ctx.res, 200, { items: service.options(), warehouses: service.warehouses() }),
    },
    {
      method: "GET",
      path: "/api/parts/:id",
      requires: "viewer",
      handler: (ctx) => sendVersioned(ctx.res, 200, service.getById(ctx.params["id"] as string)),
    },
    {
      method: "POST",
      path: "/api/parts",
      requires: "operator",
      handler: async (ctx) => {
        const input = parseCreatePart(await ctx.readJsonBody());
        sendVersioned(ctx.res, 201, service.create(input, ctx.actor, ctx.requestId));
      },
    },
    {
      method: "PATCH",
      path: "/api/parts/:id",
      requires: "operator",
      handler: async (ctx) => {
        const input = parseUpdatePart(await ctx.readJsonBody());
        sendVersioned(ctx.res, 200, service.update(ctx.params["id"] as string, input, ctx.ifMatchVersion(), ctx.actor, ctx.requestId));
      },
    },
    {
      method: "POST",
      path: "/api/parts/:id/adjust-stock",
      requires: "operator",
      handler: async (ctx) => {
        const input = parseStockAdjustment(await ctx.readJsonBody());
        sendVersioned(ctx.res, 200, service.adjustStock(ctx.params["id"] as string, input, ctx.actor, ctx.requestId));
      },
    },
    {
      method: "DELETE",
      path: "/api/parts/:id",
      requires: "admin",
      handler: (ctx) => {
        service.delete(ctx.params["id"] as string, ctx.actor, ctx.requestId);
        sendNoContent(ctx.res);
      },
    },
  ];
}
