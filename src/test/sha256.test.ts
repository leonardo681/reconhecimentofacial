import { createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256HexJs } from "@/lib/sha256";
import { sha256Hex } from "@/lib/referenceDescriptors";

describe("sha256HexJs", () => {
  it("dá o mesmo resultado que o node:crypto em vários tamanhos", () => {
    for (const n of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 1000, 100_000]) {
      const data = randomBytes(n);
      expect(sha256HexJs(new Uint8Array(data))).toBe(createHash("sha256").update(data).digest("hex"));
    }
  });

  it("confere o vetor de teste oficial", () => {
    expect(sha256HexJs(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("sha256Hex", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa a versão em JS quando crypto.subtle não existe (http://IP-da-rede)", async () => {
    const data = randomBytes(5000);
    const esperado = createHash("sha256").update(data).digest("hex");
    vi.stubGlobal("crypto", {});
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    expect(await sha256Hex(buffer)).toBe(esperado);
  });
});
