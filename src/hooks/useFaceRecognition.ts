import { useCallback, useEffect, useRef, useState } from "react";
import { getPersonPhotoSources, initialPersons, type BodyMark, type Person } from "@/data/persons";
import {
  FACE_MATCH_DISTANCE_THRESHOLD,
  distanceToSimilarityPercent,
  logFaceMatchDebug,
  matchLevel,
  type MatchLevel,
} from "@/lib/faceDescriptorSimilarity";
import { assignFaces, euclideanDistance } from "@/lib/faceMatching";
import { readCachedDescriptor, writeCachedDescriptor } from "@/lib/descriptorCache";
import { urlToCanvas } from "@/lib/images";
import { describeReferencePhoto, precomputedDescriptor, sha256Hex } from "@/lib/referenceDescriptors";
import { newId } from "@/lib/ids";
import { localDateISO } from "@/lib/dates";
import type { Box } from "@/lib/geometry";

type FaceApi = typeof import("face-api.js");

/** Pesos oficiais com versão fixa, usados só para o modelo que falhar em /models do site. */
const REMOTE_MODEL_BASE = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";
const LOAD_TIMEOUT_MS = 60_000;
const NET_NAMES = ["ssdMobilenetv1", "faceLandmark68Net", "faceRecognitionNet"] as const;

export type RecognitionStatus = "carregando-modelos" | "preparando-base" | "pronto" | "erro";

export interface LoadProgress {
  modelsLoaded: number;
  modelsTotal: number;
  photosDone: number;
  photosTotal: number;
}

export interface FaceResult {
  /** Número do rosto na imagem, da esquerda para a direita (1, 2, 3…). */
  index: number;
  person: Person | null;
  distance: number | null;
  level: MatchLevel | null;
  /** Caixa em pixels da imagem analisada. */
  box: Box;
  descriptor: Float32Array;
}

export interface NewPersonInput {
  name: string;
  /** Descritor do rosto escolhido na análise. */
  descriptor: Float32Array;
  /** Recorte do rosto escolhido (miniatura). */
  imageSrc: string;
  notes?: string;
  bodyMarks?: Omit<BodyMark, "id">[];
  /** Fotos extras já reduzidas, em data URL. */
  additionalPhotos?: string[];
}

export interface AddPersonResult {
  person: Person;
  descriptors: number;
  rejected: { photo: number; reason: string }[];
}

interface LabeledPerson {
  person: Person;
  descriptor: Float32Array;
  session: boolean;
}

let faceApiPromise: Promise<FaceApi> | null = null;

/** Carrega o face-api.js (e o TensorFlow.js) sob demanda, num chunk separado. */
function loadFaceApi(): Promise<FaceApi> {
  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js").catch((error) => {
      faceApiPromise = null;
      throw error;
    });
  }
  return faceApiPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Devolve o controle ao navegador entre tarefas pesadas, para a página não congelar. */
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const totalPhotos = initialPersons.reduce((sum, p) => sum + getPersonPhotoSources(p).length, 0);

