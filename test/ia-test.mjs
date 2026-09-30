// Testes da IA do futebol de botão: goleiro segue a bola, chuta ao gol, bloqueia, 3 lances sem repetir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicialFisica, toque, passo, LARGURA, GOL_Y0, GOL_Y1 } from '../js/fisica.js';
import { lanceIA, turnoIA } from '../js/ia.js';

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
  toque(lance.disco, lance.alvoX - lance.disco.x, lance.alvoY - lance.disco.y);
  assert.ok(Math.hypot(lance.disco.vx, lance.disco.vy) > vAntes, 'o disco ganhou velocidade (o lance foi aplicado)');
});
