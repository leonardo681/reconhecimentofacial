import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import CameraCapture, { type FacingMode, type FrozenImage } from "@/components/CameraCapture";
import QuickRegister, { type RegisterPayload } from "@/components/QuickRegister";
import { useFaceRecognition, type FaceResult } from "@/hooks/useFaceRecognition";
import { MATCH_LEVEL_LABEL, distanceToSimilarityPercent } from "@/lib/faceDescriptorSimilarity";
import { formatPersonMarks } from "@/data/persons";
import { canvasToDataUrl, cropToDataUrl, fileToCanvas } from "@/lib/images";
import { cn } from "@/lib/utils";

interface AnalyzedFace extends FaceResult {
  /** Miniatura recortada do rosto na imagem analisada. */
  thumb: string;
}

interface Analysis {
  frozen: FrozenImage;
  canvas: HTMLCanvasElement;
  faces: AnalyzedFace[];
  done: boolean;
}

const secondaryButton =
  "rounded-lg bg-secondary px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-secondary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";

export default function Index() {
  const { status, ready, progress, loadError, usingCdn, skippedPhotos, sessionCount, retry, analyze, addPerson } =
    useFaceRecognition();

  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<AnalyzedFace | null>(null);
  /** Cada análise ganha um número; resultados de análises antigas são descartados. */
  const scanIdRef = useRef(0);

  const runAnalysis = useCallback(
    async (getFrame: () => Promise<HTMLCanvasElement>, source: FrozenImage["source"]) => {
      const id = ++scanIdRef.current;
      setScanError(null);
      setScanning(true);
      try {
        const canvas = await getFrame();
        if (id !== scanIdRef.current) return;
        const frozen: FrozenImage = { url: canvasToDataUrl(canvas), width: canvas.width, height: canvas.height, source };
        setAnalysis({ frozen, canvas, faces: [], done: false });
        const results = await analyze(canvas);
        if (id !== scanIdRef.current) return;
        const faces = results.map((face) => ({ ...face, thumb: cropToDataUrl(canvas, face.box) }));
        setAnalysis({ frozen, canvas, faces, done: true });
      } catch (error) {
        if (id !== scanIdRef.current) return;
        const message = error instanceof Error ? error.message : "Não foi possível analisar a imagem.";
        setAnalysis(null);
        setScanError(message);
        toast.error(message);
      } finally {
        if (id === scanIdRef.current) setScanning(false);
      }
    },
    [analyze],
  );

  const handleCapture = useCallback(
    (frame: HTMLCanvasElement) => {
      if (!ready) return;
      void runAnalysis(async () => frame, "camera");
    },
    [ready, runAnalysis],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!ready) {
        setScanError("Aguarde o reconhecimento terminar de carregar.");
        return;
      }
      void runAnalysis(async () => {
        try {
          return await fileToCanvas(file);
        } catch {
          throw new Error("Não foi possível abrir esta imagem. Envie um arquivo JPG, PNG ou WEBP válido.");
        }
      }, "arquivo");
    },
    [ready, runAnalysis],
  );

  const resetView = useCallback(() => {
    scanIdRef.current++;
    setScanning(false);
    setAnalysis(null);
    setScanError(null);
  }, []);

  // O cadastro entra no histórico: o botão/gesto "voltar" do celular volta para a câmera
  // em vez de sair do app. A URL não muda; só acrescentamos uma entrada ao histórico.
  const openRegister = (face: AnalyzedFace) => {
    setRegistering(face);
    window.history.pushState({ ...(window.history.state ?? {}), cadastro: true }, "");
  };
  const closeRegister = () => {
    if ((window.history.state as { cadastro?: boolean } | null)?.cadastro) window.history.back();
    else setRegistering(null);
  };
  useEffect(() => {
    if (!registering) return;
    const onPopState = () => setRegistering(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [registering]);

  const handleRegister = async (payload: RegisterPayload) => {
    if (!registering) return;
    const face = registering;
    const result = await addPerson({
      name: payload.name,
      descriptor: face.descriptor,
      imageSrc: face.thumb,
      notes: payload.notes,
      bodyMarks: payload.bodyMarks,
      additionalPhotos: payload.additionalPhotos,
    });
    // O rosto cadastrado passa a aparecer como identificado no resultado atual.
    setAnalysis((prev) =>
      prev && {
        ...prev,
        faces: prev.faces.map((f) =>
          f.index === face.index ? { ...f, person: result.person, distance: 0, level: "alta" } : f,
        ),
      },
    );
    const ignored = result.rejected.length
      ? ` ${result.rejected.length} foto(s) extra(s) ignorada(s): ${result.rejected
          .map((r) => `foto ${r.photo} (${r.reason})`)
          .join(", ")}.`
      : "";
    toast.success(`${result.person.name} cadastrado(a) com ${result.descriptors} foto(s) de referência.${ignored}`);
    closeRegister();
  };

  // Os cadastros ficam só na memória: avisa antes de sair da página e perdê-los.
  useEffect(() => {
    if (!sessionCount) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sessionCount]);

  const statusText =
    status === "carregando-modelos"
      ? `Carregando modelos de reconhecimento… (${progress.modelsLoaded}/${progress.modelsTotal})`
      : status === "preparando-base"
        ? `Preparando base de rostos cadastrados… (${progress.photosDone}/${progress.photosTotal})`
        : null;
  const progressPercent =
    status === "carregando-modelos"
      ? (progress.modelsLoaded / progress.modelsTotal) * 50
      : status === "preparando-base"
        ? 50 + (progress.photosDone / Math.max(1, progress.photosTotal)) * 50
        : 100;

  const faces = analysis?.faces ?? [];
  const knownFaces = faces.filter((f) => f.person !== null);
  const unknownFaces = faces.filter((f) => f.person === null);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
            <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base leading-tight">PMSC — São José</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sistema de Reconhecimento Facial</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto min-h-0 w-full min-w-0 max-w-lg flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
        {status === "erro" && (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center" role="alert">
            <p className="font-heading text-destructive-text">Não foi possível carregar os modelos de IA</p>
            {loadError && <p className="text-sm text-muted-foreground">{loadError}</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Tentar novamente
              </button>
              <button type="button" onClick={() => window.location.reload()} className={secondaryButton}>
                Recarregar página
              </button>
            </div>
          </div>
        )}

        {statusText && (
          <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">{statusText}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {registering ? (
          <QuickRegister
            faceImage={registering.thumb}
            faceNumber={registering.index}
            onRegister={handleRegister}
            onCancel={closeRegister}
          />
        ) : (
          <>
            <CameraCapture
              facingMode={facingMode}
              onFacingModeChange={setFacingMode}
              ready={ready}
              scanning={scanning}
              frozen={analysis?.frozen ?? null}
              faces={faces}
              onCapture={handleCapture}
              onFile={handleFile}
              onResetView={resetView}
            />

            {scanError && (
              <p className="text-center text-sm text-destructive-text" role="alert">
                {scanError}
              </p>
            )}

            <div aria-live="polite" className="space-y-3">
              {analysis?.done && faces.length === 0 && (
                <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum rosto detectado na imagem.</p>
                  <button type="button" onClick={resetView} className={secondaryButton}>
                    Nova Consulta
                  </button>
                </div>
              )}

              {analysis?.done && faces.length > 0 && (
                <>
                  {knownFaces.map((face) => {
                    const person = face.person;
                    if (!person) return null;
                    return (
                      <div
                        key={face.index}
                        className="flex min-w-0 items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-3"
                      >
                        <img
                          src={person.imageSrc}
                          alt={person.name}
                          className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-heading text-sm text-foreground">
                            <span className="text-muted-foreground">#{face.index}</span> {person.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Compatibilidade: {distanceToSimilarityPercent(face.distance)}%
                          </p>
                          {formatPersonMarks(person).map((markInfo, markIndex) => (
                            <p key={markIndex} className="text-xs text-muted-foreground">
                              Marca {markIndex + 1}: {markInfo}
                            </p>
                          ))}
                          {person.notes && <p className="text-xs text-muted-foreground">Obs: {person.notes}</p>}
                        </div>
                        <span
                          className={cn(
                            "max-w-[7rem] text-right font-heading text-[11px] uppercase leading-tight",
                            face.level === "baixa" ? "text-accent" : "text-success",
                          )}
                        >
                          {face.level ? MATCH_LEVEL_LABEL[face.level] : "Identificado"}
                        </span>
                      </div>
                    );
                  })}

                  {unknownFaces.map((face) => (
                    <div
                      key={face.index}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                    >
                      <img
                        src={face.thumb}
                        alt={`Rosto número ${face.index}`}
                        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm text-foreground">
                          <span className="text-muted-foreground">#{face.index}</span> Pessoa Desconhecida
                        </p>
                        <p className="text-xs text-muted-foreground">Sem correspondência na base</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRegister(face)}
                        disabled={scanning}
                        aria-label={`Cadastrar rosto ${face.index}`}
                        className="rounded-md bg-accent px-3 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Cadastrar
                      </button>
                    </div>
                  ))}

                  <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Resultado automático, sujeito a erro: é só uma sugestão. Confirme a identidade por outros meios.
                  </p>

                  <button type="button" onClick={resetView} disabled={scanning} className={cn(secondaryButton, "w-full")}>
                    Nova Consulta
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {(sessionCount > 0 || usingCdn || skippedPhotos.length > 0) && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-card/40 p-3 text-[11px] text-muted-foreground">
            {sessionCount > 0 && (
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {sessionCount} cadastro(s) nesta sessão. Eles ficam só na memória e somem ao recarregar a página.
              </p>
            )}
            {usingCdn && <p>Os modelos foram baixados da CDN porque a pasta /models do site não respondeu.</p>}
            {skippedPhotos.length > 0 && (
              <p>Fotos da base sem rosto detectado (não serão reconhecidas): {skippedPhotos.join(", ")}.</p>
            )}
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="border-t border-border py-2">
        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Polícia Militar de Santa Catarina — Uso Restrito
        </p>
      </footer>
    </div>
  );
}
