# Futebol de Botão com IA

Eu queria jogar futebol de botão no navegador — aquele jogo clássico dos botões deslizando no campo — com uma IA que pensa de verdade do outro lado, sem instalar nada e sem depender de serviço pago. Então construí o meu: o jogo inteiro é HTML, CSS e JavaScript puro, a física roda no browser e a IA (heurística que chuta, bloqueia e posiciona) também.

## O que tem

- **Física própria**: discos com atrito, bola leve que recebe quase todo o impulso no impacto, colisões elásticas disco-disco, paredes que rebatem e gols com abertura real nas laterais
- **IA com linha de raciocínio** (o "cérebro" mínimo que pensa, na ordem): 1) o goleiro segue a bola no eixo do gol · 2) chuta ao gol quando algum disco está atrás da bola alinhado · 3) bloqueia a linha quando o adversário ameaça · 4) posiciona o disco mais próximo atrás da bola para o próximo chute
- **Regra clássica dos 3 lances**: cada turno dá direito a 3 lances, sem repetir o mesmo botão no mesmo turno
- **Formação 2-3-3-1** (1 goleiro + 9 de linha) para cada time
- **Controle por flick**: clica no botão vermelho, arrasta na direção e solta — o disco desliza e a bola recebe o impacto

## Como rodar

```bash
npm start          # sobe o servidor estático em http://localhost:3345
npm test           # 17 testes da física + da IA (node --test)
```

Ou abra o `index.html` direto no navegador: o jogo é 100% estático, sem etapa de build.

## Como foi testado

17 testes automatizados (node --test) cobrindo a física e a IA, todos passando:

- **Física (11)**: formação com 10 discos por time (1 goleiro + 9) · toque com impulso normalizado (módulo mantido em qualquer direção) · a bola desacelera até parar · a parede rebate · gol marcado dentro da abertura (placar incrementa) · reposicionaBola no centro · colisão disco-bola (a bola ganha velocidade, o disco perde força) · colisão disco-disco (ambos mudam) · parado() · o goleiro para mais rápido (atrito maior)
- **IA (6)**: o goleiro segue a bola na vertical · chuta ao gol (disco atrás da bola mira o ponto de chute) · bloqueia quando o adversário ameaça (interpõe na linha bola→gol) · 3 lances por turno sem repetir disco · sem lance disponível devolve null · o lance aplica velocidade no disco escolhido

O bug clássico do canvas escalado (o clique não achava o disco porque as coordenadas da tela não convertiam para as do jogo) foi encontrado testando no browser real e corrigido com a conversão de escala nos handlers.

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
