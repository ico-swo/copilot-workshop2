import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { seededDatabase } from "./helpers.ts";
import { handleLegacyLabel } from "../src/legacy/label-printer.ts";

/*
 * Functional behaviour only. Lab 4 adds the XSS regression tests here once
 * the code scanning alerts have been fixed.
 */

let server: Server;
let url: string;

before(async () => {
  const { db } = seededDatabase();
  server = createServer((req, res) => handleLegacyLabel(req, res, db));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("legacy label printer", () => {
  test("renders a label for a known SKU", async () => {
    const response = await fetch(`${url}/legacy/label?sku=AOP-BRK-1001&operator=budi`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /AOP-BRK-1001/);
    assert.match(html, /Picked by budi/);
  });

  test("supports the compact printer layout", async () => {
    const html = await (await fetch(`${url}/legacy/label?sku=AOP-BRK-1001&template=compact`)).text();
    assert.match(html, /label-compact/);
  });

  test("rejects a template that is not on the allow-list", async () => {
    const response = await fetch(`${url}/legacy/label?sku=AOP-BRK-1001&template=../index`);
    assert.equal(response.status, 404);
  });

  test("reports an unknown SKU", async () => {
    const html = await (await fetch(`${url}/legacy/label?sku=AOP-XXX-0000`)).text();
    assert.match(html, /No part matches/);
  });
});
