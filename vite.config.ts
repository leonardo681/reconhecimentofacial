import { defineConfig, type Plugin, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * GitHub Pages: copia o index.html para 404.html no fim do build, para links
 * diretos de rotas do SPA funcionarem. Substitui o antigo `cp`/`touch` do
 * package.json, que não existem no Windows. O .nojekyll vem de public/.
 */
function spaFallback404(): Plugin {
  let outDir = "dist";
  return {
    name: "spa-fallback-404",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = path.join(outDir, "index.html");
      if (existsSync(index)) copyFileSync(index, path.join(outDir, "404.html"));
    },
  };
}

// https://vitejs.dev/config/
// GitHub Pages project URL: https://<user>.github.io/<repo>/
export default defineConfig(({ mode }) => {
  // `npm run dev:celular`: abre na rede local com HTTPS (certificado autoassinado),
  // porque a câmera só funciona em conexão segura.
  const celular = mode === "celular";
  const plugins: PluginOption[] = [react(), spaFallback404()];
  if (celular) plugins.push(basicSsl());

  return {
    base: mode === "production" ? "/reconhecimentofacial/" : "/",
    server: {
      // Só nesta máquina por padrão; na rede, apenas com `npm run dev:celular`.
      host: celular ? true : "localhost",
      port: 8080,
      // `npm run descritores` desliga o HMR: editar um arquivo durante a geração
      // recarregaria a página e perderia o resultado.
      hmr: process.env.VITE_SEM_HMR ? false : { overlay: false },
    },
    preview: {
      host: "localhost",
      port: 4173,
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    build: {
      // O face-api.js + TensorFlow.js (~640 kB) fica num chunk próprio, baixado sob demanda.
      chunkSizeWarningLimit: 700,
    },
  };
});
