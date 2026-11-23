import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Upload, UserPlus, X } from "lucide-react";

import {
  MARK_LOCATION_OPTIONS,
  MARK_TYPE_OPTIONS,
  formatBodyMark,
  type MarkLocation,
  type MarkType,
} from "@/data/persons";
import { ACCEPTED_IMAGE_INPUT, canvasToDataUrl, fileToCanvas, isAllowedImageFile } from "@/lib/images";

export interface BodyMarkInput {
  type: MarkType;
  location?: MarkLocation;
  observation?: string;
}

export interface RegisterPayload {
  name: string;
  notes: string;
  bodyMarks: BodyMarkInput[];
  /** Fotos extras já reduzidas, em data URL. */
  additionalPhotos: string[];
}

interface QuickRegisterProps {
  /** Recorte do rosto escolhido na análise. */
  faceImage: string;
  /** Número do rosto na imagem analisada. */
  faceNumber: number;
  /** Resolve quando o cadastro termina; rejeita com a mensagem de erro. */
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onCancel: () => void;
}

const emptyMarkDraft = () => ({
  type: "" as MarkType | "",
  location: "" as MarkLocation | "",
  observation: "",
});

const fieldClass =
  "w-full rounded-md border border-border bg-muted px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 sm:text-sm";
const labelClass = "mb-1 block font-heading text-xs uppercase tracking-wider text-muted-foreground";

