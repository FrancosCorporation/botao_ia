# MELHORIAS — botao_ia

> **Gerado por analise de codigo em 2026-10-02** · Stack: Node 18 (servidor estatico sem framework) + JS puro no browser, **zero dependencias**
> Branch `main` · 1070 LOC · **3 suite(s) de teste** · sem CI · porta padrao `3345`
>
> **Este arquivo e um plano de execucao.** Cada item tem ID, `arquivo:linha`, mudanca exata,
> criterio de aceite e comando de verificacao.

---

## 0. Como usar este documento

1. Execute na ordem **P0 -> P1 -> P2 -> P3**, respeitando as ondas da secao 8.
2. Ao terminar um item: marque `- [x]`, rode o **Verificacao**, comite `fix(<ID>): descricao`.
3. **O jogo e a logica estao bem testados e nao devem ser simplificados.** O defeito principal
   esta no **servidor de arquivos** (mesmo `server.js` em toda a serie). Nao mexa nas regras/IA sem causa.
4. **Este item se aplica a toda a serie** (`xadrez_ia`, `damas_ia`, `lig4_ia`, `botao_ia`,
   `jogo_da_velha_ia`, `calculadora`): o `server.js` e praticamente identico. Replique a correcao.
5. **Idioma:** portugues.

---

## 1. Diagnostico executivo

Botao (jogo da IA) que roda inteiro no browser: o jogador joga, o motor (minimax/heuristica) avalia candidatos
e um LLM local escolhe **entre** eles. Sem build, sem servidor de logica, zero dependencias.

**O que esta bem (nao reaca):**

| Item | Evidencia |
|---|---|
| LLM escolhe **entre candidatos do minimax**, nunca inventa jogada | ver `llm.js` / suites |
| Fallback para minimax/heuristica: o jogo **nunca** trava se o LLM falhar | ver `llm.js` / suites |
| `system`/`user` separados no prompt do LLM | ver `llm.js` / suites |
| Falha de WebGPU distinguida de falha de download (nao mascara erro de rede) | ver `llm.js` / suites |
| Zero dependencias de runtime (só `node server.js`) | ver `llm.js` / suites |

**O que esta quebrado:**

1. **O servidor serve o repositorio git inteiro** — validado **em execucao real**: `GET /.git/config`
   -> **200**. A guarda de path traversal esta correta (`startsWith(RAIZ)`, e `GET /../etc/passwd`
   -> 404), mas **nao** bloqueia dotfiles *dentro* da raiz — e `.git/` esta nela.
2. Sem allowlist do que e servido (vale para `package.json`, `test/`, e qualquer arquivo futuro).
3. Sem CI — os testes so rodam se alguem lembrar.

---

## 2. Tabela de prioridades

| ID | Titulo | Sev | Arquivo | Depende de |
|---|---|---|---|---|
| SEC-01 | Servidor expoe `.git/` (historico e config) | **P0** | `server.js:13-20` | — |
| SEC-02 | Sem allowlist de arquivos servidos | **P0** | `server.js:13-20` | SEC-01 |
| SEC-03 | Sem headers de seguranca no servidor estatico | **P1** | `server.js:19` | — |
| SEC-04 | `decodeURIComponent` sem try/catch derruba a requisicao | **P1** | `server.js:11` | — |
| BUG-01 | Servidor le arquivo **sincrono** a cada request | **P2** | `server.js:20` | — |
| IMP-01 | Sem cache de assets (revalida a cada load) | **P2** | `server.js:19-20` | — |
| IMP-02 | Sem CSP (o jogo carrega WASM/WebGPU) | **P2** | `server.js:19` | SEC-03 |
| IMP-03 | Sem `404` amigavel / pagina de erro | **P3** | `server.js:15-17` | — |
| TEST-01 | Testes nao cobrem o servidor (so a logica) | **P1** | `test/` | SEC-01 |
| DEVOPS-01 | Sem CI | **P2** | *(ausente)* | — |
| DEVOPS-02 | Sem Dockerfile | **P3** | *(ausente)* | — |
| DOC-01 | README nao avisa que expor o servidor expoe o repo | **P2** | `README.md` | SEC-01 |

**Placar: 2 P0 · 3 P1 · 4 P2 · 2 P3 = 11 itens.**

---

## 3. Seguranca

### SEC-01 · Servidor expoe `.git/` (historico e config) · [P0]

- **Arquivo:** `server.js:13-20`
- **Evidência:** validado **em execucao real**:
  ```
  GET /.git/config -> 200
  GET /.git/HEAD   -> 200
  GET /../etc/passwd -> 404   (travessia de path bloqueada — correto)
  ```
  A guarda (`server.js:14`) verifica que o caminho **comeca** com a raiz — o que impede *sair*, mas
  **nao** impede ler dotfiles *dentro* dela, e `.git/` esta na raiz.
