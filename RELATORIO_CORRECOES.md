# Relatório de correções — Reconhecimento Facial

**Data:** 22 e 23 de novembro de 2026
**Antes:** branch `main` (commit `b43cb45`, cópia do zip do GitHub, commit `f481278` de 03/06/2026)
**Depois:** branch `correcoes` (um commit por tema; lista no fim)
**Apresentação:** [`apresentacao/apresentacao.pptx`](apresentacao/apresentacao.pptx) e o PDF com o mesmo conteúdo ([`apresentacao/apresentacao.pdf`](apresentacao/apresentacao.pdf)). Prints e medições em `apresentacao/antes/` e `apresentacao/depois/`.

## Resumo

- O diagnóstico preliminar tinha **36 itens**. **Todos foram confirmados** ao reproduzir o problema ou ler o código: nenhum estava errado. Durante o trabalho apareceram mais **7 itens** (N1 a N7).
- Resultado dos 36: **29 corrigidos**, 4 corrigidos em parte, 2 documentados ou contornados (configuração da máquina e pasta no OneDrive) e 1 recomendação. Dos 7 novos: 4 corrigidos, 2 mitigados e 1 informativo. O que ficou de fora está explicado em "Pendências".
- Principais ganhos, medidos no mesmo notebook e com o mesmo roteiro automático:
  - pronto para reconhecer na primeira visita: **mais de 50 min → 12,6 s**;
  - JavaScript inicial: **982 kB → 284 kB**;
  - `npm run build` no Windows: **falhava → funciona**;
  - lint: **3 erros → 0**;
  - testes: **1 de exemplo → 46 + 1 de ponta a ponta**;
  - vulnerabilidades: **33 → 2 moderadas**, que não afetam o app.
- Bugs graves que deixaram de existir:
  - o cadastro gravava o rosto de outra pessoa;
  - "Adicionar fotos" não adicionava nada;
  - a câmera continuava ligada ao sair da tela;
  - as caixas ficavam fora do rosto;
  - um arquivo inválido travava a tela.

## Ambiente de teste

| | |
| --- | --- |
| Máquina | Notebook com Intel Core i5-5200U (2 núcleos, 4 threads), 8 GB de RAM, Intel HD Graphics 5500, HD mecânico Toshiba MQ01ABD100 |
| Sistema | Windows 10 Home 22H2, Node 24.16, npm 11.13, Google Chrome |
| Observação | A CPU estava rodando a **500 MHz (máximo 2,2 GHz)** e a bateria aparece com **0% mesmo na tomada**. Muitos notebooks limitam o processador quando a bateria está morta ou o carregador não é reconhecido. Por isso os tempos absolutos são bem maiores que num computador comum. A comparação antes × depois foi feita na mesma máquina. |
| Medição | Scripts com Playwright e o Chrome instalado, usando a câmera falsa do Chrome. Na primeira visita a rede foi limitada a 10 Mbps. Os tempos de análise variam muito nesta máquina (de 2 a 5 min, até 10 min quando outro processo pesado disputa a CPU). |

## Métricas antes e depois

| Métrica | Antes | Depois |
| --- | --- | --- |
| Pronto para reconhecer, 1ª visita (rede de 10 Mbps) | mais de 50 min (o roteiro desistiu aos 50 min) | **12,6 s** |
| Interface aparece, 1ª visita | mais de 50 min (tela de carregamento até tudo ficar pronto) | **4,0 s** |
| Recarregar a página | refaz tudo (não há cache) | **4,2 s** |
| Salvar um cadastro | refaz a base inteira. Não medido: levaria mais de 50 min, como a abertura | **5,3 min**, quase todo para analisar a foto extra |
| JavaScript inicial | 982 kB (266 kB gzip) | **284 kB (93 kB gzip)** |
| face-api.js | dentro do JavaScript inicial | 667 kB (165 kB gzip), baixado sob demanda |
| CSS | 62 kB | 33 kB |
| `npm run build` no Windows | falha (`cp`/`touch` no cmd.exe) | funciona |
| `npm run lint` | 3 erros e 7 avisos | 0 erros e 0 avisos |
| Testes automáticos | 1 (de exemplo, `expect(true)`) | 46 em 8 arquivos + 1 de ponta a ponta |
| `npm audit` | 33 vulnerabilidades | 2 moderadas (React Router 6; não afetam o app) |
| Pacotes instalados · dependências diretas | 482 · 71 | 322 · 32 |
| Câmera ao voltar da tela de resultado | 2 streams ligados (o anterior nunca era desligado) | 1 |
| Fotos extras adicionadas no cadastro | 0 | 1 |
| Arquivo inválido | tela presa em "Analisando..." | mensagem de erro e botões liberados |
| Celular deitado (844×390): botão "Capturar" | fora da tela (começa em y = 514) | visível sem rolar (de y = 342 a 386) |