export default function QuickRegister({ faceImage, faceNumber, onRegister, onCancel }: QuickRegisterProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [bodyMarks, setBodyMarks] = useState<BodyMarkInput[]>([]);
  const [markDraft, setMarkDraft] = useState(emptyMarkDraft);
  const [markError, setMarkError] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [readingPhotos, setReadingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const ids = {
    name: useId(),
    type: useId(),
    location: useId(),
    observation: useId(),
    notes: useId(),
    photos: useId(),
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buildMarkFromDraft = (): BodyMarkInput | null => {
    if (!markDraft.type) return null;
    return {
      type: markDraft.type,
      location: markDraft.location || undefined,
      observation: markDraft.observation.trim() || undefined,
    };
  };

  const addMark = () => {
    const mark = buildMarkFromDraft();
    if (!mark) {
      setMarkError("Selecione o tipo da marca antes de adicionar.");
      return;
    }
    setMarkError("");
    setBodyMarks((prev) => [...prev, mark]);
    setMarkDraft(emptyMarkDraft());
  };

  const removeMark = (index: number) => {
    setBodyMarks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting || readingPhotos) return;

    const pendingMark = buildMarkFromDraft();
    const allMarks = pendingMark ? [...bodyMarks, pendingMark] : bodyMarks;

    setSubmitting(true);
    setSubmitError("");
    try {
      await onRegister({
        name: name.trim(),
        notes: notes.trim(),
        bodyMarks: allMarks,
        additionalPhotos,
      });
    } catch (error) {
      if (mountedRef.current) {
        setSubmitError(error instanceof Error ? error.message : "Não foi possível concluir o cadastro.");
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleAdditionalPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Copia a lista ANTES de limpar o campo: limpar o valor esvazia o mesmo FileList.
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setUploadError("");
    if (!files.length) return;

    const validFiles = files.filter(isAllowedImageFile);
    const problems: string[] = [];
    if (validFiles.length !== files.length) problems.push("Alguns arquivos foram ignorados. Use JPG, PNG ou WEBP.");

    setReadingPhotos(true);
    const dataUrls: string[] = [];
    for (const file of validFiles) {
      try {
        dataUrls.push(canvasToDataUrl(await fileToCanvas(file)));
      } catch {
        problems.push(`Não foi possível abrir "${file.name}".`);
      }
    }
    if (!mountedRef.current) return;
    setReadingPhotos(false);
    if (dataUrls.length) setAdditionalPhotos((prev) => [...prev, ...dataUrls]);
    if (problems.length) setUploadError(problems.join(" "));
  };

  const removePhoto = (index: number) => {
    setAdditionalPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border-2 border-accent/50 bg-card p-6 glow-accent">
        <div className="mb-4 flex items-center gap-3">
          <UserPlus className="h-7 w-7 text-accent" aria-hidden="true" />
          <h2 className="font-heading text-xl text-foreground">Cadastro Rápido</h2>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-center font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
            Rosto selecionado (#{faceNumber})
          </p>
          <img
            src={faceImage}
            alt={`Rosto número ${faceNumber}, que será cadastrado`}
            className="mx-auto h-28 w-28 rounded-lg border border-border object-cover"
          />
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3" aria-busy={submitting}>
          <div>
            <label htmlFor={ids.name} className={labelClass}>
              Nome Completo *
            </label>
            <input
              id={ids.name}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              placeholder="Digite o nome..."
              autoComplete="off"
              required
              autoFocus
            />
          </div>

          <fieldset className="space-y-3 rounded-md border border-border/60 p-3">
            <legend className="px-1 font-heading text-xs uppercase tracking-wider text-muted-foreground">
              Marcas corporais (opcional)
            </legend>

            {bodyMarks.length > 0 && (
              <ul className="space-y-2">
                {bodyMarks.map((mark, index) => (
                  <li
                    key={`${mark.type}-${mark.location ?? "sem-local"}-${index}`}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2"
                  >
                    <span className="text-xs text-foreground">{formatBodyMark({ ...mark, id: String(index) })}</span>
                    <button
                      type="button"
                      onClick={() => removeMark(index)}
                      className="shrink-0 rounded-full bg-destructive p-1 text-destructive-foreground"
                      aria-label={`Remover marca ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label htmlFor={ids.type} className={labelClass}>
                Tipo
              </label>
              <select
                id={ids.type}
                value={markDraft.type}
                onChange={(e) => {
                  const value = e.target.value as MarkType | "";
                  setMarkDraft((prev) => ({
                    ...prev,
                    type: value,
                    location: value ? prev.location : "",
                    observation: value ? prev.observation : "",
                  }));
                  setMarkError("");
                }}
                className={fieldClass}
              >
                <option value="">Selecione...</option>
                {MARK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={ids.location} className={labelClass}>
                Local
              </label>
              <select
                id={ids.location}
                value={markDraft.location}
                onChange={(e) =>
                  setMarkDraft((prev) => ({
                    ...prev,
                    location: e.target.value as MarkLocation | "",
                  }))
                }
                disabled={!markDraft.type}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">Selecione...</option>
                {MARK_LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={ids.observation} className={labelClass}>
                Observação livre
              </label>
              <textarea
                id={ids.observation}
                value={markDraft.observation}
                onChange={(e) => setMarkDraft((prev) => ({ ...prev, observation: e.target.value }))}
                disabled={!markDraft.type}
                className={`${fieldClass} resize-none disabled:cursor-not-allowed disabled:opacity-50`}
                rows={2}
                placeholder="Descreva detalhes da tatuagem ou cicatriz..."
              />
            </div>

            <button
              type="button"
              onClick={addMark}
              disabled={!markDraft.type}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 font-heading text-xs uppercase tracking-wider text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar marca
            </button>
            {markError && (
              <p className="text-xs text-destructive-text" role="alert">
                {markError}
              </p>
            )}
          </fieldset>

          <div>
            <label htmlFor={ids.notes} className={labelClass}>
              Observações gerais
            </label>
            <textarea
              id={ids.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${fieldClass} resize-none`}
              rows={2}
              placeholder="Outras informações sobre a pessoa..."
            />
          </div>

          <div>
            <p id={ids.photos} className={labelClass}>
              Fotos Adicionais
            </p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Inclua outros ângulos da mesma pessoa para melhorar o reconhecimento. Fotos sem rosto ou de outra
              pessoa são ignoradas.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={readingPhotos || submitting}
              aria-describedby={ids.photos}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 font-heading text-xs uppercase tracking-wider text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {readingPhotos ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {readingPhotos ? "Lendo fotos..." : "Adicionar fotos"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_IMAGE_INPUT}
              multiple
              onChange={(e) => void handleAdditionalPhotos(e)}
              aria-label="Adicionar fotos extras"
            />
            {uploadError && (
              <p className="mt-1 text-xs text-destructive-text" role="alert">
                {uploadError}
              </p>
            )}
            {additionalPhotos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {additionalPhotos.map((photo, index) => (
                  <div key={`${index}-${photo.slice(-24)}`} className="relative">
                    <img
                      src={photo}
                      alt={`Foto adicional ${index + 1}`}
                      className="h-16 w-16 rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                      aria-label={`Remover foto adicional ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive-text" role="alert">
              {submitError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="flex items-center gap-1 rounded-lg bg-secondary px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-secondary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting || readingPhotos}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-accent-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