- **Impacto:** quem acessa o servidor obtem o **repositorio git inteiro**: historico
  (`.git/objects`), config (`.git/config`, remote, branch) e hooks. Se algum segredo esteve
  commitado no passado (padrao recorrente neste acervo), ele **vaza por aqui**. Para um jogo que
  precisa servir so HTML/CSS/JS, expor `.git` e desnecessario por completo.
- **Mudança:** **allowlist explicita** do que e servido — so o que o jogo precisa:
  ```javascript
  const PUBLICOS = new Set(['/index.html', '/style.css']);
  const DIRETORIOS_PUBLICOS = ['/js/'];
  function permitido(caminho) {
    if (PUBLICOS.has(caminho)) return true;
    return DIRETORIOS_PUBLICOS.some((d) => caminho.startsWith(d));
  }
  ```
  Negar tambem qualquer caminho que comece com `.` (`.git`, `.env`, `.npmrc`) — defense em profundidade.
- **Aceite:** `GET /.git/config`, `/.git/HEAD`, `/.env` -> **404**; `/index.html`, `/js/...` -> **200**.
- **Verificação:**
  ```bash
  PORT=3345 node server.js & sleep 1
  for p in /.git/config /.git/HEAD /.env .gitignore; do
    curl -s -o /dev/null -w "$p -> %{http_code}\n" "http://localhost:3345$p"   # esperado 404
  done
  kill %1
  ```

### SEC-02 · Sem allowlist de arquivos servidos · [P0]

- **Arquivo:** `server.js:13-20`
- **Evidência:** alem do `.git`, o servidor serve **qualquer arquivo existente na raiz** —
  `package.json`, `README.md`, `test/`, e qualquer coisa adicionada depois.
- **Impacto:** vazamento de codigo alem do necessario e **armadilha de recorrencia**: qualquer
  segredo novo colocado na raiz **vaza automaticamente**. Mesmo modo de falha do `webhook-relay`.
- **Mudança:** a mesma **allowlist** do `SEC-01`, aplicada a todo caminho — negar por omissao.
- **Aceite:** `GET /package.json`, `/README.md`, `/test/*` -> **404**.
- **Verificação:**
  ```bash
  for p in /package.json /README.md; do
    curl -s -o /dev/null -w "$p -> %{http_code}\n" "http://localhost:3345$p"   # 404
  done
  ```

### SEC-03 · Sem headers de seguranca no servidor estatico · [P1]

- **Arquivo:** `server.js:19`
- **Evidência:** `res.writeHead(200, { 'Content-Type': ... })` — so o Content-Type.
- **Impacto:** sem `nosniff`, um arquivo pode ser interpretado como outro tipo; sem `X-Frame-Options`,
  o jogo pode ser embutido (clickjacking); sem `Referrer-Policy`, defense em profundidade.
- **Mudança:** adicionar `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: no-referrer` no `writeHead` (sem dependencia, como o resto do projeto).
- **Aceite:** respostas trazem `nosniff` e `X-Frame-Options`.
- **Verificação:**
  ```bash
  curl -sI http://localhost:3345/index.html | grep -iE 'x-content-type-options|x-frame-options'
  ```

### SEC-04 · `decodeURIComponent` sem try/catch · [P1]

- **Arquivo:** `server.js:11`
- **Evidência:** `decodeURIComponent(req.url.split('?')[0])` lanca `URIError` em string malformada
  (`%`, `%zz`, `%E0%A4%A`).
- **Impacto:** a excecao lanca dentro do handler e nao e capturada — a requisicao fica **sem resposta**
  (socket fecha sem status) e o log mostra stack. Um `curl 'http://host/%'` por requisicao.
