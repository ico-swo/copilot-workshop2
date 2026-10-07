import type { DatabaseSync } from "node:sqlite";
import type { RouteDefinition } from "../../http/router.ts";
import { sendJson, sendVersioned } from "../../http/respond.ts";
import type { AuditService } from "../audit/service.ts";
import { PurchaseOrderService } from "./service.ts";
import {
  ALLOWED_TRANSITIONS,
  parseCancellation,
  parseCreatePurchaseOrder,
  parseReceipt,
  parseUpdatePurchaseOrder,
} from "./schema.ts";

export function purchaseOrderRoutes(db: DatabaseSync, audit: AuditService): RouteDefinition[] {
  const service = new PurchaseOrderService(db, audit);
  const id = (params: Record<string, string>) => params["id"] as string;

  return [
    { method: "GET", path: "/api/purchase-orders", requires: "viewer", handler: (ctx) => sendJson(ctx.res, 200, service.list(ctx.query)) },
    {
      // Served so the dashboard never hard-codes the state machine.
      method: "GET",
      path: "/api/purchase-orders/transitions",
      requires: "viewer",
      handler: (ctx) => sendJson(ctx.res, 200, ALLOWED_TRANSITIONS),
    },
    {
      method: "GET",
      path: "/api/purchase-orders/:id",
      requires: "viewer",
      handler: (ctx) => sendVersioned(ctx.res, 200, service.getById(id(ctx.params))),
    },
    {
      method: "POST",
      path: "/api/purchase-orders",
      requires: "operator",
      handler: async (ctx) => {
        const input = parseCreatePurchaseOrder(await ctx.readJsonBody());
        sendVersioned(ctx.res, 201, service.create(input, ctx.actor, ctx.requestId));
      },
    },
    {
      method: "PATCH",
      path: "/api/purchase-orders/:id",
      requires: "operator",
      handler: async (ctx) => {
        const input = parseUpdatePurchaseOrder(await ctx.readJsonBody());
        sendVersioned(ctx.res, 200, service.update(id(ctx.params), input, ctx.ifMatchVersion(), ctx.actor, ctx.requestId));
      },
    },
    {
      method: "POST",
      path: "/api/purchase-orders/:id/submit",
      requires: "operator",
      handler: (ctx) => sendVersioned(ctx.res, 200, service.submit(id(ctx.params), ctx.ifMatchVersion(), ctx.actor, ctx.requestId)),
    },
    {
      method: "POST",
      path: "/api/purchase-orders/:id/approve",
      requires: "admin",
      handler: (ctx) => sendVersioned(ctx.res, 200, service.approve(id(ctx.params), ctx.ifMatchVersion(), ctx.actor, ctx.requestId)),
    },
    {
      method: "POST",
      path: "/api/purchase-orders/:id/receive",
      requires: "operator",
      handler: async (ctx) => {
        const receipts = parseReceipt(await ctx.readJsonBody());
        sendVersioned(ctx.res, 200, service.receive(id(ctx.params), receipts, ctx.ifMatchVersion(), ctx.actor, ctx.requestId));
      },
    },
    {
      method: "POST",
      path: "/api/purchase-orders/:id/cancel",
      requires: "operator",
      handler: async (ctx) => {
        const reason = parseCancellation(await ctx.readJsonBody());
        sendVersioned(ctx.res, 200, service.cancel(id(ctx.params), reason, ctx.ifMatchVersion(), ctx.actor, ctx.requestId));
      },
    },
  ];
}
