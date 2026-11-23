export const INSECURE_CONTEXT_MESSAGE =
  'A câmera só funciona em conexão segura (HTTPS) ou em localhost. Você ainda pode usar "Enviar imagem".';

export const UNSUPPORTED_MESSAGE = 'Este navegador não dá acesso à câmera. Você ainda pode usar "Enviar imagem".';

export const CAMERA_ENDED_MESSAGE = "A câmera foi desconectada ou parou de responder. Toque em reiniciar.";

/** Verifica se dá para pedir a câmera neste contexto. Devolve a mensagem do problema, se houver. */
export function cameraAvailabilityProblem(
  env: { isSecureContext: boolean; hasGetUserMedia: boolean } = {
    isSecureContext: typeof window !== "undefined" && window.isSecureContext,
    hasGetUserMedia: typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function",
  },
): string | null {
  if (!env.isSecureContext) return INSECURE_CONTEXT_MESSAGE;
  if (!env.hasGetUserMedia) return UNSUPPORTED_MESSAGE;
  return null;
}

/** Traduz o erro do getUserMedia numa mensagem que diz o que fazer. */
export function cameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Permissão da câmera negada. Libere a câmera nas configurações do navegador e toque em reiniciar.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "Nenhuma câmera compatível foi encontrada neste dispositivo.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "A câmera está em uso por outro aplicativo ou não respondeu. Feche o outro app e toque em reiniciar.";
    default:
      return "Não foi possível acessar a câmera. Verifique as permissões e toque em reiniciar.";
  }
}
