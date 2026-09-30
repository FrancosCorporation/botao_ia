// Testes da IA do futebol de botão: goleiro segue a bola, chuta ao gol, bloqueia, 3 lances sem repetir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicialFisica, toque, passo, parado, LARGURA, GOL_Y0, GOL_Y1 } from '../js/fisica.js';
import { lanceIA, turnoIA, aplicaLance, escolheLanceIA } from '../js/ia.js';

test('goleiro segue a bola na vertical (o lance aponta para a posição da bola)', () => {
  const s = estadoInicialFisica();
  s.bola.x = LARGURA - 100; s.bola.y = GOL_Y0 + 30; // bola no lado do gol da IA, ACIMA do goleiro (y menor)
  const lance = lanceIA(s, []);
  assert.ok(lance, 'lance devolvido');
  assert.equal(lance.disco.goleiro, true, 'o goleiro é o escolhido');
  assert.ok(lance.alvoY < lance.disco.y, `o goleiro sobe em direção à bola (${lance.alvoY} < ${lance.disco.y})`);
});

test('chuta ao gol: disco atrás da bola alinhado mira o ponto de chute', () => {
  const s = estadoInicialFisica();
  // disco do B a 140px da bola (dist < 220), atrás dela em relação ao gol A (esquerda)
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = (GOL_Y0 + GOL_Y1) / 2;
  s.bola.x = 60; s.bola.y = (GOL_Y0 + GOL_Y1) / 2;
  const goleiro = s.discos.find(d => d.time === 'B' && d.goleiro);
  const lance = lanceIA(s, [goleiro]);
  assert.ok(lance, 'lance devolvido');
  assert.equal(lance.disco, disco, 'o disco posicionado é o escolhido');
  assert.ok(lance.alvoX < disco.x, `o lance vai para a esquerda (em direção à bola/gol A): ${lance.alvoX} < ${disco.x}`);
});

test('bloqueia: o adversário alinhado → o disco interpõe na linha', () => {
  const s = estadoInicialFisica();
  // os zagueiros do B saem da posição de chute (x < bola) para não haver chance de chute
  for (const d of s.discos.filter(d => d.time === 'B' && !d.goleiro)) {
    if (d.x > LARGURA - 200) d.x = 500;
  }
  // disco do A alinhado para chutar o gol B (direita); a bola no meio-direita
  const atacante = s.discos.find(d => d.time === 'A' && !d.goleiro);
  atacante.x = LARGURA - 220; atacante.y = (GOL_Y0 + GOL_Y1) / 2;
  s.bola.x = LARGURA - 160; s.bola.y = (GOL_Y0 + GOL_Y1) / 2;
  const goleiroB = s.discos.find(d => d.time === 'B' && d.goleiro);
  const lance = lanceIA(s, [goleiroB]);
  assert.ok(lance, 'lance devolvido');
  // o lance deve ir em direção à linha bola→gol B (para a direita, interpondo)
  assert.ok(lance.alvoX > lance.disco.x, `o bloqueio avança (${lance.alvoX} > ${lance.disco.x})`);
});

test('turnoIA: 3 lances por turno, sem repetir o mesmo disco', () => {
  const s = estadoInicialFisica();
  const lances = turnoIA(s);
  assert.ok(lances.length > 0 && lances.length <= 3, `1-3 lances (foram ${lances.length})`);
  const discos = lances.map(l => l.disco);
  assert.equal(new Set(discos).size, discos.length, 'nenhum disco repetido no turno');
});

test('sem disco disponível (todos movidos) → lance null', () => {
  const s = estadoInicialFisica();
  const meus = s.discos.filter(d => d.time === 'B');
  const lance = lanceIA(s, meus); // todos os discos do B já mexeram
  assert.equal(lance, null, 'sem lance');
});

test('o lance da IA aplica velocidade no disco escolhido', () => {
  const s = estadoInicialFisica();
  s.bola.x = LARGURA / 2; s.bola.y = 60; // fora do gol: posicionamento
  const lance = lanceIA(s, []);
  assert.ok(lance, 'lance devolvido');
  const vAntes = Math.hypot(lance.disco.vx, lance.disco.vy);
  aplicaLance(s, lance);
  assert.ok(Math.hypot(lance.disco.vx, lance.disco.vy) > vAntes, 'o disco ganhou velocidade (o lance foi aplicado)');
});

test('IMPULSO PROPORCIONAL: chute de 140px chega na bola com força (não atravessa)', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = 250; disco.vx = 0; disco.vy = 0;
  s.bola.x = 60; s.bola.y = 250; // bola a 140px, alinhada com o gol A (esquerda)
  aplicaLance(s, { disco, alvoX: 60, alvoY: 250, tipo: 'chute' });
  const v = Math.hypot(disco.vx, disco.vy);
  // v0 = 140/40 + 4.2 = 7.7 → chega na bola com ~4.2 e o resto é força do chute
  assert.ok(v > 6.5 && v <= 9.01, `impulso proporcional do chute (v=${v.toFixed(2)})`);
});

test('IMPULSO PROPORCIONAL: posicionamento de 100px para no alvo (não atravessa o campo)', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = 250; disco.vx = 0; disco.vy = 0;
  aplicaLance(s, { disco, alvoX: 100, alvoY: 250, tipo: 'posicao' });
  const v = Math.hypot(disco.vx, disco.vy);
  // v0 = 100/40 + 0.35 = 2.85 → desliza ~114px e para (antes era sempre 9 = atravessava 360px!)
  assert.ok(v > 2 && v < 4, `impulso curto (v=${v.toFixed(2)})`);
  // prova pela física: o disco para PERTO do alvo (100px), não muito além
  let maisLonge = disco.x;
  for (let i = 0; i < 3000; i++) { passo(s); maisLonge = Math.min(maisLonge, disco.x); }
  assert.ok(maisLonge > 60 && maisLonge < 160, `parou perto do alvo 100 (parou em ${maisLonge.toFixed(0)})`);
});

