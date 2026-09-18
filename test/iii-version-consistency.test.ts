import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const root = join(import.meta.dirname, "..");
const expectedVersion = "0.12.0";
const operationalPins = [
  "bun.lock",
  "src/cli.ts",
  "src/cli/doctor-diagnostics.ts",
  "docker-compose.yml",
  "deploy/fly/Dockerfile",
  "deploy/railway/Dockerfile",
  "deploy/render/Dockerfile",
  "deploy/render/render.yaml",
  "deploy/coolify/Dockerfile",
  "deploy/coolify/docker-compose.yml",
  "eval/scripts/sandbox.sh",
  ".env.example",
];

describe("iii version pins", () => {
  it("keeps the SDK and engine pins on the same release", () => {
    const packageJson = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(packageJson.dependencies?.["iii-sdk"]).toBe(expectedVersion);

    for (const relativePath of operationalPins) {
      const content = readFileSync(join(root, relativePath), "utf8");
      expect(content).toContain(expectedVersion);
      expect(content).not.toContain("0.11.5");
    }
  });
});