- **Mudança:** envolver em `try/catch` e devolver `400`.
- **Aceite:** `GET /%` -> **400**, sem excecao no log.
- **Verificação:**
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3345/%'   # 400
  ```

---

## 4. Bugs e defeitos funcionais

### BUG-01 · Servidor le arquivo **sincrono** a cada request · [P2]

- **Arquivo:** `server.js:20` (`res.end(readFileSync(arquivo))`)
- **Evidência:** `readFileSync` **bloqueia o event loop** a cada requisicao.
- **Impacto:** as requisicoes se serializam; um asset grande trava as outras. Relevante porque o jogo
  baixa modelo (~350 MB) — muitas requisicoes de asset.
- **Mudança:** `fs.promises.readFile` com handler async; ou pre-carregar os poucos assets no boot.
- **Aceite:** requisicoes concorrentes nao se bloqueiam.
- **Verificação:** `curl -w %{time_total}` em 2 requisicoes simultaneas -> ambas rapidas.

### IMP-01 · Sem cache de assets · [P2]

- **Arquivo:** `server.js:19-20`
- **Evidência:** toda requisicao rele do disco, sem `ETag`/`Cache-Control`.
- **Impacto:** cada reload rebaixa `js/*.js`. Pequeno, mas sao requisicoes repetidas sem cache HTTP.
- **Mudança:** `ETag` (hash no boot) + `Cache-Control` curto p/ HTML, longo p/ JS; responder `304`.
- **Aceite:** segundo request do mesmo asset -> `304`.
- **Verificação:** `curl -sI http://localhost:3345/js/llm.js | grep -iE 'etag|cache-control'`

### IMP-02 · Sem CSP (WASM/WebGPU) · [P2]

- **Arquivo:** `server.js:19`
- **Evidência:** nenhuma `Content-Security-Policy`.
- **Impacto:** o jogo carrega WASM (llama.cpp em WebAssembly). Sem CSP, uma injecao futura no JS
  roda sem restricao. (Defense em profundidade — `SEC-03` ja cobre o essencial.)
- **Mudança:** CSP com `default-src 'self'`, `script-src 'self'`, `wasm-unsafe-eval` (necessario),
  e `connect-src` do modelo. **Testar que o jogo ainda carrega o WASM.**
- **Aceite:** CSP presente e o jogo + modelo **ainda funcionam**.
- **Verificação:** `curl -sI .../index.html | grep -i content-security-policy` + abrir no browser

### IMP-03 · Sem `404` amigavel / pagina de erro · [P3]

- **Arquivo:** `server.js:15-17`
- **Evidência:** `res.writeHead(404, {'Content-Type':'text/plain'}); res.end('404');`
- **Impacto:** URL errada mostra "404" cru. E se o JS falhar ao carregar, a pagina fica em branco.
- **Mudança:** rota `.html` desconhecida cai no `index.html` (SPA-like) ou 404 estilizado; `<noscript>`
  + `window.onerror` com aviso em vez de tela branca.
- **Aceite:** rota desconhecida mostra a pagina do jogo (ou 404 estilizado).
- **Verificação:** `curl -s http://localhost:3345/qualquer | head -1` mostra HTML

---

## 5. Qualidade: testes

### TEST-01 · Testes nao cobrem o servidor (so a logica) · [P1]

- **Arquivo:** `test/` (3 suite(s))
- **Evidência:** os testes cobrem **exclusivamente** regras/IA/LLM. Nenhum toca o server.js — por isso
  o `.git` exposto (P0) e o `decodeURIComponent` passaram despercebidos.
- **Impacto:** o servidor e a superficie de rede, e esta **sem nenhum teste**. Os P0 sao exatamente o
  que um teste de rota pegaria.
- **Mudança:** `test/servidor-test.mjs` (subindo o server em porta aleatoria): `/index.html` -> 200;
  `/.git/config` -> 404; `/package.json` -> 404; `/../etc/passwd` -> 404; `/%` -> 400 (apos `SEC-04`);
  headers de seguranca presentes.
- **Aceite:** a suite nova cobre os 2 P0 e falha se a allowlist for removida.
- **Verificação:** `npm test 2>&1 | tail -3`

---

## 6. DevOps / Infra

### DEVOPS-01 · Sem CI · [P2]

- **Arquivo:** *(ausente)* `.github/workflows/`
- **Evidência:** `package.json` tem `test` mas nenhum workflow o executa.
- **Impacto:** os testes so rodam se alguem lembrar; o servidor nem e exercitado.
- **Mudança:** `ci.yml` com `npm ci`, `npm test`, `node --check server.js js/*.js`.
- **Aceite:** PR que quebra o jogo e bloqueado.
- **Verificação:** `npm test 2>&1 | tail -2 && node --check server.js`

### DEVOPS-02 · Sem Dockerfile · [P3]

- **Arquivo:** *(ausente)* `Dockerfile`
- **Evidência:** roda com `node server.js` (zero deps).
- **Impacto:** baixo, mas o Dockerfile resolve o `SEC-01` por **construcao**: copiar so o necessario
  (`.git` nunca entra na imagem).
- **Mudança:** `FROM node:20-alpine`, `COPY index.html style.css js/ server.js ./`, `CMD ["node","server.js"]`.
- **Aceite:** `docker build` + `run` serve o jogo; `.git` nem existe na imagem.
- **Verificação:** `docker build -t j . && docker run --rm -p 3345:3345 j &` + `curl /index.html` 200

---

## 7. Documentacao

### DOC-01 · README nao avisa que expor o servidor expoe o repo · [P2]

- **Arquivo:** `README.md`
- **Evidência:** o README explica o jogo e a IA; nao menciona que `node server.js` serve a pasta
  inteira (incluindo `.git`).
- **Impacto:** quem publica o jogo nao sabe que precisa da allowlist do `SEC-01`.
- **Mudança:** secao "Servir": comando correto + aviso de que o servidor original expoe o repo (usar
  a allowlist, GitHub Pages, ou servidor de estatico com allowlist).
- **Aceite:** README avisa sobre a exposicao do repo ao servir.
- **Verificação:** `grep -ni 'servidor\|git\|pages' README.md`

---

## 8. Ordem de execucao (waves)

### Wave 1 — Fechar a exposicao do servidor (P0)
1. **`SEC-02`** — allowlist do que e servido (raiz do problema).
2. **`SEC-01`** — `.git` e dotfiles bloqueados (garantido pela allowlist).

### Wave 2 — Robustez (P1)
3. **`SEC-04`** — `decodeURIComponent` com try/catch (`400`).
4. **`SEC-03`** — headers de seguranca.
5. **`TEST-01`** — suite do servidor (pega os 2 P0).

### Wave 3 — Qualidade/perf (P2)
6. **`BUG-01`** — leitura assincrona; **`IMP-01`** — cache; **`IMP-02`** — CSP.
7. **`DEVOPS-01`** — CI; **`DOC-01`** — README.

### Wave 4 — Polimento (P3)
8. **`IMP-03`**, **`DEVOPS-02`**.

**Dependencias:** `SEC-02` antes de `SEC-01` (a allowlist e a solucao) · `TEST-01` depois dos P0 ·
`SEC-04` junto com `TEST-01` (o `%` e um dos casos) · `SEC-03`/`IMP-02` so depois da allowlist.

---

## 9. Fora de escopo / riscos

| Item | Decisao | Motivo |
|---|---|---|
| Migrar o servidor para Express | **Nao** | Zero deps e escolha de qualidade; a allowlist resolve em ~8 linhas. |
| Servir via GitHub Pages | **Nao, aqui** | Compativel (estatico), mas e decisao de deploy — mencionar no `DOC-01`. |
| Colocar o LLM num servidor/API | **Nunca** | LLM local e o diferencial: zero chave, privacidade. Nao regredir. |
| Trocar o modelo default | **Nao** | Dois modelos com fallback CPU/GPU ja. Performance e escolha. |
| Tem `fisica.js` (simulacao) alem do minimax — a suite deve cobrir colisao/rebote/estabilidade numerica, que sao instaveis com float. | **Revisar** | Especifico deste projeto — ver secao 1. |

**Riscos desta execucao:**

- **`SEC-02` (allowlist) pode quebrar o jogo** se faltar um asset (`.wasm`, fonte, favicon). Testar o
  jogo **inteiro** no browser apos a mudanca (jogar, ativar a IA, baixar o modelo).
- **`IMP-02` (CSP) pode quebrar o WASM** se faltar `wasm-unsafe-eval` — testar no browser, nao so o header.
- **Este defeito e da serie inteira** — replicar em `xadrez_ia`, `damas_ia`, `lig4_ia`, `botao_ia`,
  `jogo_da_velha_ia`, `calculadora`. Ver `PLANO_MELHORIAS_MASTER.md`.

---

## 10. Definicao de pronto (DoD)

**Seguranca**
- [ ] `SEC-01` — `/.git/config`, `/.git/HEAD`, `/.env` -> 404
- [ ] `SEC-02` — `/package.json`, `/test/*` -> 404
- [ ] `SEC-03` — `nosniff`, `X-Frame-Options`, `Referrer-Policy`
- [ ] `SEC-04` — `/%` -> 400, sem excecao no log

**Funcional**
- [ ] `BUG-01` — requisicoes concorrentes nao se bloqueiam
- [ ] `IMP-01` — asset com `ETag` -> `304` na segunda
- [ ] `IMP-02` — CSP presente e o jogo + WASM **ainda funcionam**
- [ ] `IMP-03` — rota desconhecida mostra a pagina (ou 404 estilizado)

**Testes e infra**
- [ ] `TEST-01` — suite do servidor cobrindo os 2 P0
- [ ] `DEVOPS-01` — CI rodando `npm test`
- [ ] `DEVOPS-02` — Dockerfile servindo so o necessario
- [ ] `DOC-01` — README sobre servir com seguranca

**Validacao final:**
```bash
npm test 2>&1 | tail -2 && node --check server.js
PORT=3345 node server.js & sleep 1
curl -s -o /dev/null -w '/.git/config -> %{http_code}\n' http://localhost:3345/.git/config   # 404
kill %1
```

---

*Fim do plano. Gerado por leitura direta do codigo em 2026-10-02. Nenhum item ja estava corrigido*
*— todos apontam para defeitos ainda presentes.*
