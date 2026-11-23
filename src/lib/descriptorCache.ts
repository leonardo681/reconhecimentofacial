/**
 * Cache dos descritores das fotos de referência no navegador.
 *
 * A chave é o hash SHA-256 do conteúdo da foto: trocar a foto muda a chave e o
 * cache antigo é ignorado sozinho. Só guardamos descritores das fotos de
 * referência (que já são públicas); os cadastros da sessão continuam só em memória.
 */
export const DESCRIPTOR_CACHE_PREFIX = "reconhecimentofacial:descritor:";
const PREFIX = DESCRIPTOR_CACHE_PREFIX;

/** Mude esta versão se trocar o modelo, as opções do detector ou o tamanho de análise. */
export const DESCRIPTOR_CACHE_VERSION = "v1-ssd-mobilenetv1-0.22.2-1280";

const DESCRIPTOR_LENGTH = 128;

interface CacheEntry {
  v: string;
  d: number[];
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // acesso bloqueado (modo privado, cookies desativados…)
  }
}

export function readCachedDescriptor(key: string, storage: Storage | null = getStorage()): Float32Array | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CacheEntry>;
    if (entry.v !== DESCRIPTOR_CACHE_VERSION || !Array.isArray(entry.d) || entry.d.length !== DESCRIPTOR_LENGTH) {
      return null;
    }
    if (!entry.d.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return Float32Array.from(entry.d);
  } catch {
    return null;
  }
}

export function writeCachedDescriptor(
  key: string,
  descriptor: ArrayLike<number>,
  storage: Storage | null = getStorage(),
): void {
  if (!storage || descriptor.length !== DESCRIPTOR_LENGTH) return;
  try {
    const entry: CacheEntry = {
      v: DESCRIPTOR_CACHE_VERSION,
      d: Array.from(descriptor, (n) => Math.round(n * 1e6) / 1e6),
    };
    storage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Cota cheia ou armazenamento bloqueado: segue sem cache.
  }
}
