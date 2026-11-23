import { describe, expect, it } from "vitest";
import {
  DESCRIPTOR_CACHE_PREFIX,
  DESCRIPTOR_CACHE_VERSION,
  readCachedDescriptor,
  writeCachedDescriptor,
} from "@/lib/descriptorCache";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const descriptor = () => Float32Array.from({ length: 128 }, (_, i) => (i - 64) / 1000);

describe("cache de descritores", () => {
  it("grava e lê o descritor", () => {
    const storage = new MemoryStorage();
    writeCachedDescriptor("/assets/Ana-123.jpeg", descriptor(), storage);
    const read = readCachedDescriptor("/assets/Ana-123.jpeg", storage);
    expect(read).not.toBeNull();
    expect(read).toHaveLength(128);
    expect(read?.[70]).toBeCloseTo(0.006, 6);
  });

  it("ignora entradas de outra versão, com tamanho errado ou corrompidas", () => {
    const storage = new MemoryStorage();
    storage.setItem(`${DESCRIPTOR_CACHE_PREFIX}a`, JSON.stringify({ v: "outra", d: new Array(128).fill(0) }));
    storage.setItem(`${DESCRIPTOR_CACHE_PREFIX}b`, JSON.stringify({ v: DESCRIPTOR_CACHE_VERSION, d: [1, 2, 3] }));
    storage.setItem(`${DESCRIPTOR_CACHE_PREFIX}c`, "{isto não é json");
    expect(readCachedDescriptor("a", storage)).toBeNull();
    expect(readCachedDescriptor("b", storage)).toBeNull();
    expect(readCachedDescriptor("c", storage)).toBeNull();
    expect(readCachedDescriptor("inexistente", storage)).toBeNull();
  });

  it("não quebra sem armazenamento ou com a cota cheia", () => {
    expect(readCachedDescriptor("a", null)).toBeNull();
    expect(() => writeCachedDescriptor("a", descriptor(), null)).not.toThrow();
    const full = new MemoryStorage();
    full.setItem = () => {
      throw new DOMException("cheio", "QuotaExceededError");
    };
    expect(() => writeCachedDescriptor("a", descriptor(), full)).not.toThrow();
  });
});
