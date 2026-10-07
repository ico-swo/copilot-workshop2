import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createTestDatabase } from "../src/db/index.ts";
import { createApp } from "../src/app.ts";
import { seed, WORKSHOP_API_KEYS } from "../src/db/seed.ts";
import { AuditService } from "../src/modules/audit/service.ts";
import type { Actor } from "../src/modules/auth/types.ts";

export const ACTOR: Actor = { id: "test", name: "test-operator", role: "operator" };
export const REQUEST_ID = "test-request";

export const KEYS = {
  viewer: WORKSHOP_API_KEYS[0]?.key as string,
  operator: WORKSHOP_API_KEYS[1]?.key as string,
  admin: WORKSHOP_API_KEYS[2]?.key as string,
};

/** A seeded, isolated database plus an audit service bound to it. */
export function seededDatabase(): { db: DatabaseSync; audit: AuditService } {
  const db = createTestDatabase();
  seed(db);
  return { db, audit: new AuditService(db) };
}

type RequestInitWithKey = RequestInit & { key?: keyof typeof KEYS };

export interface TestServer {
  url: string;
  close: () => Promise<void>;
  request: (path: string, init?: RequestInitWithKey) => Promise<Response>;
  json: <T>(path: string, init?: RequestInitWithKey) => Promise<T>;
}

/** Starts the real app on an ephemeral port against a seeded database. */
export async function startServer(db?: DatabaseSync): Promise<TestServer> {
  const server: Server = createServer(createApp(db ?? seededDatabase().db));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const request = async (path: string, init: RequestInitWithKey = {}): Promise<Response> => {
    const { key = "operator", headers, ...rest } = init;
    return fetch(`${url}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${KEYS[key]}`,
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
    });
  };

  return {
    url,
    request,
    json: async <T>(path: string, init?: RequestInitWithKey) => (await (await request(path, init)).json()) as T,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export const body = (payload: unknown): string => JSON.stringify(payload);
