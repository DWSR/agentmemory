import { describe, it, expect, vi } from "bun:test";

vi.mock("@huggingface/transformers", () => {
  throw Object.assign(new Error("Cannot find package"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});

const { LocalEmbeddingProvider } = await import(
  "../src/providers/embedding/local.js"
);

describe("LocalEmbeddingProvider (package unavailable)", () => {
  it("throws clean install hint when @huggingface/transformers is missing", async () => {
    await expect(new LocalEmbeddingProvider().embed("hello")).rejects.toThrow(
      "Install @huggingface/transformers for local embeddings",
    );
  });
});
