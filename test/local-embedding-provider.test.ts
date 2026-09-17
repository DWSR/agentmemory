import { describe, it, expect, vi } from "bun:test";

const extractor = vi.fn(async (texts: string[]) => ({
  tolist: () => texts.map(() => [0.1, 0.2, 0.3]),
}));
const pipeline = vi.fn(() => Promise.resolve(extractor));

vi.mock("@huggingface/transformers", () => ({ pipeline }));

const { LocalEmbeddingProvider } = await import(
  "../src/providers/embedding/local.js"
);

describe("LocalEmbeddingProvider (with loaded pipeline)", () => {
  it("calls pipeline with dtype: q8, passes extractor opts, returns mapped Float32Array", async () => {
    const vec = await new LocalEmbeddingProvider().embed("hello");

    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "q8" },
    );
    expect(extractor).toHaveBeenCalledWith(["hello"], {
      pooling: "mean",
      normalize: true,
    });
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec).toEqual(new Float32Array([0.1, 0.2, 0.3]));
  });

  it("embedBatch returns one Float32Array per input text", async () => {
    const vecs = await new LocalEmbeddingProvider().embedBatch(["a", "b", "c"]);

    expect(vecs).toHaveLength(3);
    for (const v of vecs) expect(v).toBeInstanceOf(Float32Array);
  });
});
