import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Arquivo = { name: string; mimeType: string; buffer: Buffer };

const foto = (arquivo: string, nome: string): Arquivo => ({
  name: nome,
  mimeType: "image/jpeg",
  buffer: fs.readFileSync(path.resolve("src/assets/persons", arquivo)),
});
const henrique = foto("Henrique.jpeg", "henrique.jpeg");
// Alan.jpeg não está na base inicial: serve para testar "Pessoa Desconhecida" e o cadastro.
const alan = foto("Alan.jpeg", "alan.jpeg");
const dataUrl = (a: Arquivo) => `data:${a.mimeType};base64,${a.buffer.toString("base64")}`;

/** Monta no navegador uma foto com duas pessoas lado a lado. */
async function fotoDupla(page: Page): Promise<Arquivo> {
  const url = await page.evaluate(
    async ([a, b]) => {
      const carregar = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [x, y] = await Promise.all([carregar(a), carregar(b)]);
      const altura = 1280;
      const lx = Math.round((x.width * altura) / x.height);
      const ly = Math.round((y.width * altura) / y.height);
      const canvas = document.createElement("canvas");
      canvas.width = lx + ly;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem canvas");
      ctx.drawImage(x, 0, 0, lx, altura);
      ctx.drawImage(y, lx, 0, ly, altura);
      return canvas.toDataURL("image/jpeg", 0.9);
    },
    [dataUrl(henrique), dataUrl(alan)],
  );
  return { name: "dupla.jpg", mimeType: "image/jpeg", buffer: Buffer.from(url.split(",")[1], "base64") };
}

async function enviar(page: Page, arquivo: Arquivo) {
  await page.getByLabel("Enviar imagem do dispositivo").setInputFiles(arquivo);
  await expect(page.getByRole("button", { name: /Analisando/ })).toHaveCount(0);
}

const streamsAtivos = (page: Page) =>
  page.evaluate(
    () =>
      ((window as unknown as { __streams?: MediaStream[] }).__streams ?? []).filter((s) =>
        s.getTracks().some((t) => t.readyState === "live"),
      ).length,
  );

test("reconhece, cadastra o rosto certo, desliga a câmera e não trava", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const original = md.getUserMedia.bind(md);
      md.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        w.__streams.push(stream);
        return stream;
      };
    }
  });

  await test.step("abre e fica pronto", async () => {
    await page.goto("./");
    await expect(page.getByRole("button", { name: "Capturar" })).toBeVisible();
    await expect(page.getByText(/Carregando modelos|Preparando base/)).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });

  await test.step("reconhece uma pessoa da base", async () => {
    await enviar(page, henrique);
    await expect(page.locator("main")).toContainText("Henrique");
  });

  await test.step("foto com duas pessoas: uma conhecida e uma desconhecida", async () => {
    await enviar(page, await fotoDupla(page));
    await expect(page.locator("main")).toContainText("Henrique");
    await expect(page.getByText("Pessoa Desconhecida")).toBeVisible();
  });

  await test.step("abrir o cadastro desliga a câmera", async () => {
    await page.getByRole("button", { name: /^Cadastrar rosto/ }).click();
    await expect(page.getByPlaceholder("Digite o nome...")).toBeVisible();
    await expect.poll(() => streamsAtivos(page)).toBe(0);
  });

  await test.step("cadastra com foto adicional", async () => {
    await page.getByPlaceholder("Digite o nome...").fill("Alan Teste");
    await page.getByLabel("Adicionar fotos extras").setInputFiles(alan);
    await expect(page.getByAltText("Foto adicional 1")).toBeVisible();
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText(/cadastrado\(a\)/)).toBeVisible();
  });

  await test.step("o rosto cadastrado é o do Alan, e o Henrique continua sendo o Henrique", async () => {
    await page.getByRole("button", { name: "Nova Consulta" }).click();
    await enviar(page, alan);
    await expect(page.locator("main")).toContainText("Alan Teste");
    await enviar(page, henrique);
    await expect(page.locator("main")).toContainText("Henrique");
    await expect(page.locator("main")).not.toContainText("Alan Teste");
  });

  await test.step("arquivo inválido mostra erro e não deixa a tela travada", async () => {
    await page.getByLabel("Enviar imagem do dispositivo").setInputFiles({
      name: "falsa.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("isto não é uma imagem"),
    });
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível abrir esta imagem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Capturar" })).toBeEnabled();
  });
});
