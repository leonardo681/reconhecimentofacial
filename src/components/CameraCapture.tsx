import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Upload } from "lucide-react";
import FaceOverlay from "@/components/FaceOverlay";
import type { FaceResult } from "@/hooks/useFaceRecognition";
import { CAMERA_ENDED_MESSAGE, cameraAvailabilityProblem, cameraErrorMessage } from "@/lib/cameraErrors";
import { ACCEPTED_IMAGE_INPUT, isAllowedImageFile, videoFrameToCanvas } from "@/lib/images";
import { cn } from "@/lib/utils";

export type FacingMode = "user" | "environment";

/** Imagem analisada, mostrada congelada no quadro (captura da câmera ou arquivo enviado). */
export interface FrozenImage {
  url: string;
  width: number;
  height: number;
  source: "camera" | "arquivo";
}

interface CameraCaptureProps {
  facingMode: FacingMode;
  onFacingModeChange: (mode: FacingMode) => void;
  /** Modelos e base prontos: libera "Capturar" e "Enviar imagem". */
  ready: boolean;
  scanning: boolean;
  frozen: FrozenImage | null;
  faces: FaceResult[];
  onCapture: (frame: HTMLCanvasElement) => void;
  onFile: (file: File) => void;
  /** Volta ao vídeo ao vivo, descartando a imagem analisada. */
  onResetView: () => void;
}

const facingButton = (active: boolean) =>
  cn(
    "flex-1 max-w-[9rem] rounded-lg px-3 py-2 font-heading text-xs font-semibold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40",
    active
      ? "bg-primary-strong text-primary-foreground glow-primary"
      : "bg-secondary text-secondary-foreground hover:brightness-110",
  );

