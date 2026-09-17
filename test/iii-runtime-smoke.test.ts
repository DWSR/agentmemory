import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const enabled = process.env["AGENTMEMORY_RUNTIME_SMOKE"] === "1";
const suite = enabled ? describe : describe.skip;
const baseUrl = process.env["AGENTMEMORY_URL"] || "http://localhost:3111";
const secret = process.env["AGENTMEMORY_SECRET"] || "";
const marker = `iii-runtime-smoke-${Date.now()}-${process.pid}`;
const project = `/tmp/${marker}`;
let memoryId: string | undefined;

function headers(): Record<string, string> {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) result.Authorization = `Bearer ${secret}`;
  return result;
}

async function waitForLivez(): Promise<Response> {
  const deadline = Date.now() + 30_000;
  let lastResponse: Response | undefined;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/agentmemory/livez`, {
        signal: AbortSignal.timeout(2_000),
      });
      lastResponse = response;
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `agentmemory did not register /agentmemory/livez at ${baseUrl} within 30s` +
      (lastResponse ? ` (last status ${lastResponse.status})` : ""),
  );
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

suite("iii runtime smoke", () => {
  beforeAll(async () => {
    const response = await waitForLivez();
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    if (!memoryId) return;
    await fetch(`${baseUrl}/agentmemory/forget`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ memoryId }),
    }).catch(() => {});
  });

  it("serves health and exposes the registered workers", async () => {
    const response = await fetch(`${baseUrl}/agentmemory/health`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);

    const body = (await json(response)) as {
      service: string;
      health?: { workers?: Array<{ id: string; name: string; status: string }> };
    };
    expect(body.service).toBe("agentmemory");
    expect(Array.isArray(body.health?.workers)).toBe(true);
    expect(body.health?.workers?.length ?? 0).toBeGreaterThan(0);
  });

  it("preserves the save-to-search path", async () => {
    const save = await fetch(`${baseUrl}/agentmemory/remember`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        content: `Runtime compatibility marker ${marker}`,
        type: "fact",
        project,
      }),
    });
    expect(save.status).toBe(201);

    const saved = (await json(save)) as {
      memory?: { id?: string };
    };
    memoryId = saved.memory?.id;
    expect(memoryId).toMatch(/^mem_/);

    const search = await fetch(`${baseUrl}/agentmemory/smart-search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ query: marker, limit: 5, project }),
    });
    expect(search.status).toBe(200);

    const result = (await json(search)) as {
      results?: Array<{ obsId?: string; title?: string }>;
    };
    expect(
      result.results?.some(
        (hit) => hit.obsId === memoryId || hit.title?.includes(marker),
      ),
    ).toBe(true);
  });
});