## Problemas e correções

Origem: **P** = diagnóstico preliminar (todos confirmados); **N** = encontrado durante as correções.

| # | Categoria | Gravidade | Arquivo(s) | Problema | Correção | Situação | Como verifiquei |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Bloqueio | Alta | (máquina) | No PowerShell, `npm` resolve para `npm.ps1`, que a política de execução padrão bloqueia | README e DOCUMENTACAO ensinam `npm.cmd` ou o Prompt de Comando. A política **não** foi alterada | Documentado | Reproduzido com `powershell -ExecutionPolicy Restricted -Command "npm -v"`. Com `npm.cmd`, todos os comandos rodaram |
| P2 | Bloqueio | Alta | `package.json`, `vite.config.ts` | `npm run build` falhava no Windows (`cp`/`touch` no cmd.exe) | Plugin do Vite cria o `404.html`; o `.nojekyll` vem de `public/` | Corrigido | Antes: "'cp' não é reconhecido", exit 1. Depois: exit 0, com `404.html` e `.nojekyll` no `dist/` |
| P3 | Build | Média | `tailwind.config.ts`, `ui/command.tsx`, `ui/textarea.tsx`, `eslint.config.js` | `npm run lint` dava 3 erros e analisava o bundle em `docs/` | Componentes mortos removidos, plugin sem `require()`, `docs/` ignorado | Corrigido | Antes: 3 erros e 7 avisos. Depois: 0 e 0 |
| P4 | DX | Média | `.vscode/settings.json`, `README.md` | Tela branca pelo Live Server ou abrindo o `index.html` | Configuração do Live Server removida; o README explica `npm run dev` e `npm run preview` | Corrigido | Leitura |
| P5 | Bug | Média | `CameraCapture.tsx`, `cameraErrors.ts`, `ids.ts`, `vite.config.ts` | Pelo `http://IP:8080`, a câmera mostrava "verifique as permissões" e o cadastro quebrava (`crypto.randomUUID`) | Mensagem específica sobre HTTPS, UUID sem `randomUUID`, `npm run dev:celular` com HTTPS, dev só em `localhost` | Corrigido | Testes unitários |
| P6 | Ambiente | Média | (pasta no OneDrive) | Risco de EPERM/EBUSY e de sincronizar o `node_modules` | O trabalho foi feito numa cópia fora do OneDrive (git worktree). O README recomenda `C:\dev\…` | Contornado e documentado | O OneDrive chegou a travar uma escrita do git ("unable to write new index file") |
| P7 | Bug | Alta | `Index.tsx`, `useFaceRecognition.ts` | O cadastro gravava o rosto de maior score da foto, não o escolhido | Usa o descritor e o recorte do rosto clicado; rostos e cartões numerados | Corrigido | E2E: na foto com duas pessoas, cadastrar o desconhecido → ele é reconhecido com o nome novo e o Henrique continua sendo o Henrique |
| P8 | Bug | Alta | `QuickRegister.tsx` | "Adicionar fotos" nunca adicionava nada (FileList esvaziado ao limpar o campo) | Copia a lista antes de limpar | Corrigido | Antes, no Chrome: 0 fotos. Depois: 1 foto. Teste de componente com um FileList "vivo" |
| P9 | Bug | Alta | `Index.tsx` | Arquivo inválido ou erro do tfjs deixava "Analisando..." travado | `try/catch/finally`, id de análise e mensagem de erro | Corrigido | Antes: tela presa. Depois: "Não foi possível abrir esta imagem…" e botões liberados (prints e E2E) |
| P10 | Bug | Média | `CameraCapture.tsx` | "Capturar" liberado antes de o vídeo ter tamanho (captura 0×0) | `streaming` só após `loadedmetadata`; checagem de dimensões | Corrigido | Leitura e captura com a câmera falsa |
| P11 | Bug | Média | `useFaceRecognition.ts`, `QuickRegister.tsx` | Cadastro sem descritor, fotos extras sem validação, clique duplo duplicava | Descritor sempre do rosto escolhido, fotos extras validadas, envio único com retorno | Corrigido | Teste de componente e E2E |
| P12 | Bug | Média | `Index.tsx` | Corridas entre análises e "Nova Consulta" | Id de análise, resultados limpos, botões desabilitados durante a análise | Corrigido | Leitura e E2E |
| P13 | Bug | Baixa | `faceMatching.ts` | A mesma pessoa podia aparecer em dois rostos | Atribuição sem repetir pessoa | Corrigido em parte (margem para o 2º candidato e tamanho mínimo de rosto ficaram de fora) | Testes unitários |
| P14 | Bug | Alta | `CameraCapture.tsx` | A câmera continuava ligada depois de sair da tela | Stream num ref próprio, pedidos antigos descartados, pausa em segundo plano | Corrigido | Contagem de streams no Chrome. Antes: na tela de resultado a câmera seguia ligada sem aparecer e, ao voltar, ficavam 2 ligados. Depois: 1 ao voltar e 0 na tela de cadastro (o E2E confere) |
| P15 | Bug | Alta | `CameraCapture.tsx`, `FaceOverlay.tsx`, `geometry.ts` | Caixas achatadas e fora do rosto; rótulos ilegíveis | Imagem com `contain`, mesma escala nas caixas, rótulos em pixels de tela | Corrigido | Prints antes e depois; testes de geometria |
| P16 | UX | Média | `CameraCapture.tsx`, `Index.tsx` | Resultado desenhado sobre o vídeo ao vivo; captura "às cegas" depois de um upload | Quadro congelado; "Nova captura" volta ao vídeo | Corrigido | Prints |
| P17 | UX | Média | `Index.tsx` | A câmera reiniciava, voltava para a frontal e perdia a imagem a cada troca de tela | Escolha de câmera e análise guardadas no componente pai | Corrigido | Prints |
| P18 | UX | Média | `cameraErrors.ts` | Toda falha da câmera virava "verifique as permissões" | Mensagem por tipo de erro | Corrigido | Prints e testes |
| P19 | Performance | Média | `useFaceRecognition.ts` | Cada cadastro reprocessava a base inteira atrás de um spinner de tela cheia | Cadastro incremental | Corrigido | Depois: 5,3 min até ficar pronto, quase todo para analisar a foto extra (medido). Antes: não medido; pelo código, refaz a base inteira, como na abertura (mais de 50 min) |
| P20 | Performance | Média | `useFaceRecognition.ts`, `referenceDescriptors.ts` | Abertura lenta: 12 fotos processadas a cada carregamento, página travada | Descritores pré-calculados (JSON por hash), cache, interface antes dos modelos | Corrigido | Mais de 50 min → 12,6 s (tabela) |
| P21 | Performance | Média | `useFaceRecognition.ts` | Fallback de modelos sem versão fixa, sem tempo limite e baixando tudo de novo | Fallback por modelo, só em erro de rede ou HTTP; tempo limite de 5 min por modelo; jsDelivr 0.22.2; progresso | Corrigido (o cache HTTP de 10 min é limitação do GitHub Pages) | Leitura; CDN conferida (HTTP 200) |
| P22 | Performance | Média | `images.ts` | Fotos enormes analisadas em resolução total | Redução para 1280 px no maior lado | Corrigido | Testes e foto de 20 MP |
| P23 | Performance | Baixa | `App.tsx`, `useFaceRecognition.ts`, `index.css` | Bundle único de 982 kB, providers sem uso, Google Fonts por `@import` | face-api.js sob demanda, providers removidos, fontes locais | Corrigido | Build: 982 → 284 kB iniciais |
| P24 | UX | Média | `Index.tsx`, `faceDescriptorSimilarity.ts` | O resultado parecia uma certeza (todo match entre 73% e 100%) | Faixas alta/média/baixa e aviso de que é sugestão. Percentual (documentado) e limiar 0,6 mantidos | Corrigido | Prints e testes |
| P25 | UX | Média | `Index.tsx` | Cadastros sumiam sem aviso; não dava para editar nem excluir | Aviso e confirmação ao sair da página. Salvar, editar e excluir dependem de decisão da equipe | Corrigido em parte | Leitura |
| P26 | Acessibilidade | Baixa | `QuickRegister.tsx`, `Index.tsx`, `CameraCapture.tsx`, `index.css` | Labels soltos, nada anunciado, contraste baixo, zoom no iOS | Labels ligados, `aria-live`/`role="alert"`, contraste 5,2:1 e 6,3:1, fonte de 16 px | Corrigido | Teste de componente (`getByLabelText`) e cálculo de contraste |
| P27 | Layout | Baixa | `CameraCapture.tsx`, `tailwind.config.ts` | Celular deitado: botões fora da tela; "scan" só tremia no topo | Quadro limitado também pela altura (até 42% da tela); animação percorre o quadro | Corrigido | Celular deitado (844×390): antes o "Capturar" começava em y = 514, fora da tela; depois fica de y = 342 a 386, visível sem rolar |
| P28 | HTML | Baixa | `index.html`, `NotFound.tsx`, `App.tsx`, `RootErrorBoundary.tsx` | `lang="en"`, sem favicon, 404 em inglês, `/index.html` caía na 404, tela de erro sem saída | Todos corrigidos | Corrigido | E2E (`lang`), build e teste de componente |
| P29 | Deploy | Média | `deploy-pages.yml` | Bot commita na `main`, Node 20 fora de suporte, nenhuma checagem antes de publicar | Node do `.nvmrc` (24), lint, tipos e testes antes do build. Trocar para o deploy oficial depende do dono do repositório | Corrigido em parte | Leitura |
| P30 | Segurança | Baixa | `package.json` | Vite 5 exposto na rede, `node-fetch` antigo, jsdom depreciado | Vite 6.4.6, dev em `localhost`, override do `node-fetch`, jsdom 26, Vitest 4 | Corrigido | `npm audit`: 33 → 2 (React Router 6; ver pendências) |
| P31 | Limpeza | Baixa | `package.json`, `src/components/ui/…` | Dependências e arquivos sem uso | Removidos | Corrigido | Pacotes: 482 → 322; dependências diretas: 71 → 32 |
| P32 | Limpeza | Baixa | `bun.lock`, `.gitignore`, `gitignore.txt` | `bun.lock` desatualizado, `.gitignore` incompleto | `bun.lock` removido, `.gitignore` completo, `engines` e `.nvmrc` | Corrigido | — |
| P33 | Testes | Baixa | `src/test`, `e2e`, `tsconfig.app.json` | Um teste de exemplo e TypeScript sem strict | 46 testes, 1 E2E e strict ligado | Corrigido | `npm test` e `npm run typecheck` |
| P34 | Docs | Baixa | `README.md`, `DOCUMENTACAO.txt` | Desatualizados (Node 18, Playwright sem testes…) | Reescritos | Corrigido | — |
| P35 | Limpeza | Baixa | `persons.ts`, `assets/persons` | `.png` que eram JPEG, data em UTC, `Alan.jpeg` órfão | Renomeados, data local. `Alan.jpeg` mantido (pergunta abaixo) | Corrigido em parte | Teste de data |
| P36 | Privacidade | Recomendação | — | Fotos e nomes de pessoas reais públicos; origem compartilhada no GitHub Pages | Só recomendado | Recomendação | — |
| N1 | Performance | Alta (neste notebook) | face-api.js 0.22.2 + TF.js 1.7 | Cada foto leva de 1,5 a 6 min nesta máquina | Mitigado: descritores pré-calculados e interface que não bloqueia. Trocar a biblioteca depende de autorização | Mitigado | Linha do tempo da geração de descritores (41 a 43 min para 12 fotos) |
| N2 | UX | Baixa | `Index.tsx` | O "voltar" do Android saía do app a partir do cadastro | O cadastro entra no histórico | Corrigido | Leitura |
| N3 | Bug | Baixa | `CameraCapture.tsx` | Câmera ligada com a aba em segundo plano; câmera desconectada não era detectada | `visibilitychange` e evento `ended` | Corrigido | Leitura |
| N4 | Performance | Baixa | `images.ts` | Aviso do Chrome sobre leituras de canvas | `willReadFrequently` | Corrigido | Console |
| N5 | Ambiente | — | (notebook) | CPU limitada a 500 MHz e bateria em 0% deixam tudo muito lento | Não é do projeto; vale verificar a bateria ou o carregador | Informativo | Leitura do clock da CPU |
| N6 | UX | Média | `Index.tsx` | Ao capturar pela câmera a tela parecia travada: o processamento começava na mesma tarefa do clique, antes de o quadro congelado e o "Analisando..." aparecerem | A análise espera a tela ser desenhada antes do processamento pesado | Corrigido | Print `depois/03a-analisando.png`: quadro congelado e "Analisando..." logo após o clique |
| N7 | Performance | Baixa | `CameraCapture.tsx` | Com o vídeo a 30 quadros/s, nesta máquina a página desenhava cerca de 1 quadro por segundo e os cliques demoravam de 12 a 16 s (antes e depois) | Pedido "ideal" de 640×480 a 15 quadros/s (câmeras que não suportam continuam funcionando) | Mitigado (a causa principal é a CPU limitada, N5) | Leitura; sem medição isolada depois da mudança |

