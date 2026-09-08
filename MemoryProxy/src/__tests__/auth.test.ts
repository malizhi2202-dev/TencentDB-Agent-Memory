import { afterEach, describe, expect, it, vi } from "vitest";
import { initAuth, verifyUserKey } from "../auth.js";

const URL = "http://kernel:8420";

/** Stub global fetch for a single verifyUserKey call and assert the request shape. */
function stubFetch(
  behavior: (url: string, init?: RequestInit) => Promise<Response>,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => behavior(String(url), init)),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const VALID = {
  code: 0,
  data: { valid: true, user: { user_id: "usr-123" } },
};
const INVALID = { code: 0, data: { valid: false } };

afterEach(() => {
  initAuth({ enabled: false, url: "", timeoutMs: 5000, degradeOnUnreachable: false });
  vi.unstubAllGlobals();
});

describe("verifyUserKey", () => {
  it("rejects when auth is disabled? no — passthrough when auth disabled", async () => {
    initAuth({ enabled: false, url: "", timeoutMs: 5000 });
    const res = await verifyUserKey("sk-x", "default");
    expect(res.rejected).toBe(false);
  });

  it("accepts a valid user key", async () => {
    initAuth({ enabled: true, url: URL, timeoutMs: 5000 });
    stubFetch(async (url, init) => {
      expect(url).toBe(`${URL}/v3/meta/auth/verify`);
      expect(init?.method).toBe("POST");
      const sent = JSON.parse(String(init?.body));
      expect(sent.user_key).toBe("sk-mem-good");
      return jsonResponse(200, VALID);
    });
    const res = await verifyUserKey("sk-mem-good", "default");
    expect(res).toEqual({ userId: "usr-123", rejected: false });
  });

  it("rejects an invalid user key when the auth service answers", async () => {
    initAuth({ enabled: true, url: URL, timeoutMs: 5000 });
    stubFetch(async () => jsonResponse(200, INVALID));
    const res = await verifyUserKey("sk-bad", "default");
    expect(res.rejected).toBe(true);
    expect(res.rejectReason).toContain("invalid user_key");
  });

  describe("degradeOnUnreachable", () => {
    it("degrades to passthrough on network error when enabled", async () => {
      initAuth({ enabled: true, url: URL, timeoutMs: 5000, degradeOnUnreachable: true });
      stubFetch(async () => {
        throw new TypeError("fetch failed");
      });
      const res = await verifyUserKey("sk-any", "default");
      expect(res.rejected).toBe(false);
      expect(res.userId).toBe("");
    });

    it("still rejects on network error when disabled (default)", async () => {
      initAuth({ enabled: true, url: URL, timeoutMs: 5000, degradeOnUnreachable: false });
      stubFetch(async () => {
        throw new TypeError("fetch failed");
      });
      const res = await verifyUserKey("sk-any", "default");
      expect(res.rejected).toBe(true);
    });

    it("degrades on HTTP 5xx when enabled but keeps 4xx rejection", async () => {
      initAuth({ enabled: true, url: URL, timeoutMs: 5000, degradeOnUnreachable: true });
      stubFetch(async () => new Response("boom", { status: 503 }));
      const res5xx = await verifyUserKey("sk-any", "default");
      expect(res5xx.rejected).toBe(false);

      initAuth({ enabled: true, url: URL, timeoutMs: 5000, degradeOnUnreachable: true });
      stubFetch(async () => new Response("nope", { status: 401 }));
      const res4xx = await verifyUserKey("sk-any", "default");
      expect(res4xx.rejected).toBe(true);
    });
  });
});
