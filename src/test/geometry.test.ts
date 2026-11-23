import { describe, expect, it } from "vitest";
import { containRect, expandBox, fitWithin, labelLeft, labelTop, mapBox } from "@/lib/geometry";

describe("containRect", () => {
  it("encaixa uma foto vertical 3:4 num quadro 4:3, com faixas nas laterais", () => {
    const rect = containRect(960, 1280, 400, 300);
    expect(rect.scale).toBeCloseTo(300 / 1280);
    expect(rect.width).toBeCloseTo(225);
    expect(rect.height).toBeCloseTo(300);
    expect(rect.offsetX).toBeCloseTo(87.5);
    expect(rect.offsetY).toBeCloseTo(0);
  });

  it("devolve zeros para dimensões inválidas", () => {
    expect(containRect(0, 100, 10, 10)).toEqual({ offsetX: 0, offsetY: 0, width: 0, height: 0, scale: 0 });
  });
});

describe("mapBox", () => {
  it("leva a caixa da imagem para a posição exibida no quadro", () => {
    const rect = containRect(960, 1280, 400, 300);
    const box = mapBox({ x: 480, y: 640, width: 96, height: 128 }, rect);
    expect(box.x).toBeCloseTo(87.5 + 480 * rect.scale);
    expect(box.y).toBeCloseTo(640 * rect.scale);
    expect(box.width).toBeCloseTo(96 * rect.scale);
    expect(box.height).toBeCloseTo(128 * rect.scale);
  });
});

describe("fitWithin", () => {
  it("reduz uma foto de 20 MP para 1280 px no maior lado", () => {
    expect(fitWithin(3840, 5120, 1280)).toEqual({ width: 960, height: 1280, scale: 0.25 });
  });

  it("não amplia imagens pequenas", () => {
    expect(fitWithin(640, 480, 1280)).toEqual({ width: 640, height: 480, scale: 1 });
  });
});

describe("expandBox", () => {
  it("acrescenta a margem sem passar das bordas da imagem", () => {
    expect(expandBox({ x: 10, y: 10, width: 100, height: 100 }, 0.5, 120, 1000)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 160,
    });
  });
});

describe("posição do rótulo", () => {
  it("fica acima da caixa quando há espaço", () => {
    expect(labelTop(50, 20)).toBe(28);
  });

  it("vai para dentro da caixa quando o rosto está colado no topo", () => {
    expect(labelTop(5, 20)).toBe(7);
  });

  it("não sai pelas laterais do quadro", () => {
    expect(labelLeft(380, 100, 400)).toBe(300);
    expect(labelLeft(-5, 50, 400)).toBe(0);
  });
});
