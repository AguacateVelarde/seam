import { describe, expect, test } from "bun:test";
import { SeamClient, SeamError } from "./index";

function mockFetch(status: number, body: unknown, capture: { url?: string; headers?: Headers }) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    capture.url = String(input);
    capture.headers = new Headers(init?.headers);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("SeamClient", () => {
  test("sends key, user id and negotiated Accept header", async () => {
    const capture: { url?: string; headers?: Headers } = {};
    const client = new SeamClient({
      baseUrl: "https://seam.example.com/",
      apiKey: "sk_read_test",
      projectId: "01JBXW5CSAH8YJ3GVKQZJ5W7P0",
      fetch: mockFetch(200, { screen: "home" }, capture),
    });
    await client.getScreen("home", { userId: "u1", adapter: "stac" });
    expect(capture.url).toBe(
      "https://seam.example.com/v1/deliver/01JBXW5CSAH8YJ3GVKQZJ5W7P0/screens/home",
    );
    expect(capture.headers?.get("X-Seam-Key")).toBe("sk_read_test");
    expect(capture.headers?.get("X-User-Id")).toBe("u1");
    expect(capture.headers?.get("Accept")).toBe("application/vnd.seam.stac+json");
  });

  test("throws SeamError with the server error envelope", async () => {
    const capture = {};
    const client = new SeamClient({
      baseUrl: "https://seam.example.com",
      apiKey: "k",
      projectId: "p",
      fetch: mockFetch(404, { error: { code: "SCREEN_NOT_PUBLISHED", message: "nope" } }, capture),
    });
    try {
      await client.getScreen("home");
      throw new Error("expected SeamError");
    } catch (err) {
      expect(err).toBeInstanceOf(SeamError);
      expect((err as SeamError).code).toBe("SCREEN_NOT_PUBLISHED");
      expect((err as SeamError).status).toBe(404);
    }
  });
});