export default function CameraCapture({
  facingMode,
  onFacingModeChange,
  ready,
  scanning,
  frozen,
  faces,
  onCapture,
  onFile,
  onResetView,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** O stream fica num ref próprio: no unmount o React já zerou o videoRef. */
  const streamRef = useRef<MediaStream | null>(null);
  /** Identifica o pedido de câmera mais recente; respostas de pedidos antigos são descartadas. */
  const requestIdRef = useRef(0);
  const [streaming, setStreaming] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraNotice, setCameraNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [restartKey, setRestartKey] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let disposed = false;

    const problem = cameraAvailabilityProblem();
    if (problem) {
      setCameraError(problem);
      return;
    }
    setCameraError("");

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      .then((stream) => {
        if (disposed || requestId !== requestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (requestId !== requestIdRef.current) return;
          setStreaming(false);
          setCameraError(CAMERA_ENDED_MESSAGE);
        });
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {
            // O autoplay pode ser recusado; o vídeo começa no próximo toque.
          });
        }
      })
      .catch((error: unknown) => {
        if (disposed || requestId !== requestIdRef.current) return;
        if (facingMode === "environment") {
          setCameraNotice("Não foi possível usar a câmera traseira neste dispositivo. Voltamos para a frontal.");
          onFacingModeChange("user");
          return;
        }
        setCameraError(cameraErrorMessage(error));
      });

    return () => {
      disposed = true;
      stopStream();
    };
  }, [facingMode, restartKey, stopStream, onFacingModeChange]);

  // Desliga a câmera quando a aba vai para segundo plano e religa ao voltar.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        requestIdRef.current++;
        stopStream();
      } else {
        setRestartKey((key) => key + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [stopStream]);

  const handleLoadedMetadata = () => {
    // Só agora o vídeo tem largura/altura: antes disso a captura sairia vazia (0×0).
    setStreaming(true);
    setCameraError("");
  };

  const selectFacing = async (mode: FacingMode) => {
    if (scanning || mode === facingMode) return;
    setCameraNotice("");
    if (mode === "environment") {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.();
        const cameras = devices?.filter((device) => device.kind === "videoinput") ?? [];
        if (cameras.length === 1) {
          setCameraNotice("Este dispositivo possui apenas uma câmera disponível.");
          return;
        }
      } catch {
        // Sem a lista de dispositivos, tenta abrir a traseira mesmo assim.
      }
    }
    onFacingModeChange(mode);
  };

  const capture = () => {
    if (frozen) {
      onResetView();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    try {
      onCapture(videoFrameToCanvas(video));
    } catch (error) {
      setCameraNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const restartCamera = () => {
    setCameraNotice("");
    setCameraError("");
    onResetView();
    setRestartKey((key) => key + 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setUploadError("");
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      setUploadError("Formato inválido. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
      return;
    }
    onFile(file);
  };

  const canCapture = frozen ? !scanning : ready && streaming && !scanning;
  const captureLabel = scanning ? "Analisando..." : frozen ? "Nova captura" : "Capturar";

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-3 sm:gap-4">
      <fieldset className="m-0 flex w-full min-w-0 max-w-md flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Câmera</legend>
        <p className="text-center font-heading text-[10px] uppercase tracking-widest text-muted-foreground" aria-hidden="true">
          Câmera
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => void selectFacing("user")}
            disabled={scanning}
            aria-pressed={facingMode === "user"}
            className={facingButton(facingMode === "user")}
          >
            Frontal
          </button>
          <button
            type="button"
            onClick={() => void selectFacing("environment")}
            disabled={scanning}
            aria-pressed={facingMode === "environment"}
            className={facingButton(facingMode === "environment")}
          >
            Traseira
          </button>
        </div>
      </fieldset>

      {/* Quadro 4:3; a largura é limitada pela altura da tela (svh) também em telas largas e no celular deitado. */}
      <div className="relative mx-auto aspect-[4/3] w-full min-w-0 max-w-[min(100%,28rem,calc(52svh*4/3))] overflow-hidden rounded-lg border-2 border-primary/50 bg-muted glow-primary">
        {scanning && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary/70 animate-scan motion-reduce:animate-none" />
          </div>
        )}
        {/* Cantos */}
        <div className="absolute left-2 top-2 z-10 h-6 w-6 border-l-2 border-t-2 border-primary" />
        <div className="absolute right-2 top-2 z-10 h-6 w-6 border-r-2 border-t-2 border-primary" />
        <div className="absolute bottom-2 left-2 z-10 h-6 w-6 border-b-2 border-l-2 border-primary" />
        <div className="absolute bottom-2 right-2 z-10 h-6 w-6 border-b-2 border-r-2 border-primary" />

        {frozen && (
          <div className="absolute left-1/2 top-2 z-[25] -translate-x-1/2 rounded-md border border-primary/40 bg-background/90 px-2 py-1 font-heading text-[10px] uppercase tracking-wider text-primary">
            {frozen.source === "camera" ? "Quadro capturado" : "Imagem enviada"}
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className={cn("absolute inset-0 z-0 h-full w-full object-cover", frozen && "invisible")}
        />
        {frozen && (
          <>
            <img
              src={frozen.url}
              alt={frozen.source === "camera" ? "Quadro capturado para análise" : "Imagem enviada para análise"}
              className="absolute inset-0 z-[5] h-full w-full bg-muted object-contain"
            />
            <FaceOverlay faces={faces} imageWidth={frozen.width} imageHeight={frozen.height} />
          </>
        )}

        {cameraError && !frozen && (
          <div className="absolute inset-0 z-[15] flex items-center justify-center bg-background/85 p-4">
            <p className="text-center text-sm text-destructive-text" role="alert">
              {cameraError}
            </p>
          </div>
        )}
      </div>

      {cameraNotice && (
        <p className="max-w-md px-2 text-center text-sm text-muted-foreground" role="status">
          {cameraNotice}
        </p>
      )}
      {uploadError && (
        <p className="max-w-md px-2 text-center text-sm text-destructive-text" role="alert">
          {uploadError}
        </p>
      )}

      <div className="flex w-full min-w-0 max-w-md flex-wrap justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={capture}
          disabled={!canCapture}
          className="flex min-w-[8.5rem] flex-1 items-center justify-center gap-2 rounded-lg bg-primary-strong px-3 py-2.5 font-heading text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 glow-primary sm:min-w-0 sm:flex-none sm:px-6 sm:py-3"
        >
          <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
          {captureLabel}
        </button>
        <button
          type="button"
          onClick={restartCamera}
          aria-label="Reiniciar câmera"
          title="Reiniciar câmera"
          className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2.5 font-heading text-sm font-semibold uppercase tracking-wider text-secondary-foreground transition hover:brightness-110 sm:px-4 sm:py-3"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning || !ready}
          className="flex min-w-0 flex-1 basis-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2.5 font-heading text-sm font-semibold uppercase tracking-wider text-secondary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:basis-auto sm:px-4 sm:py-3"
        >
          <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Enviar imagem</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_IMAGE_INPUT}
          onChange={handleFileChange}
          aria-label="Enviar imagem do dispositivo"
        />
      </div>
    </div>
  );
}
