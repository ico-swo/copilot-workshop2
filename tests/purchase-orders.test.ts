import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seededDatabase, REQUEST_ID } from "./helpers.ts";
import { PurchaseOrderService } from "../src/modules/purchase-orders/service.ts";
import { PartsService } from "../src/modules/parts/service.ts";
import { SuppliersService } from "../src/modules/suppliers/service.ts";
import type { AuditService } from "../src/modules/audit/service.ts";
import { ALLOWED_TRANSITIONS, canTransition, parseCreatePurchaseOrder, PO_STATUSES } from "../src/modules/purchase-orders/schema.ts";
import type { AppError } from "../src/core/errors.ts";
import type { Actor } from "../src/modules/auth/types.ts";

const buyer: Actor = { id: "1", name: "warehouse-operator", role: "operator" };
const approver: Actor = { id: "2", name: "procurement-admin", role: "admin" };

let audit: AuditService;
let orders: PurchaseOrderService;
let parts: PartsService;
let suppliers: SuppliersService;

const supplierId = (code: string) => {
  const supplier = suppliers.list(new URLSearchParams({ search: code })).items[0];
  assert.ok(supplier);
  return supplier.id;
};

const partBySku = (sku: string) => {
  const part = parts.list(new URLSearchParams({ search: sku })).items[0];
  assert.ok(part);
  return part;
};

function draftOrder() {
  const filter = partBySku("AOP-FLT-2002");
  return orders.create(
    parseCreatePurchaseOrder({ supplierId: supplierId("SUP-DNSO"), lines: [{ partId: filter.id, quantity: 100, unitPriceIdr: 90000 }] }),
    buyer,
    REQUEST_ID,
  );
}

function approvedOrder(quantity = 100) {
  const filter = partBySku("AOP-FLT-2002");
  const order = orders.create(
    parseCreatePurchaseOrder({ supplierId: supplierId("SUP-DNSO"), lines: [{ partId: filter.id, quantity, unitPriceIdr: 90000 }] }),
    buyer,
    REQUEST_ID,
  );
  orders.submit(order.id, undefined, buyer, REQUEST_ID);
  orders.approve(order.id, undefined, approver, REQUEST_ID);
  return { order, partId: filter.id, openingStock: filter.stockQuantity };
}

beforeEach(() => {
  const seeded = seededDatabase();
  audit = seeded.audit;
  orders = new PurchaseOrderService(seeded.db, audit);
  parts = new PartsService(seeded.db, audit);
  suppliers = new SuppliersService(seeded.db, audit);
});

describe("state machine", () => {
  test("every status appears in the transition map", () => {
    assert.deepEqual(Object.keys(ALLOWED_TRANSITIONS).sort(), [...PO_STATUSES].sort());
  });

  test("received and cancelled are terminal", () => {
    assert.deepEqual(ALLOWED_TRANSITIONS.received, []);
    assert.deepEqual(ALLOWED_TRANSITIONS.cancelled, []);
  });

  test("a draft cannot jump straight to received", () => {
    assert.equal(canTransition("draft", "received"), false);
    assert.equal(canTransition("approved", "received"), true);
  });
});

describe("order creation", () => {
  test("assigns a sequential reference and computes the total", () => {
    const order = draftOrder();
    assert.match(order.reference, /^PO-\d{4}-\d{4}$/);
    assert.equal(order.status, "draft");
    assert.equal(order.totalIdr, 100 * 90000);
  });

  test("rejects an order with no lines", () => {
    assert.throws(() => parseCreatePurchaseOrder({ supplierId: supplierId("SUP-DNSO"), lines: [] }), (e: AppError) => e.details?.["lines"] !== undefined);
  });

  test("rejects the same part on two lines", () => {
    const filter = partBySku("AOP-FLT-2002");
    assert.throws(
      () =>
        parseCreatePurchaseOrder({
          supplierId: supplierId("SUP-DNSO"),
          lines: [
            { partId: filter.id, quantity: 10, unitPriceIdr: 1000 },
            { partId: filter.id, quantity: 5, unitPriceIdr: 1000 },
          ],
        }),
      (e: AppError) => (e.details?.["lines"] ?? "").includes("more than once"),
    );
  });

  test("reports the index of each invalid line", () => {
    const filter = partBySku("AOP-FLT-2002");
    try {
      parseCreatePurchaseOrder({
        supplierId: supplierId("SUP-DNSO"),
        lines: [
          { partId: filter.id, quantity: 10, unitPriceIdr: 1000 },
          { partId: "other", quantity: 0, unitPriceIdr: 1000 },
        ],
      });
      assert.fail("expected validation to throw");
    } catch (error) {
      assert.ok((error as AppError).details?.["lines[1].quantity"]);
    }
  });

  test("refuses to raise an order against an inactive supplier", () => {
    const filter = partBySku("AOP-FLT-2002");
    assert.throws(
      () =>
        orders.create(
          parseCreatePurchaseOrder({ supplierId: supplierId("Legacy"), lines: [{ partId: filter.id, quantity: 1, unitPriceIdr: 1000 }] }),
          buyer,
          REQUEST_ID,
        ),
      (e: AppError) => e.code === "supplier_inactive",
    );
  });

  test("writes nothing when a line fails, leaving no partial order", () => {
    const before = orders.list(new URLSearchParams({ limit: "1" })).total;
    assert.throws(() =>
      orders.create(
        parseCreatePurchaseOrder({ supplierId: supplierId("SUP-DNSO"), lines: [{ partId: "missing", quantity: 1, unitPriceIdr: 1000 }] }),
        buyer,
        REQUEST_ID,
      ),
    );
    assert.equal(orders.list(new URLSearchParams({ limit: "1" })).total, before);
  });
});

