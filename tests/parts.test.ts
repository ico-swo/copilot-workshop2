import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seededDatabase, ACTOR, REQUEST_ID } from "./helpers.ts";
import { PartsService } from "../src/modules/parts/service.ts";
import { SuppliersService } from "../src/modules/suppliers/service.ts";
import type { AuditService } from "../src/modules/audit/service.ts";
import { parseCreatePart, parseStockAdjustment, parseUpdatePart } from "../src/modules/parts/schema.ts";
import type { AppError } from "../src/core/errors.ts";

const newPart = {
  sku: "AOP-ENG-5099",
  name: "Water pump, replacement",
  category: "engine",
  vehicleModel: "Innova 2.0 G",
  unitPriceIdr: 890000,
  stockQuantity: 12,
  warehouse: "Jakarta-1",
};

let audit: AuditService;
let parts: PartsService;
let suppliers: SuppliersService;

beforeEach(() => {
  const seeded = seededDatabase();
  audit = seeded.audit;
  parts = new PartsService(seeded.db, audit);
  suppliers = new SuppliersService(seeded.db, audit);
});

describe("part validation", () => {
  test("accepts a well-formed part and applies the reorder-level default", () => {
    const parsed = parseCreatePart(newPart);
    assert.equal(parsed.reorderLevel, 10);
    assert.equal(parsed.isActive, true);
    assert.equal(parsed.supplierId, null);
  });

  test("rejects a SKU that does not match the catalogue pattern", () => {
    assert.throws(() => parseCreatePart({ ...newPart, sku: "BRK-1" }), (e: AppError) => e.status === 400 && e.details?.["sku"] !== undefined);
  });

  test("reports every invalid field in a single response", () => {
    try {
      parseCreatePart({ ...newPart, sku: "nope", category: "tyres", unitPriceIdr: -5 });
      assert.fail("expected validation to throw");
    } catch (error) {
      assert.deepEqual(Object.keys((error as AppError).details ?? {}).sort(), ["category", "sku", "unitPriceIdr"]);
    }
  });

  test("rejects a field the endpoint does not accept", () => {
    assert.throws(() => parseCreatePart({ ...newPart, isAdmin: true }), (e: AppError) => e.details?.["isAdmin"] === "is not an accepted field");
  });

  test("treats an empty supplier selection from the dashboard as no supplier", () => {
    assert.equal(parseCreatePart({ ...newPart, supplierId: "" }).supplierId, null);
    assert.equal(parseUpdatePart({ supplierId: "" }).supplierId, null);
  });

  test("refuses to change an immutable SKU", () => {
    assert.throws(() => parseUpdatePart({ sku: "AOP-BRK-9999" }), (e: AppError) => e.details?.["sku"] !== undefined);
  });

  test("refuses to set stock directly, pointing at the adjustment endpoint", () => {
    assert.throws(() => parseUpdatePart({ stockQuantity: 500 }), (e: AppError) => (e.details?.["stockQuantity"] ?? "").includes("adjust-stock"));
  });

  test("refuses an update that changes nothing", () => {
    assert.throws(() => parseUpdatePart({}), (e: AppError) => e.status === 400);
  });

  test("rejects a zero stock adjustment", () => {
    assert.throws(() => parseStockAdjustment({ delta: 0, reason: "stock_take" }), (e: AppError) => e.details?.["delta"] === "must not be zero");
  });

  test("requires a recognised adjustment reason", () => {
    assert.throws(() => parseStockAdjustment({ delta: 5, reason: "because" }), (e: AppError) => e.details?.["reason"] !== undefined);
  });

  test("accepts an empty note from the adjustment form as null", () => {
    assert.equal(parseStockAdjustment({ delta: 5, reason: "return", note: "" }).note, null);
  });
});

