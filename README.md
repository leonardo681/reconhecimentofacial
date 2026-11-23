# Reconhecimento facial

Aplicação web para consulta e cadastro rápido com **reconhecimento facial** no navegador, usando o **face-api.js**. Os modelos rodam no próprio navegador: nenhuma imagem é enviada para servidor.

---

## Documentação

**SISTEMA DE RECONHECIMENTO FACIAL**

| | |
| --- | --- |
| **Projeto** | Reconhecimento facial |
| **Base técnica** | React + Vite + face-api.js |
| **Data de elaboração** | Abril de 2026 (revisado em novembro de 2026) |

**Alunos**

- Letícia Tambani  
- Marcelo Marques de Souza  
- Rithiély Schmitt  

Detalhes técnicos em [`DOCUMENTACAO.txt`](DOCUMENTACAO.txt).

---

## Funcionalidades (resumo)

- Captura pela **câmera** (frontal / traseira quando disponível) e **envio de imagem** (JPG, PNG, WEBP). Fotos grandes são reduzidas automaticamente antes da análise.
- Detecção de **vários rostos**, numerados (#1, #2…) na imagem e nos cartões, com a faixa de correspondência (alta, média ou baixa) e o percentual de compatibilidade.
- **Cadastro rápido** do rosto escolhido, com marcas corporais e fotos adicionais (fotos sem rosto ou de outra pessoa são recusadas).
- A interface aparece na hora e os modelos carregam com indicador de progresso. Os descritores da base inicial já vêm calculados.
- Interface pensada para uso institucional (PMSC — contexto do cabeçalho da aplicação).

## Requisitos

- **Node.js 20.19 ou mais novo** (recomendado: 22 ou 24 LTS; veja `.nvmrc`).
- Navegador moderno. A câmera só funciona em **HTTPS** ou em **localhost**.

## Como rodar

```bash
npm install
npm run dev
```

Abra **http://localhost:8080**.

### No Windows

- **PowerShell:** se aparecer *"a execução de scripts foi desabilitada neste sistema"*, use `npm.cmd` no lugar de `npm` (por exemplo `npm.cmd install` e `npm.cmd run dev`) ou rode os comandos no **Prompt de Comando** ou no **Git Bash**. Se quiser, o próprio usuário pode liberar os scripts com `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **OneDrive:** evite deixar o projeto numa pasta sincronizada (Área de Trabalho ou Documentos com OneDrive). O `node_modules` tem dezenas de milhares de arquivos e o `npm install` pode falhar com EPERM/EBUSY. Prefira algo como `C:\dev\reconhecimentofacial`.
- **Não abra o `index.html` direto nem pelo Live Server:** o projeto precisa do Vite (`npm run dev` ou `npm run preview`); fora dele a página fica em branco.

### Testar no celular

A câmera do navegador exige conexão segura. Para testar no celular, na mesma rede Wi-Fi:

```bash
npm run dev:celular
```

Abra no celular o endereço `https://<IP-do-computador>:8080` que aparece no terminal e aceite o aviso de certificado (ele é autoassinado, só para testes). Outra opção é usar o site publicado, que já é HTTPS.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:8080 |
| `npm run dev:celular` | O mesmo, na rede local e com HTTPS |
| `npm run build` | Build de produção em `dist/` (com `404.html` e `.nojekyll` para o GitHub Pages) |
| `npm run preview` | Serve o build em http://localhost:4173/reconhecimentofacial/ |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos (TypeScript) |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de ponta a ponta no navegador (Playwright com o Google Chrome instalado) |
| `npm run verificar` | Lint + tipos + testes + build (o mesmo que o CI roda) |
| `npm run descritores` | Recalcula `src/data/descritoresReferencia.json` (rode ao trocar fotos da base) |

Os testes de ponta a ponta usam o Google Chrome instalado. Sem ele, rode `npx playwright install chromium` e defina `PW_CHANNEL=chromium`.

## Base de pessoas

- Fotos em `src/assets/persons/` e lista em `src/data/persons.ts`.
- Ao incluir ou trocar uma foto, rode `npm run descritores` (pode levar alguns minutos) para atualizar os descritores pré-calculados. Se esquecer, o app calcula no navegador na primeira abertura (mais lento) e o `npm test` avisa qual foto mudou.

## Publicação (GitHub Pages)

- A cada push na `main`, o GitHub Actions (`.github/workflows/deploy-pages.yml`) instala as dependências, roda lint, tipos e testes, faz o build e copia `dist/` para `docs/`. O GitHub Pages publica a pasta `docs/` (Settings → Pages → Deploy from a branch → main → /docs).
- Não edite `docs/` à mão. Depois de cada deploy, o bot faz um commit na `main`: rode `git pull` antes do próximo push.

## Estrutura principal

- `src/pages/Index.tsx` — tela principal e fluxo
- `src/components/CameraCapture.tsx` — câmera, envio de imagem e quadro
- `src/components/FaceOverlay.tsx` — caixas e rótulos sobre a imagem analisada
- `src/components/QuickRegister.tsx` — cadastro rápido
- `src/hooks/useFaceRecognition.ts` — carregamento dos modelos, base de referência e comparação
- `src/lib/` — funções puras (geometria, comparação, imagens, cache, mensagens), cobertas por testes
- `public/models` — pesos do face-api.js (com fallback para uma CDN com versão fixa)

## Limitações e privacidade

- Os cadastros feitos durante o uso ficam só na memória e somem ao recarregar a página (o app avisa).
- O resultado é uma sugestão automática. O percentual é uma escala visual, não uma probabilidade: confirme a identidade por outros meios.
- As fotos da base são de pessoas reais e ficam públicas no site publicado. Use apenas com consentimento.
- O processamento é feito no aparelho: em computadores ou celulares lentos, a análise pode demorar.

## Licença / uso

Projeto acadêmico. Uso restrito conforme contexto institucional definido na aplicação.
