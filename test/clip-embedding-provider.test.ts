import { describe, it, expect, vi } from "bun:test";

const textExtractor = vi.fn(async (texts: string[]) => ({
  tolist: () => texts.map(() => [0.1, 0.2]),
}));
const imageExtractor = vi.fn(async () => ({
  tolist: () => [[0.3, 0.4]],
  data: new Float32Array([0.3, 0.4]),
}));
const fromBlob = vi.fn(async () => ({}));
const pipeline = vi.fn((task: string) => {
  if (task === "feature-extraction") return Promise.resolve(textExtractor);
  if (task === "image-feature-extraction") return Promise.resolve(imageExtractor);
  return Promise.reject(new Error(`unmocked task: ${task}`));
});

vi.mock("@huggingface/transformers", () => ({
  pipeline,
  RawImage: { fromBlob },
}));

const { ClipEmbeddingProvider } = await import(
  "../src/providers/embedding/clip.js"
);

describe("ClipEmbeddingProvider (with loaded pipeline)", () => {
  it("loads text pipeline with dtype: q8 and returns mapped Float32Array", async () => {
    const vec = await new ClipEmbeddingProvider().embed("hello");

    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/clip-vit-base-patch32",
      { dtype: "q8" },
    );
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec).toEqual(new Float32Array([0.1, 0.2]));
  });

  it("embedBatch returns one Float32Array per input", async () => {
    const vecs = await new ClipEmbeddingProvider().embedBatch(["a", "b"]);

    expect(vecs).toHaveLength(2);
    for (const v of vecs) expect(v).toBeInstanceOf(Float32Array);
  });

  it("embedImage loads image pipeline with dtype: q8 and decodes data: URL", async () => {
    const vec = await new ClipEmbeddingProvider().embedImage("data:image/png;base64,AAAA");

    expect(pipeline).toHaveBeenCalledWith(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32",
      { dtype: "q8" },
    );
    expect(fromBlob).toHaveBeenCalled();
    expect(vec).toBeInstanceOf(Float32Array);
  });

  it("accepts custom model ID via constructor", async () => {
    await new ClipEmbeddingProvider("Xenova/clip-vit-large-patch14").embed("hello");

    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/clip-vit-large-patch14",
      { dtype: "q8" },
    );
  });
});
