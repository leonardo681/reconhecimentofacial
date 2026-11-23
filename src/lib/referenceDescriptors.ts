import precomputed from "@/data/descritoresReferencia.json";
import { getPersonPhotoSources, initialPersons } from "@/data/persons";
import { DESCRIPTOR_CACHE_VERSION } from "./descriptorCache";
import { fileToCanvas } from "./images";

type FaceApi = typeof import("face-api.js");

interface PrecomputedFile {
  versao: string;
  entradas: Record<string, { arquivo: string; descritor: number[] }>;
}

const data = precomputed as PrecomputedFile;

/** SHA-256 em hexadecimal (null fora de contexto seguro, onde `crypto.subtle` não existe). */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Descritor pré-calculado (src/data/descritoresReferencia.json) para a foto com esse hash.
 * Se a foto mudar, o hash muda e o app volta a calcular o descritor no navegador.
 */
export function precomputedDescriptor(hash: string): Float32Array | null {
  if (data.versao !== DESCRIPTOR_CACHE_VERSION) return null;
  const entry = data.entradas[hash];
  if (!entry || entry.descritor.length !== 128) return null;
  return Float32Array.from(entry.descritor);
}

/**
 * Mesmo processamento usado para gerar o JSON e para calcular no navegador:
 * imagem reduzida a 1280 px + SSD MobileNet + landmarks + descritor.
 */
export async function describeReferencePhoto(faceapi: FaceApi, photo: Blob): Promise<Float32Array | null> {
  const canvas = await fileToCanvas(photo);
  const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
  return detection?.descriptor ?? null;
}

/**
 * Usado por `npm run descritores` (scripts/gerar-descritores.mjs): calcula os
 * descritores de todas as fotos da base inicial e devolve o conteúdo do JSON.
 */
export async function generateReferenceDescriptors(log: (message: string) => void = console.log): Promise<PrecomputedFile> {
  const faceapi = await import("face-api.js");
  const models = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}models`;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(models),
    faceapi.nets.faceLandmark68Net.loadFromUri(models),
    faceapi.nets.faceRecognitionNet.loadFromUri(models),
  ]);
  log("modelos carregados");
  const entradas: PrecomputedFile["entradas"] = {};
  for (const person of initialPersons) {
    for (const src of getPersonPhotoSources(person)) {
      const started = performance.now();
      const blob = await (await fetch(src)).blob();
      const hash = await sha256Hex(await blob.arrayBuffer());
      const descriptor = await describeReferencePhoto(faceapi, blob);
      const arquivo = decodeURIComponent(src.split("/").pop()?.split("?")[0] ?? src);
      log(`${person.name} (${arquivo}): ${descriptor ? "ok" : "SEM ROSTO"} em ${Math.round(performance.now() - started)} ms`);
      if (descriptor && hash) {
        entradas[hash] = { arquivo, descritor: Array.from(descriptor, (n) => Math.round(n * 1e6) / 1e6) };
      }
    }
  }
  return { versao: DESCRIPTOR_CACHE_VERSION, entradas };
}
