import { createRoot } from "react-dom/client";
// Fontes servidas pelo próprio site (antes vinham do Google Fonts por @import, que bloqueava a renderização).
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/source-sans-3/300.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import App from "./App.tsx";
import { RootErrorBoundary } from "./components/RootErrorBoundary.tsx";
import "./index.css";

// Error boundaries não pegam erros de Promises: ao menos registra no console.
window.addEventListener("unhandledrejection", (event) => {
  console.error("Erro não tratado:", event.reason);
});

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
