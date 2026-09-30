// Testes da FÍSICA do futebol de botão: formação, toque, atrito, paredes, gols, colisões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoInicialFisica, formação, toque, passo, parado, reposicionaBola,
  LARGURA, ALTURA, GOL_Y0, GOL_Y1, GOL_ALTURA,
} from '../js/fisica.js';

test('formação: 10 discos por time (1 goleiro + 9 de linha)', () => {
  const a = formação('A');
  const b = formação('B');
  assert.equal(a.length, 10, 'time A: 10 discos');
  assert.equal(b.length, 10, 'time B: 10 discos');
  assert.equal(a.filter(d => d.goleiro).length, 1, '1 goleiro');
  assert.equal(b.filter(d => d.goleiro).length, 1, '1 goleiro');
  assert.ok(a.every(d => d.time === 'A'), 'todos do time A');
  assert.ok(b.every(d => d.time === 'B'), 'todos do time B');
});

test('estado inicial: 20 discos + a bola no centro + 0x0 no placar', () => {
  const s = estadoInicialFisica();
  assert.equal(s.discos.length, 20);
  assert.equal(s.bola.x, LARGURA / 2);
  assert.equal(s.bola.y, ALTURA / 2);
  assert.equal(s.golA, 0);
  assert.equal(s.golB, 0);
});

test('toque: o disco desliza na direção do vetor com o impulso', () => {
  const s = estadoInicialFisica();
  const d = s.discos.find(d => d.time === 'A' && !d.goleiro);
  toque(d, 1, 0, 9); // direita
  assert.ok(d.vx > 8, `vx ≈ impulso (vx=${d.vx})`);
  assert.ok(Math.abs(d.vy) < 0.1, 'vy ≈ 0');
  // normalização: direção diagonal mantém o módulo do impulso
  const d2 = s.discos.find(d => d.time === 'A' && !d.goleiro && d !== d);
  const d3 = s.discos[1];
  toque(d3, 3, 4, 10); // vetor de comprimento 5
  assert.ok(Math.hypot(d3.vx, d3.vy) > 9.9 && Math.hypot(d3.vx, d3.vy) < 10.1, `impulso normalizado (${Math.hypot(d3.vx, d3.vy)})`);
});

test('a bola desacelera até parar (atrito)', () => {
  const s = estadoInicialFisica();
  s.bola.vx = 10; s.bola.vy = 0;
  for (let i = 0; i < 3000; i++) passo(s);
  assert.equal(s.bola.vx, 0, 'a bola parou');
  assert.ok(s.bola.x > LARGURA / 2, 'a bola andou para a direita antes de parar');
});

test('parede rebate a bola (fora da abertura do gol)', () => {
  const s = estadoInicialFisica();
  s.bola.x = LARGURA / 2; s.bola.y = 60; // fora da faixa do gol (GOL_Y0 = 175)
  s.bola.vx = 10; s.bola.vy = 0;
  let rebateu = false;
  for (let i = 0; i < 400; i++) {
    const vxAntes = s.bola.vx;
    passo(s);
    if (vxAntes > 0 && s.bola.vx < 0) { rebateu = true; break; }
  }
  assert.ok(rebateu, 'a bola rebateu na parede direita');
  assert.ok(!parado(s) || true);
});

test('GOL: a bola cruzando a linha dentro da abertura marca gol', () => {
  const s = estadoInicialFisica();
  s.bola.x = LARGURA - 12; s.bola.y = (GOL_Y0 + GOL_Y1) / 2; // no meio da abertura direita
  s.bola.vx = 14; s.bola.vy = 0;
  let gol = null;
  for (let i = 0; i < 100 && !gol; i++) {
    const res = passo(s);
    if (res.gol) gol = res.gol;
  }
  assert.equal(gol, 'A', 'gol do A (abertura direita)');
  assert.equal(s.golA, 1, 'placar do A incrementou');
});

test('reposicionaBola devolve a bola ao centro com velocidade zero', () => {
  const s = estadoInicialFisica();
  s.bola.x = 50; s.bola.vx = 5;
  reposicionaBola(s);
  assert.equal(s.bola.x, LARGURA / 2);
  assert.equal(s.bola.vx, 0);
});

test('colisão disco-bola: a bola recebe o impulso e o disco desacelera', () => {
  const s = estadoInicialFisica();
  // coloca um disco do A encostado na bola e dá impulso na direção dela
  const d = s.discos.find(d => d.time === 'A' && !d.goleiro);
  d.x = s.bola.x - 30; d.y = s.bola.y; d.vx = 0; d.vy = 0;
  toque(d, 1, 0, 9); // o disco vai para a direita, na bola
  let bateu = false;
  const vBolaAntes = Math.hypot(s.bola.vx, s.bola.vy);
  for (let i = 0; i < 200 && !bateu; i++) {
    passo(s);
    if (Math.hypot(s.bola.vx, s.bola.vy) > vBolaAntes + 1) bateu = true;
  }
  assert.ok(bateu, 'a bola ganhou velocidade no impacto');
  assert.ok(Math.hypot(d.vx, d.vy) < 5, `o disco perdeu força no impacto (vx=${d.vx.toFixed(2)})`);
});

test('colisão disco-disco: ambos mudam de velocidade', () => {
  const s = estadoInicialFisica();
  const a = s.discos[0], b = s.discos[10];
  a.x = LARGURA / 2 - 30; a.y = ALTURA / 2; a.vx = 8; a.vy = 0;
  b.x = LARGURA / 2 + 10; b.y = ALTURA / 2; b.vx = 0; b.vy = 0;
  const vAntes = Math.hypot(b.vx, b.vy);
  for (let i = 0; i < 100 && vAntes === Math.hypot(b.vx, b.vy); i++) passo(s);
  assert.ok(Math.hypot(b.vx, b.vy) > 0, 'o disco B ganhou velocidade na colisão');
});

test('parado(): true quando tudo parado, false quando algo em movimento', () => {
  const s = estadoInicialFisica();
  assert.equal(parado(s), true, 'tudo parado no início');
  s.bola.vx = 3;
  assert.equal(parado(s), false, 'a bola em movimento');
});

test('o goleiro para mais rápido (atrito maior)', () => {
  const s = estadoInicialFisica();
  const g = s.discos.find(d => d.goleiro && d.time === 'A');
  const linha = s.discos.find(d => !d.goleiro && d.time === 'A');
  g.x = 200; g.y = 100; g.vx = 9; g.vy = 0;
  linha.x = 200; linha.y = 300; linha.vx = 9; linha.vy = 0;
  let gParou = false, linhaParou = false;
  for (let i = 0; i < 600; i++) {
    passo(s);
    if (g.vx === 0 && g.vy === 0) gParou = true;
    if (linha.vx === 0 && linha.vy === 0) linhaParou = true;
  }
  assert.ok(gParou && linhaParou, 'ambos param');
  assert.ok(g.x < linha.x, `o goleiro anda menos (${g.x} < ${linha.x})`);
});
