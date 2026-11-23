import { describe, expect, it } from "vitest";
import {
  FACE_MATCH_DISTANCE_THRESHOLD,
  MATCH_LEVEL_LABEL,
  distanceToSimilarityPercent,
  matchLevel,
} from "@/lib/faceDescriptorSimilarity";

describe("distanceToSimilarityPercent", () => {
  it("converte as distâncias nos percentuais documentados", () => {
    expect(distanceToSimilarityPercent(0)).toBe(100);
    expect(distanceToSimilarityPercent(0.2)).toBe(93);
    expect(distanceToSimilarityPercent(0.3)).toBe(89);
    expect(distanceToSimilarityPercent(0.4)).toBe(84);
    expect(distanceToSimilarityPercent(0.5)).toBe(79);
    expect(distanceToSimilarityPercent(0.599)).toBe(73);
  });

  it("devolve 0 no limiar, acima dele e para valores inválidos", () => {
    expect(distanceToSimilarityPercent(FACE_MATCH_DISTANCE_THRESHOLD)).toBe(0);
    expect(distanceToSimilarityPercent(0.9)).toBe(0);
    expect(distanceToSimilarityPercent(null)).toBe(0);
    expect(distanceToSimilarityPercent(undefined)).toBe(0);
    expect(distanceToSimilarityPercent(Number.NaN)).toBe(0);
  });

  it("trata distância negativa como 100%", () => {
    expect(distanceToSimilarityPercent(-0.1)).toBe(100);
  });

  it("é monotônica: quanto menor a distância, maior o percentual", () => {
    let previous = Infinity;
    for (let d = 0; d < FACE_MATCH_DISTANCE_THRESHOLD; d += 0.05) {
      const percent = distanceToSimilarityPercent(d);
      expect(percent).toBeLessThanOrEqual(previous);
      previous = percent;
    }
  });
});

describe("matchLevel", () => {
  it("classifica a correspondência em alta, média e baixa", () => {
    expect(matchLevel(0.1)).toBe("alta");
    expect(matchLevel(0.399)).toBe("alta");
    expect(matchLevel(0.4)).toBe("media");
    expect(matchLevel(0.499)).toBe("media");
    expect(matchLevel(0.5)).toBe("baixa");
    expect(matchLevel(0.59)).toBe("baixa");
  });

  it("tem um rótulo para cada faixa", () => {
    expect(Object.keys(MATCH_LEVEL_LABEL).sort()).toEqual(["alta", "baixa", "media"]);
    expect(MATCH_LEVEL_LABEL.baixa).toMatch(/confira/i);
  });
});
