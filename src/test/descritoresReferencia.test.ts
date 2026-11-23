import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import dados from "@/data/descritoresReferencia.json";
import { getPersonPhotoSources, initialPersons } from "@/data/persons";
import { DESCRIPTOR_CACHE_VERSION } from "@/lib/descriptorCache";

describe("descritores pré-calculados", () => {
  it("existem e estão atualizados para todas as fotos da base inicial", () => {
    expect(dados.versao).toBe(DESCRIPTOR_CACHE_VERSION);
    const entradas = dados.entradas as Record<string, { arquivo: string; descritor: number[] }>;
    for (const person of initialPersons) {
      for (const src of getPersonPhotoSources(person)) {
        const arquivo = decodeURIComponent(src.split("/").pop()?.split("?")[0] ?? src);
        const hash = createHash("sha256")
          .update(fs.readFileSync(path.resolve("src/assets/persons", arquivo)))
          .digest("hex");
        const entrada = entradas[hash];
        expect(entrada, `A foto ${arquivo} mudou ou é nova: rode "npm run descritores".`).toBeDefined();
        expect(entrada.descritor).toHaveLength(128);
      }
    }
  });
});
