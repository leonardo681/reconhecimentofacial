// Gera src/data/descritoresReferencia.json com os descritores das fotos da base inicial.
// Rode `npm run descritores` sempre que trocar ou acrescentar fotos em src/assets/persons.
// Usa o Google Chrome instalado (ou PW_CHANNEL=chromium após `npx playwright install chromium`).
// Em máquinas lentas pode levar dezenas de minutos: não edite arquivos do projeto enquanto roda.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 5179;
const URL_PAGINA = `http://localhost:${PORT}/scripts/gerar-descritores.html`;
const SAIDA = path.resolve("src/data/descritoresReferencia.json");

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, VITE_SEM_HMR: "1" },
});
let servidorSaiu = false;
server.on("exit", (code) => {
  servidorSaiu = true;
  console.log(`(servidor do Vite encerrado, código ${code})`);
});
const encerrar = () => {
  if (!server.killed) server.kill();
};
process.on("exit", encerrar);

async function esperarServidor() {
  for (let i = 0; i < 300; i++) {
    if (servidorSaiu) throw new Error("O servidor do Vite encerrou antes de responder.");
    try {
      const res = await fetch(URL_PAGINA);
      if (res.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O servidor do Vite não respondeu.");
}

let browser;
try {
  await esperarServidor();
  const canal = process.env.PW_CHANNEL ?? "chrome";
  browser = await chromium.launch(canal === "chromium" ? {} : { channel: canal });
  const page = await browser.newPage();
  // Tempo máximo (padrão 120 min; numa máquina lenta as 12 fotos levaram ~45 min).
  const limiteMin = Number(process.env.DESCRITORES_TIMEOUT_MIN ?? 120);
  const resultado = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tempo esgotado (${limiteMin} min).`)), limiteMin * 60_000);
    const fim = (fn) => (valor) => {
      clearTimeout(timer);
      fn(valor);
    };
    page.on("console", (m) => {
      const texto = m.text();
      if (texto.startsWith("__RESULTADO__")) fim(resolve)(JSON.parse(texto.slice("__RESULTADO__".length)));
      else if (texto.startsWith("__ERRO__")) fim(reject)(new Error(texto.slice("__ERRO__".length)));
      else console.log("[página]", texto);
    });
    page.on("pageerror", (e) => fim(reject)(new Error(`Erro na página: ${e.message}`)));
    page.on("crash", () => fim(reject)(new Error("A página travou (crash).")));
    page.goto(URL_PAGINA, { waitUntil: "commit", timeout: 120000 }).catch(fim(reject));
  });
  fs.writeFileSync(SAIDA, JSON.stringify(resultado, null, 2) + "\n");
  console.log(`OK: ${Object.keys(resultado.entradas).length} descritores gravados em ${path.relative(process.cwd(), SAIDA)}`);
} finally {
  await browser?.close().catch(() => {});
  encerrar();
}
