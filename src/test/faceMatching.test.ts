import { describe, expect, it } from "vitest";
import { assignFaces, euclideanDistance } from "@/lib/faceMatching";

const vec = (...values: number[]) => Float32Array.from(values);
const ana = { id: "ana", name: "Ana" };
const bia = { id: "bia", name: "Bia" };

describe("euclideanDistance", () => {
  it("calcula a distância euclidiana", () => {
    expect(euclideanDistance(vec(0, 0), vec(3, 4))).toBe(5);
  });

  it("recusa descritores de tamanhos diferentes", () => {
    expect(() => euclideanDistance(vec(1), vec(1, 2))).toThrow();
  });
});

describe("assignFaces", () => {
  const base = [
    { person: ana, descriptor: vec(0, 0) },
    { person: bia, descriptor: vec(1, 0) },
  ];

  it("associa cada rosto à pessoa mais próxima abaixo do limiar", () => {
    const result = assignFaces([vec(0.05, 0), vec(0.98, 0)], base, 0.3);
    expect(result.map((r) => r.person?.id)).toEqual(["ana", "bia"]);
    expect(result[0].distance).toBeCloseTo(0.05);
  });

  it("marca como desconhecido quando ninguém fica abaixo do limiar", () => {
    expect(assignFaces([vec(5, 5)], base, 0.6)).toEqual([{ person: null, distance: null }]);
  });

  it("não atribui a mesma pessoa a dois rostos da mesma imagem", () => {
    const result = assignFaces([vec(0.2, 0), vec(0.1, 0)], [{ person: ana, descriptor: vec(0, 0) }], 0.6);
    expect(result[0].person).toBeNull();
    expect(result[1].person?.id).toBe("ana");
  });

  it("o rosto que perdeu a disputa pode ficar com o próximo candidato válido", () => {
    const result = assignFaces([vec(0.1, 0), vec(0.3, 0)], base, 0.9);
    expect(result.map((r) => r.person?.id)).toEqual(["ana", "bia"]);
  });

  it("usa a foto mais próxima quando a pessoa tem várias", () => {
    const result = assignFaces(
      [vec(2, 0)],
      [
        { person: ana, descriptor: vec(0, 0) },
        { person: ana, descriptor: vec(1.9, 0) },
      ],
      0.6,
    );
    expect(result[0].person?.id).toBe("ana");
    expect(result[0].distance).toBeCloseTo(0.1);
  });

  it("devolve lista vazia quando não há rostos", () => {
    expect(assignFaces([], base)).toEqual([]);
  });
});