export function useFaceRecognition() {
  const [status, setStatus] = useState<RecognitionStatus>("carregando-modelos");
  const [progress, setProgress] = useState<LoadProgress>({
    modelsLoaded: 0,
    modelsTotal: NET_NAMES.length,
    photosDone: 0,
    photosTotal: totalPhotos,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingCdn, setUsingCdn] = useState(false);
  const [skippedPhotos, setSkippedPhotos] = useState<string[]>([]);
  const [sessionPersons, setSessionPersons] = useState<Person[]>([]);
  const [attempt, setAttempt] = useState(0);

  const faceApiRef = useRef<FaceApi | null>(null);
  const labeledRef = useRef<LabeledPerson[]>([]);
  const statusRef = useRef<RecognitionStatus>(status);
  statusRef.current = status;

  // Carrega os modelos (um por um, com fallback individual) e monta a base de referência.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus("carregando-modelos");
      setLoadError(null);
      setProgress((p) => ({ ...p, modelsLoaded: 0, photosDone: 0 }));

      const faceapi = await withTimeout(
        loadFaceApi(),
        LOAD_TIMEOUT_MS,
        "Tempo esgotado ao carregar a biblioteca de reconhecimento.",
      );
      if (cancelled) return;
      faceApiRef.current = faceapi;

      const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      const localModels = `${base}models`;

      await Promise.all(
        NET_NAMES.map(async (name) => {
          const net = faceapi.nets[name];
          if (!net.isLoaded) {
            try {
              await withTimeout(net.loadFromUri(localModels), LOAD_TIMEOUT_MS, `Tempo esgotado ao baixar o modelo ${name}.`);
            } catch (error) {
              console.warn(`Modelo ${name} indisponível em ${localModels}; usando a CDN com versão fixa.`, error);
              if (!cancelled) setUsingCdn(true);
              await withTimeout(
                net.loadFromUri(REMOTE_MODEL_BASE),
                LOAD_TIMEOUT_MS,
                `Tempo esgotado ao baixar o modelo ${name} da CDN.`,
              );
            }
          }
          if (!cancelled) setProgress((p) => ({ ...p, modelsLoaded: p.modelsLoaded + 1 }));
        }),
      );
      if (cancelled) return;

      setStatus("preparando-base");
      const labeled: LabeledPerson[] = [];
      const skipped: string[] = [];

      for (const person of initialPersons) {
        for (const src of getPersonPhotoSources(person)) {
          if (cancelled) return;
          let descriptor: Float32Array | null = null;
          try {
            // 1º descritor pré-calculado (JSON), 2º cache do navegador, 3º calcula agora.
            // Tudo indexado pelo hash do conteúdo da foto: se a foto mudar, recalcula.
            const photo = await (await fetch(src)).blob();
            const hash = await sha256Hex(await photo.arrayBuffer());
            const cacheKey = hash ? `sha256:${hash}` : null;
            descriptor = (hash && precomputedDescriptor(hash)) || (cacheKey && readCachedDescriptor(cacheKey)) || null;
            if (!descriptor) {
              descriptor = await describeReferencePhoto(faceapi, photo);
              if (descriptor && cacheKey) writeCachedDescriptor(cacheKey, descriptor);
              await yieldToBrowser();
            }
          } catch (error) {
            console.warn(`Não foi possível processar a foto de ${person.name}:`, error);
          }
          if (descriptor) labeled.push({ person, descriptor, session: false });
          else skipped.push(person.name);
          if (!cancelled) setProgress((p) => ({ ...p, photosDone: p.photosDone + 1 }));
        }
      }
      if (cancelled) return;

      labeledRef.current = [...labeled, ...labeledRef.current.filter((entry) => entry.session)];
      if (skipped.length) console.warn("Fotos da base sem rosto detectado:", skipped);
      setSkippedPhotos(skipped);
      setStatus("pronto");
    };

    run().catch((error) => {
      if (cancelled) return;
      console.error("Falha ao preparar o reconhecimento facial:", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      setStatus("erro");
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /** Detecta todos os rostos da imagem e procura cada um na base (uma pessoa por rosto). */
  const analyze = useCallback(async (canvas: HTMLCanvasElement): Promise<FaceResult[]> => {
    const faceapi = faceApiRef.current;
    if (!faceapi || statusRef.current !== "pronto") {
      throw new Error("O reconhecimento ainda está carregando. Aguarde e tente de novo.");
    }
    const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors();
    const sorted = [...detections].sort((a, b) => a.detection.box.x - b.detection.box.x);
    const assignments = assignFaces(
      sorted.map((d) => d.descriptor),
      labeledRef.current,
      FACE_MATCH_DISTANCE_THRESHOLD,
    );
    return sorted.map((detection, i) => {
      const { x, y, width, height } = detection.detection.box;
      const { person, distance } = assignments[i];
      if (person && distance != null) {
        logFaceMatchDebug(`rosto #${i + 1} → ${person.name}`, distance, distanceToSimilarityPercent(distance));
      }
      return {
        index: i + 1,
        person,
        distance,
        level: distance != null ? matchLevel(distance) : null,
        box: { x, y, width, height },
        descriptor: detection.descriptor,
      };
    });
  }, []);

  /**
   * Cadastra a pessoa com o descritor do rosto escolhido e acrescenta à base sem
   * reprocessar nada. Fotos extras sem rosto ou de outra pessoa são recusadas.
   */
  const addPerson = useCallback(async (input: NewPersonInput): Promise<AddPersonResult> => {
    const faceapi = faceApiRef.current;
    if (!faceapi) throw new Error("O reconhecimento ainda está carregando.");
    const name = input.name.trim();
    if (!name) throw new Error("Informe o nome completo.");

    const accepted: string[] = [];
    const extraDescriptors: Float32Array[] = [];
    const rejected: AddPersonResult["rejected"] = [];

    const photos = input.additionalPhotos ?? [];
    for (let i = 0; i < photos.length; i++) {
      try {
        const canvas = await urlToCanvas(photos[i]);
        const detections = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors();
        if (!detections.length) {
          rejected.push({ photo: i + 1, reason: "nenhum rosto encontrado" });
        } else {
          const largest = detections.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a));
          if (euclideanDistance(largest.descriptor, input.descriptor) >= FACE_MATCH_DISTANCE_THRESHOLD) {
            rejected.push({ photo: i + 1, reason: "parece ser outra pessoa" });
          } else {
            accepted.push(photos[i]);
            extraDescriptors.push(largest.descriptor);
          }
        }
      } catch {
        rejected.push({ photo: i + 1, reason: "não foi possível ler a foto" });
      }
      await yieldToBrowser();
    }

    const person: Person = {
      id: newId(),
      name,
      imageSrc: input.imageSrc,
      notes: input.notes?.trim() || "",
      bodyMarks: (input.bodyMarks ?? []).map((mark) => ({
        ...mark,
        id: newId(),
        observation: mark.observation?.trim() || "",
      })),
      additionalPhotos: accepted,
      registeredAt: localDateISO(),
    };

    const entries: LabeledPerson[] = [input.descriptor, ...extraDescriptors].map((descriptor) => ({
      person,
      descriptor,
      session: true,
    }));
    labeledRef.current = [...labeledRef.current, ...entries];
    setSessionPersons((prev) => [...prev, person]);

    return { person, descriptors: entries.length, rejected };
  }, []);

  return {
    status,
    ready: status === "pronto",
    progress,
    loadError,
    usingCdn,
    skippedPhotos,
    sessionCount: sessionPersons.length,
    retry,
    analyze,
    addPerson,
  };
}