## Revisão independente

Depois das correções, um revisor independente leu todo o diff sem ver as minhas conclusões. Os achados de fluxo foram confirmados por um segundo verificador, e todos foram corrigidos no commit `ae2cad3`:

- **Modelos em rede lenta:** o tempo esgotado disparava um segundo download pela CDN, que duplicava os dados e podia dar erro com o modelo já carregado. Agora a CDN só entra em erro real de rede ou HTTP. O limite subiu para 5 min, e um modelo que termina no limite segue normalmente.
- **Cadastro preso à análise de origem:** com o "voltar" do sistema e uma consulta nova, o cadastro antigo não altera a consulta nova nem fecha o formulário errado.
- **Envio único de verdade:** o botão fica em "Cadastrando..." até o formulário fechar, e a tela principal ignora uma segunda chamada.
- **Tela de erro:** agora deixa claro que os cadastros da sessão foram perdidos.
- **Gerador de descritores:** falha com mensagem clara se uma foto não tiver rosto, em vez de gravar um JSON incompleto. Erros de página e o tempo máximo encerram o script em vez de travar.
- **SHA-256 sem `crypto.subtle`:** em `http://IP-da-rede` o hash é calculado em JavaScript, e o JSON pré-calculado e o cache continuam valendo.
- **Testes:**
  - fallback do UUID testado de verdade;
  - mensagem de erro do cadastro distinta do texto padrão;
  - fuso de São Paulo fixado, para o teste de data pegar a regressão também no CI em UTC;
  - testes do SHA-256.