describe("approval workflow", () => {
  test("moves draft to submitted to approved, stamping each timestamp", () => {
    const order = draftOrder();
    assert.ok(orders.submit(order.id, undefined, buyer, REQUEST_ID).submittedAt);
    const approved = orders.approve(order.id, undefined, approver, REQUEST_ID);
    assert.equal(approved.status, "approved");
    assert.equal(approved.approvedBy, approver.name);
  });

  test("refuses approval by the person who raised the order", () => {
    const order = draftOrder();
    orders.submit(order.id, undefined, buyer, REQUEST_ID);
    assert.throws(
      () => orders.approve(order.id, undefined, { id: "9", name: buyer.name, role: "admin" }, REQUEST_ID),
      (e: AppError) => e.status === 403,
    );
  });

  test("refuses to approve an order that was never submitted", () => {
    const order = draftOrder();
    assert.throws(() => orders.approve(order.id, undefined, approver, REQUEST_ID), (e: AppError) => e.code === "invalid_transition");
  });

  test("refuses to edit an order once it leaves draft", () => {
    const order = draftOrder();
    orders.submit(order.id, undefined, buyer, REQUEST_ID);
    assert.throws(() => orders.update(order.id, { notes: "late" }, undefined, buyer, REQUEST_ID), (e: AppError) => e.code === "invalid_transition");
  });

  test("records a cancellation reason", () => {
    const order = draftOrder();
    orders.cancel(order.id, "Supplier withdrew the quotation", undefined, buyer, REQUEST_ID);
    assert.ok(audit.forEntity("purchase_order", order.id).some((e) => e.summary === "Supplier withdrew the quotation"));
  });
});

describe("goods receipt", () => {
  test("receiving in full increases stock by the ordered quantity", () => {
    const { order, partId, openingStock } = approvedOrder(100);
    const received = orders.receive(order.id, undefined, undefined, buyer, REQUEST_ID);
    assert.equal(received.status, "received");
    assert.equal(parts.getById(partId).stockQuantity, openingStock + 100);
  });

  test("a partial receipt moves only the quantity supplied", () => {
    const { order, partId, openingStock } = approvedOrder(100);
    orders.receive(order.id, [{ partId, receivedQuantity: 40 }], undefined, buyer, REQUEST_ID);
    assert.equal(parts.getById(partId).stockQuantity, openingStock + 40);
  });

  test("refuses to receive more than was ordered, and stock does not move", () => {
    const { order, partId, openingStock } = approvedOrder(100);
    assert.throws(
      () => orders.receive(order.id, [{ partId, receivedQuantity: 150 }], undefined, buyer, REQUEST_ID),
      (e: AppError) => e.details?.["lines[0].receivedQuantity"] !== undefined,
    );
    assert.equal(parts.getById(partId).stockQuantity, openingStock);
  });

  test("refuses a second receipt, so stock cannot be double counted", () => {
    const { order, partId, openingStock } = approvedOrder(100);
    orders.receive(order.id, undefined, undefined, buyer, REQUEST_ID);
    assert.throws(() => orders.receive(order.id, undefined, undefined, buyer, REQUEST_ID), (e: AppError) => e.code === "invalid_transition");
    assert.equal(parts.getById(partId).stockQuantity, openingStock + 100);
  });

  test("leaves a complete audit trail for the lifecycle", () => {
    const { order } = approvedOrder();
    orders.receive(order.id, undefined, undefined, buyer, REQUEST_ID);
    assert.deepEqual(
      audit.forEntity("purchase_order", order.id).map((e) => e.action),
      ["purchase_order.received", "purchase_order.approved", "purchase_order.submitted", "purchase_order.created"],
    );
  });
});
