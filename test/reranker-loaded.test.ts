import { describe, it, expect, vi } from "bun:test";

const mockPipeline = vi.fn(async (text: string) => [
  { score: text.includes("First") ? 0.9 : 0.1 },
]);

vi.mock("@huggingface/transformers", () => ({
  pipeline: () => Promise.resolve(mockPipeline),
}));

const { rerank } = await import("../src/state/reranker.js");

describe("reranker with loaded pipeline", () => {
  it("invokes the @huggingface/transformers pipeline and reorders by score", async () => {
    const results = [
      { observation: { id: "o2", title: "Second", narrative: "" }, combinedScore: 0.9 },
      { observation: { id: "o1", title: "First", narrative: "" }, combinedScore: 0.5 },
    ] as any;

    const reranked = await rerank("query", results);

    expect(mockPipeline).toHaveBeenCalled();
    expect(reranked[0].observation.id).toBe("o1");
  });
});
