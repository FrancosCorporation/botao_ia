# Futebol de Botão com IA

Eu queria jogar futebol de botão no navegador — aquele jogo clássico dos botões deslizando no campo — com uma IA que pensa de verdade do outro lado, sem instalar nada e sem depender de serviço pago. Então construí o meu: o jogo inteiro é HTML, CSS e JavaScript puro, a física roda no browser e a IA (heurística que chuta, bloqueia e posiciona) também.

## O que tem

- **Toda jogada da IA tem intenção de matar a bola** (nada de "mexer um pouquinho à toa"):
  - se tem chance → **chuta na bola** agora
  - se não tem → **corre pra trás da bola** (ponto de chute, corrida mínima de 40px) pra chutar na próxima
  - goleiro **só defende quando a bola está no campo defensivo** — no campo de ataque ele não gasta lance
  - ameaça clara do adversário → interpõe (defesa acima de tudo)
- **Mesma arrasto = mesma distância em QUALQUER botão**: goleiro e jogador têm o MESMO atrito
  (antes o goleiro rolando 4× menos que os outros — era a diferença de "uns rolam pouco, outros vão mais longe";
  as outras diferenças visíveis são colisões: bater na bola/botão/parede faz o botão perder velocidade)
- **3 modos de dificuldade**:
  - **Fácil** — joga com erro de mira (±20° nos chutes, posicionamento torto) e 35% dos lances são frouxos
  - **Médio** — a heurística pura (fila de objetivo: goleiro → chuta → bloqueia → posiciona)
  - **Difícil** — **simula cada lance candidato na física** (clone do estado + roda até parar ou gol) e escolhe o de melhor resultado: vê ricochetes, escolhe a tacada que mais aproxima a bola do gol e **nunca faz gol contra** (a simulação rejeita o lance suicida com −100000)
- **Física própria com bola VIVA**: colisão disco-bola ELÁSTICA (restituição 0.8 — a bola quica nos botões em vez de morrer na frente), colisões disco-disco elásticas, paredes que rebatem e gols com abertura real nas laterais
- **IA 100% focada no objetivo: fazer o gol** (heurística geométrica, sem LLM): cada lance segue a fila 1) goleiro acompanha a bola no eixo do gol · 2) **CHUTA pro gol** o disco melhor alinhado atrás da bola (cosseno bola→gol > 0.55) · 3) bloqueia a linha quando o adversário ameaça · 4) **posiciona o disco mais perto do PONTO DE CHUTE** (atrás da bola, alinhado bola→gol) · 5) avança até a bola. A intenção de cada lance aparece no placar de status ("IA CHUTA pro gol!")
- **Impulso PROPORCIONAL à distância** (IA e humano): o arrasto é a distância que o botão vai andar — arrasto curto = toque de efeito, arrasto longo = força máxima; a IA chega na bola com força de sobra (o chute voa pro gol) e para no alvo quando posiciona
- **Regra clássica dos 3 lances**: cada turno dá direito a 3 lances, SEM repetir o mesmo botão (vale para os dois times)
- **Formação 2-4-2-1** (1 goleiro + 9 de linha) sem botão na linha do centro — a bola começa livre, sem sanduíche
- **Controle por flick**: clica no botão vermelho, arrasta na direção e solta

## Como rodar

```bash
npm start          # sobe o servidor estático em http://localhost:3345
npm test           # 17 testes da física + da IA (node --test)
```

**Jogue online agora**: https://francoscorporation.github.io/botao_ia/ — o jogo é 100% estático (servidor só serve arquivos). Para rodar local use `npm start` (abrir o index.html direto via file:// não carrega os módulos ES do navegador).

## Como foi testado

22 testes automatizados (node --test) cobrindo a física e a IA, todos passando, + partida real no browser verificando o GOL da IA:

- **Física (11)**: formação com 10 discos por time (1 goleiro + 9) · toque com impulso normalizado · a bola desacelera até parar · a parede rebate · gol dentro da abertura (placar incrementa) · reposicionaBola no centro · colisão disco-bola (a bola voa, o botão amortece) · **a bola RICA num botão parado a 80% (restituição)** · colisão disco-disco (ambos mudam) · parado() · o goleiro para mais rápido
- **IA (11)**: o goleiro segue a bola na vertical · chuta ao gol · bloqueia quando o adversário ameaça · 3 lances por turno sem repetir disco · sem lance disponível devolve null · o lance aplica velocidade · **impulso proporcional do chute** (chega na bola com força, não atravessa) · **posicionamento para no alvo** (não atravessa o campo) · **disco desalinhado NUNCA chuta de lado** (posiciona) · **o chute mira a própria bola**
- **Partida real no browser**: turno do humano + turno da IA → "IA CHUTA pro gol!" → **GOL da IA** (placar 0×1) — verificado também no modo Difícil (a bola levada até x=159 e gol; o turno difícil simulado roda em ~114ms)

Quatro bugs reais encontrados e corrigidos pelos próprios testes e pelo browser: o canvas escalado (clique não achava o disco), a colisão INELÁSTICA (a bola morria na frente de qualquer botão parado — não marcava gol nunca), os lances com força total (todo botão atravessava o campo, parecendo aleatório) e a formação com botões sanduíchando a bola no centro (todo chute ricocheteia na hora).

## Estrutura

```
botao_ia/
├── index.html         # o jogo (canvas 800x500)
├── style.css
├── server.js          # servidor estático (sem build)
├── js/
│   ├── fisica.js      # física: discos, bola, atrito, colisões, paredes, gols
│   ├── ia.js          # IA heurística: goleiro, chute, bloqueio, posicionamento
│   └── app.js         # UI: canvas, flick por clique-arrasto, placar, turnos
└── test/
    ├── fisica-test.mjs
    └── ia-test.mjs
```

## Sobre a série

Este é o terceiro jogo da série de jogos com IA (o primeiro é o [Jogo da Velha com IA](https://github.com/FrancosCorporation/jogo_da_velha_ia), o segundo o [Xadrez com IA](https://github.com/FrancosCorporation/xadrez_ia)): jogos clássicos no navegador, com IA rodando no browser, sem dependência externa e com testes provando as regras.

Código aberto: https://github.com/FrancosCorporation/botao_ia
