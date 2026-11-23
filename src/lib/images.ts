import { expandBox, fitWithin, type Box } from "./geometry";

/**
 * Maior lado usado na análise. O SSD MobileNet trabalha internamente em 512×512,
 * então reduzir fotos grandes (12–48 MP) não piora a detecção e evita picos de
 * memória e o limite de canvas do Safari no iOS.
 */
export const ANALYSIS_MAX_SIDE = 1280;

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Aceita JPG, JPEG, PNG e WEBP (pelo tipo MIME ou, se ele faltar, pela extensão). */
export function isAllowedImageFile(file: Pick<File, "type" | "name">): boolean {
  const mime = file.type.toLowerCase();
  if (mime && ACCEPTED_MIME_TYPES.has(mime)) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(name);
}

export const ACCEPTED_IMAGE_INPUT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** Carrega uma imagem e rejeita se o arquivo não for uma imagem válida. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = src;
  });
}

function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // O face-api.js lê os pixels deste canvas (getImageData): mantê-lo na memória da CPU evita cópias da GPU.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Este navegador não permite desenhar imagens (canvas 2D indisponível).");
  return { canvas, ctx };
}

/** Desenha a origem num canvas reduzido para no máximo `maxSide` no maior lado. */
export function drawScaled(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxSide: number = ANALYSIS_MAX_SIDE,
): HTMLCanvasElement {
  if (!srcW || !srcH) throw new Error("Imagem sem dimensões válidas.");
  const { width, height } = fitWithin(srcW, srcH, maxSide);
  const { canvas, ctx } = newCanvas(width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** Abre um arquivo (ou Blob) de imagem já reduzido. Rejeita arquivos que não são imagens válidas. */
export async function fileToCanvas(file: Blob, maxSide: number = ANALYSIS_MAX_SIDE): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Decodifica fora da thread principal e respeita a orientação EXIF.
      const bitmap = await createImageBitmap(file);
      try {
        return drawScaled(bitmap, bitmap.width, bitmap.height, maxSide);
      } finally {
        bitmap.close();
      }
    } catch {
      // Tenta de novo pelo <img> abaixo (navegadores sem suporte ao formato no createImageBitmap).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Abre uma imagem por URL (inclusive data URL) já reduzida. */
export async function urlToCanvas(src: string, maxSide: number = ANALYSIS_MAX_SIDE): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  return drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide);
}

/** Congela o quadro atual do vídeo num canvas reduzido. */
export function videoFrameToCanvas(video: HTMLVideoElement, maxSide: number = ANALYSIS_MAX_SIDE): HTMLCanvasElement {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("A câmera ainda não está pronta. Aguarde a imagem aparecer e tente de novo.");
  }
  return drawScaled(video, video.videoWidth, video.videoHeight, maxSide);
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.9): string {
  return canvas.toDataURL("image/jpeg", quality);
}

/** Recorta o rosto (com margem) e devolve uma miniatura em data URL. */
export function cropToDataUrl(
  canvas: HTMLCanvasElement,
  box: Box,
  { margin = 0.35, maxSide = 320 }: { margin?: number; maxSide?: number } = {},
): string {
  const r = expandBox(box, margin, canvas.width, canvas.height);
  const { width, height } = fitWithin(r.width, r.height, maxSide);
  const { canvas: out, ctx } = newCanvas(width, height);
  ctx.drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, width, height);
  return out.toDataURL("image/jpeg", 0.92);
}
