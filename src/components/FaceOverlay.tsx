import { useEffect, useRef } from "react";
import type { FaceResult } from "@/hooks/useFaceRecognition";
import { distanceToSimilarityPercent } from "@/lib/faceDescriptorSimilarity";
import { containRect, labelLeft, labelTop, mapBox } from "@/lib/geometry";

interface FaceOverlayProps {
  faces: FaceResult[];
  /** Tamanho da imagem analisada (as caixas estão nesse sistema de coordenadas). */
  imageWidth: number;
  imageHeight: number;
}

const STROKE_MATCH = "#22c55e";
const STROKE_UNKNOWN = "#ef4444";
// Fundos escuros o bastante para o texto branco ter contraste (≥ 4,5:1).
const LABEL_MATCH = "rgba(21, 128, 61, 0.95)";
const LABEL_UNKNOWN = "rgba(185, 28, 28, 0.95)";
const LABEL_HEIGHT = 20;
const LABEL_PADDING = 6;

/**
 * Desenha as caixas e os rótulos por cima da imagem exibida com `object-contain`.
 * O canvas acompanha o tamanho real do quadro (e a densidade de pixels da tela),
 * então as caixas ficam alinhadas em qualquer proporção e o texto fica legível
 * mesmo em fotos enormes.
 */
export default function FaceOverlay({ faces, imageWidth, imageHeight }: FaceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
      if (!cssW || !cssH) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const fit = containRect(imageWidth, imageHeight, cssW, cssH);
      ctx.font = "600 13px 'Source Sans 3', system-ui, sans-serif";
      ctx.textBaseline = "middle";

      for (const face of faces) {
        const box = mapBox(face.box, fit);
        const matched = face.person !== null;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = matched ? STROKE_MATCH : STROKE_UNKNOWN;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const label = matched
          ? `#${face.index} ${face.person?.name} (${distanceToSimilarityPercent(face.distance)}%)`
          : `#${face.index} Desconhecido`;
        const labelWidth = Math.min(ctx.measureText(label).width + LABEL_PADDING * 2, cssW);
        const top = labelTop(box.y, LABEL_HEIGHT);
        const left = labelLeft(box.x, labelWidth, cssW);
        ctx.fillStyle = matched ? LABEL_MATCH : LABEL_UNKNOWN;
        ctx.fillRect(left, top, labelWidth, LABEL_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, left + LABEL_PADDING, top + LABEL_HEIGHT / 2, labelWidth - LABEL_PADDING * 2);
      }
    };

    draw();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(draw);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [faces, imageWidth, imageHeight]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
