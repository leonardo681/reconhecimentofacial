import { describe, expect, it } from "vitest";
import { newId } from "@/lib/ids";
import { localDateISO } from "@/lib/dates";
import {
  INSECURE_CONTEXT_MESSAGE,
  UNSUPPORTED_MESSAGE,
  cameraAvailabilityProblem,
  cameraErrorMessage,
} from "@/lib/cameraErrors";
import { isAllowedImageFile } from "@/lib/images";
import { formatBodyMark, formatPersonMarks, getPersonPhotoSources, initialPersons, type Person } from "@/data/persons";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("gera UUID v4", () => {
    expect(newId()).toMatch(UUID_V4);
    expect(newId()).not.toBe(newId());
  });

  it("funciona sem crypto.randomUUID (página aberta por http://IP-da-rede)", () => {
    const getRandomValues = (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) array[i] = (i * 37 + 11) & 0xff;
      return array;
    };
    expect(newId({ getRandomValues })).toMatch(UUID_V4);
  });

  it("funciona até sem crypto", () => {
    expect(newId({})).toMatch(UUID_V4);
  });
});

describe("localDateISO", () => {
  it("usa a data local: cadastro às 23h30 não vira o dia seguinte", () => {
    expect(localDateISO(new Date(2026, 10, 22, 23, 30))).toBe("2026-11-22");
    // 02h30 UTC do dia 23 = 23h30 do dia 22 em São Paulo (o vitest.config.ts fixa esse fuso).
    expect(localDateISO(new Date(Date.UTC(2026, 10, 23, 2, 30)))).toBe("2026-11-22");
  });

  it("completa mês e dia com zero", () => {
    expect(localDateISO(new Date(2026, 0, 5, 1, 0))).toBe("2026-01-05");
  });
});

describe("mensagens da câmera", () => {
  it("explica cada erro do getUserMedia", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toMatch(/Permissão da câmera negada/);
    expect(cameraErrorMessage({ name: "NotReadableError" })).toMatch(/em uso/);
    expect(cameraErrorMessage({ name: "NotFoundError" })).toMatch(/Nenhuma câmera/);
    expect(cameraErrorMessage(new Error("qualquer"))).toMatch(/Não foi possível acessar a câmera/);
  });

  it("detecta contexto inseguro e navegador sem suporte", () => {
    expect(cameraAvailabilityProblem({ isSecureContext: false, hasGetUserMedia: false })).toBe(INSECURE_CONTEXT_MESSAGE);
    expect(cameraAvailabilityProblem({ isSecureContext: true, hasGetUserMedia: false })).toBe(UNSUPPORTED_MESSAGE);
    expect(cameraAvailabilityProblem({ isSecureContext: true, hasGetUserMedia: true })).toBeNull();
  });
});

describe("isAllowedImageFile", () => {
  it("aceita JPG, PNG e WEBP pelo tipo ou pela extensão", () => {
    expect(isAllowedImageFile({ type: "image/jpeg", name: "a.bin" })).toBe(true);
    expect(isAllowedImageFile({ type: "", name: "foto.WEBP" })).toBe(true);
    expect(isAllowedImageFile({ type: "image/gif", name: "anim.gif" })).toBe(false);
    expect(isAllowedImageFile({ type: "", name: "foto.heic" })).toBe(false);
  });
});

describe("dados das pessoas", () => {
  it("formata marcas corporais", () => {
    expect(formatBodyMark({ id: "1", type: "tatuagem", location: "braco", observation: "  dragão " })).toBe(
      "Tatuagem — Braço — dragão",
    );
    expect(formatBodyMark({ id: "2", type: "cicatriz", observation: "   " })).toBe("Cicatriz");
  });

  it("lida com pessoa sem marcas e inclui as fotos adicionais", () => {
    const person: Person = {
      id: "x",
      name: "X",
      imageSrc: "a.jpg",
      registeredAt: "2026-01-01",
      additionalPhotos: ["b.jpg", "c.jpg"],
    };
    expect(formatPersonMarks(person)).toEqual([]);
    expect(getPersonPhotoSources(person)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("a base inicial tem 12 pessoas com ids únicos", () => {
    expect(initialPersons).toHaveLength(12);
    expect(new Set(initialPersons.map((p) => p.id)).size).toBe(12);
  });
});
