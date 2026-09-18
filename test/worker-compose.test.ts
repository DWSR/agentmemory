import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderWorkerCompose,
  workerComposeRuntimePath,
} from "../src/cli/worker-compose.js";

describe("worker compose rendering", () => {
  it("renders durable infrastructure paths and listener settings", () => {
    const template = readFileSync(
      join(import.meta.dirname, "..", "worker-compose.yaml"),
      "utf8",
    );
    const rendered = renderWorkerCompose(template, {
      dataDir: "/var/lib/agentmemory",
      httpHost: "127.0.0.1",
      restPort: 3211,
    });

    expect(rendered).toContain("file_path: '/var/lib/agentmemory/state_store.db'");
    expect(rendered).toContain("host: '127.0.0.1'");
    expect(rendered).toContain("port: 3211");
    expect(rendered).not.toContain("__AGENTMEMORY_");
  });

  it("keeps runtime compose state beside the data directory", () => {
    expect(workerComposeRuntimePath("/var/lib/agentmemory")).toBe(
      "/var/lib/agentmemory/worker-compose.runtime.yaml",
    );
  });
});