describe("parts service", () => {
  test("creates a part and records an audit event", () => {
    const created = parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    assert.equal(created.version, 1);
    const events = audit.forEntity("part", created.id);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, "part.created");
  });

  test("rejects a duplicate SKU with a typed conflict", () => {
    parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    assert.throws(() => parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID), (e: AppError) => e.status === 409 && e.code === "duplicate_sku");
  });

  test("rejects a part that references an unknown supplier", () => {
    assert.throws(
      () => parts.create(parseCreatePart({ ...newPart, supplierId: "missing" }), ACTOR, REQUEST_ID),
      (e: AppError) => e.status === 400 && e.details?.["supplierId"] !== undefined,
    );
  });

  test("rejects a part assigned to an inactive supplier", () => {
    const legacy = suppliers.list(new URLSearchParams({ search: "Legacy" })).items[0];
    assert.ok(legacy);
    assert.throws(
      () => parts.create(parseCreatePart({ ...newPart, supplierId: legacy.id }), ACTOR, REQUEST_ID),
      (e: AppError) => e.code === "supplier_inactive",
    );
  });

  test("joins the supplier into the part representation", () => {
    const page = parts.list(new URLSearchParams({ search: "AOP-FLT-2001" }));
    assert.equal(page.items[0]?.supplier?.code, "SUP-DNSO");
  });

  test("lists parts at or below their own reorder level, most urgent first", () => {
    const reorder = parts.reorderList();
    assert.ok(reorder.length > 0);
    assert.ok(reorder.every((p) => p.stockQuantity <= p.reorderLevel));
    const quantities = reorder.map((p) => p.stockQuantity);
    assert.deepEqual(quantities, [...quantities].sort((a, b) => a - b));
  });

  test("increments the version on every update and leaves stock alone", () => {
    const created = parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    const updated = parts.update(created.id, parseUpdatePart({ name: "Water pump, OEM" }), undefined, ACTOR, REQUEST_ID);
    assert.equal(updated.version, created.version + 1);
    assert.equal(updated.stockQuantity, created.stockQuantity);
  });

  test("rejects an update based on a stale version", () => {
    const created = parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    parts.update(created.id, parseUpdatePart({ name: "First writer" }), created.version, ACTOR, REQUEST_ID);
    assert.throws(
      () => parts.update(created.id, parseUpdatePart({ name: "Second writer" }), created.version, ACTOR, REQUEST_ID),
      (e: AppError) => e.status === 412 && e.code === "version_conflict",
    );
  });

  test("applies a stock adjustment and audits the balance change", () => {
    const created = parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    const adjusted = parts.adjustStock(created.id, parseStockAdjustment({ delta: 8, reason: "return", note: "Customer return" }), ACTOR, REQUEST_ID);
    assert.equal(adjusted.stockQuantity, 20);
    const events = audit.forEntity("part", created.id);
    assert.equal(events[0]?.action, "part.stock_adjusted");
    assert.match(events[0]?.summary ?? "", /\+8 units \(return\)/);
  });

  test("refuses an adjustment that would make the balance negative", () => {
    const created = parts.create(parseCreatePart(newPart), ACTOR, REQUEST_ID);
    assert.throws(
      () => parts.adjustStock(created.id, parseStockAdjustment({ delta: -99, reason: "damage" }), ACTOR, REQUEST_ID),
      (e: AppError) => e.status === 409 && e.code === "insufficient_stock",
    );
    assert.equal(parts.getById(created.id).stockQuantity, 12, "the balance must be unchanged");
  });

  test("computes inventory totals", () => {
    const summary = parts.summary();
    assert.equal(summary.totalParts, 15);
    assert.equal(summary.warehouses, 3);
    assert.ok(summary.stockValueIdr > 0);
  });

  test("exposes active parts and warehouses for the dashboard pickers", () => {
    assert.ok(parts.options().length > 0);
    assert.deepEqual(parts.warehouses().sort(), ["Bekasi-2", "Jakarta-1", "Karawang-1"]);
  });

  test("returns 404 for an unknown id", () => {
    assert.throws(() => parts.getById("missing"), (e: AppError) => e.status === 404);
  });
});