## Pendências e por quê

1. **Biblioteca de reconhecimento (N1).** A face-api.js 0.22.2 é de 2020 (TensorFlow.js 1.7). O fork mantido `@vladmandic/face-api` usa o TensorFlow.js atual, com WebGL mais eficiente e backend WASM, e deve deixar cada análise bem mais rápida em máquinas como esta. Pelas regras do trabalho, a troca precisa da autorização da equipe.
2. **Salvar, editar e excluir cadastros (P25).** Mudaria o comportamento documentado. Se for feito, use IndexedDB e lembre que a origem `letambani.github.io` é compartilhada com os outros sites da conta.
3. **Deploy oficial (P29).** Para trocar para `actions/upload-pages-artifact` + `actions/deploy-pages`, o dono do repositório precisa mudar Settings → Pages → Source para "GitHub Actions". Isso acaba com os commits do bot e com os 12,4 MB de modelos duplicados em `docs/`.
4. **Privacidade (P36).** Confirmar o consentimento das pessoas das fotos e avaliar tirá-las do site público.
5. **React Router 6.** Restam 2 alertas moderados: hidratação SSR e redirecionamento com barra invertida. O app não usa SSR nem navega para endereços vindos do usuário. A correção exige o React Router 7.
6. **Pequenos, não corrigidos:**
   - a perda do contexto WebGL não é tratada (o usuário precisa recarregar);
   - o botão "Traseira" usa `facingMode` sem `exact` (num PC com duas webcams pode não trocar);
   - Safari 14 não tem `aspect-ratio`;
   - falta uma margem mínima entre o 1º e o 2º candidato e um tamanho mínimo de rosto.