test('IA nunca chuta de lado: disco desalinhado posiciona em vez de chutar', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 400; disco.y = 400; // AO LADO da bola (400,250): direção disco→bola aponta pra CIMA, não pro gol
  s.bola.x = 400; s.bola.y = 250;
  const outros = s.discos.filter(d => d.time === 'B' && d !== disco); // todos os outros já "mexeram"
  const lance = lanceIA(s, outros);
  assert.ok(lance, 'lance devolvido');
  assert.equal(lance.disco, disco, 'o disco desalinhado é o único disponível');
  assert.equal(lance.tipo, 'posicao', 'desalinhado NÃO chuta — vai se posicionar atrás da bola');
  // o ponto de chute: atrás da bola alinhado com o gol A → x = 440 (à direita da bola)
  assert.ok(lance.alvoX > s.bola.x, `vai para trás da bola alinhado ao gol (${lance.alvoX.toFixed(0)} > 400)`);
});

test('IA chuta NA bola: o alvo do chute é a própria bola', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = 250;
  s.bola.x = 60; s.bola.y = 250;
  const goleiro = s.discos.find(d => d.time === 'B' && d.goleiro);
  const lance = lanceIA(s, [goleiro]);
  assert.equal(lance.tipo, 'chute', 'é chute');
  assert.equal(lance.alvoX, 60, 'mira a bola (x)');
  assert.equal(lance.alvoY, 250, 'mira a bola (y)');
});


// ===== MODOS DE DIFICULDADE ==================================================

test('modo FACIL: devolve lance de um botao meu (pode ser frouxo, mas e dos nossos)', () => {
  const s = estadoInicialFisica();
  const lance = escolheLanceIA(s, [], 'facil');
  assert.ok(lance, 'lance devolvido');
  assert.equal(lance.disco.time, 'B', 'e um botao da IA');
});

test('modo FACIL: a mira erra (na media metade dos chutes sai torto)', () => {
  let erros = 0;
  for (let i = 0; i < 20; i++) {
    const s = estadoInicialFisica();
    const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
    disco.x = 200; disco.y = 250;
    s.bola.x = 60; s.bola.y = 250;
    const goleiro = s.discos.find(d => d.time === 'B' && d.goleiro);
    const lance = escolheLanceIA(s, [goleiro], 'facil');
    if (!lance) continue;
    if (lance.tipo !== 'chute' || lance.alvoX !== 60 || lance.alvoY !== 250) erros++;
  }
  assert.ok(erros >= 8, 'a IA facil erra a mira (errou ' + erros + '/20)');
});

test('modo MEDIO: a heuristica pura — chuta certeiro na bola alinhada', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = 250;
  s.bola.x = 60; s.bola.y = 250;
  const goleiro = s.discos.find(d => d.time === 'B' && d.goleiro);
  const lance = escolheLanceIA(s, [goleiro], 'medio');
  assert.equal(lance.tipo, 'chute', 'chuta');
  assert.equal(lance.alvoX, 60, 'mira exatamente a bola');
  assert.equal(lance.alvoY, 250, 'mira exatamente a bola (y)');
});

test('modo DIFICIL: simula e escolhe o chute que leva a bola ao gol', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 200; disco.y = 250;
  s.bola.x = 60; s.bola.y = 250;
  const goleiro = s.discos.find(d => d.time === 'B' && d.goleiro);
  const lance = escolheLanceIA(s, [goleiro], 'dificil');
  assert.equal(lance.tipo, 'chute', 'o dificil escolhe o chute (a simulacao ve o gol)');
  assert.equal(lance.alvoX, 60, 'mira a bola');
});

test('modo DIFICIL: NAO faz gol contra — lance suicida na frente do nosso gol e rejeitado', () => {
  const s = estadoInicialFisica();
  const disco = s.discos.find(d => d.time === 'B' && !d.goleiro);
  disco.x = 700; disco.y = 250;
  s.bola.x = 760; s.bola.y = 250;
  const lance = escolheLanceIA(s, [], 'dificil');
  assert.ok(lance, 'lance devolvido');
  const clone = { discos: s.discos.map(d => ({ ...d })), bola: { ...s.bola }, golA: 0, golB: 0 };
  const dC = clone.discos.find(d => d.x === lance.disco.x && d.y === lance.disco.y && d.time === lance.disco.time);
  const dx = lance.alvoX - dC.x, dy = lance.alvoY - dC.y;
  const dist = Math.hypot(dx, dy) || 1;
  const v0 = lance.tipo === 'chute' ? Math.min(9, dist / 40 + 4.2) : Math.min(9, Math.max(0.6, dist / 40 + 0.35));
  dC.vx = (dx / dist) * v0; dC.vy = (dy / dist) * v0;
  let gol = null;
  for (let i = 0; i < 900 && !gol && !parado(clone); i++) {
    const r = passo(clone);
    if (r.gol) gol = r.gol;
  }
  assert.notEqual(gol, 'A', 'o dificil NAO empurra a bola pro proprio gol (escolheu: ' + lance.tipo + ')');
});

test('performance: turno DIFICIL completo (3 lances simulados) em menos de 5s', () => {
  const s = estadoInicialFisica();
  const t0 = Date.now();
  turnoIA(s, aplicaLance, 'dificil');
  const dt = Date.now() - t0;
  assert.ok(dt < 5000, 'turno dificil levou ' + dt + 'ms (< 5000ms)');
});