7. **Pergunta:** `Alan.jpeg` está em `src/assets/persons`, mas não foi cadastrado. Foi esquecido? Por enquanto ele é usado como "pessoa desconhecida" nos testes.

## Como verifiquei

- **Comandos:** no PowerShell com `npm.cmd`: `npm ci`/`npm install`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` e `npm audit`. Os registros do antes estão em `apresentacao/antes/logs/`.
- **Instalação do zero:** clone limpo do branch `correcoes`, `npm ci` (322 pacotes; 45 min nesta máquina) e `npm run verificar` (lint, tipos, 46 testes e build). Tudo passou.
- **Teste de ponta a ponta:** `npm run test:e2e`, um teste com o fluxo completo no Chrome com a câmera falsa:
  - pessoa da base reconhecida;
  - foto com duas pessoas;
  - cadastro do rosto certo com foto extra e câmera desligada no cadastro;
  - o novo cadastro reconhecido e o Henrique sem troca de nome;
  - arquivo inválido com mensagem de erro.

  Resultado: **passou** (1 de 1), em 32 min nesta máquina. Uma primeira rodada, feita junto com a instalação do zero, passou em todas as verificações, mas estourou o limite antigo de 30 min. Por isso o limite subiu para 60 min (commit `cbcb62f`).
- **Prints e métricas:** scripts Playwright no Chrome instalado, com a câmera falsa, a rede limitada na primeira visita e as tarefas longas medidas com a API de Long Tasks. Ficam em `apresentacao/antes/` e `apresentacao/depois/`.
  - O print `depois/12-arquivo-invalido.png` foi refeito com a câmera falsa mostrando uma foto. O roteiro original tirava esse print logo depois de simular a câmera negada, e a mensagem da câmera confundia.
- **Ciclo da câmera:** medido contando os streams ligados (`getUserMedia`) depois de sair da tela e ao voltar.
- **Revisão independente:** do código novo, com verificação de cada achado (seção acima).

## Commits

Do mais antigo para o mais novo (`git log main..correcoes`):

- `0ba7b3b` limpeza: remove código, dependências e arquivos sem uso
- `1e839ec` build e configuração: build no Windows, Vite 6, lint e tipos sem erros
- `146a090` interface: pt-BR, favicon, fontes locais, contraste, 404 e tela de erro
- `4bfe8d4` lib: funções puras para caixas, comparação, imagens, cache e câmera
- `0d0897a` corrige o fluxo de câmera, análise e cadastro
- `f4aba09` ci: Node do .nvmrc e checagens antes de publicar
- `0fc47fc` docs: README e DOCUMENTACAO atualizados
- `fe61539` perf: descritores da base pré-calculados (npm run descritores)
- `3e93ef2` testes: unitários, de componentes e de ponta a ponta
- `7b2441b` segurança: npm audit fix e Vitest 4
- `243f887` fix: feedback imediato ao capturar e quadro que cabe no celular deitado
- `913eef3` perf: câmera a 15 quadros/s
- `ae2cad3` fix: achados da revisão independente
- `cbcb62f` test: mais tempo para o e2e em máquinas lentas
- `9f006d2` docs: câmera a 15 quadros/s, tempo limite dos modelos e SHA-256 sem crypto.subtle
- último: docs: relatório de correções e apresentação antes e depois (este arquivo, os slides e os prints)
