// IA do futebol de botão — 100% focada no objetivo: levar a bola ao gol adversário.
// NÃO é LLM: é um algoritmo heurístico (regras geométricas com prioridade) rodando em JS no browser.
// Toda jogada tem INTENÇÃO DE MATAR A BOLA — ou chuta agora, ou corre pra trás da bola pra chutar:
//   0) GOLEIRO: só quando a bola está no NOSSO campo (fora disso não gasta lance)
//   1) AMEAÇA: adversário alinhado e perto do nosso gol → interpõe (defesa acima de tudo)
//   2) CHUTAR: o disco MELHOR alinhado atrás da bola chuta NA bola
//   3) POSICIONAR: correr pra TRÁS da bola (ponto de chute) — corrida mínima de 40px,
//      nunca "mexer um pouquinho" à toa
// O impulso é PROPORCIONAL à distância: posicionamento para no alvo; chute chega na bola com força.

import { toque, passo, parado, GOL_Y0, GOL_Y1, LARGURA } from './fisica.js';

const LANCES_POR_TURNO = 3;
const GOL_A = { x: 0, y: (GOL_Y0 + GOL_Y1) / 2 };        // gol que a IA ataca (esquerda)
const GOL_B = { x: LARGURA, y: (GOL_Y0 + GOL_Y1) / 2 };  // gol que a IA defende (direita)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hip = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// cosseno entre (bola - disco) e (gol - bola): 1 = disco perfeitamente atrás da bola apontando pro gol
function alinhamento(disco, bola, gol) {
  const dx = bola.x - disco.x, dy = bola.y - disco.y;
  const gx = gol.x - bola.x, gy = gol.y - bola.y;
  const dLen = Math.hypot(dx, dy) || 1;
  const gLen = Math.hypot(gx, gy) || 1;
  return (dx * gx + dy * gy) / (dLen * gLen);
}

// ponto de chute: atrás da bola, na linha bola→gol, a `recuo` px da bola
function pontoDeChute(bola, gol, recuo) {
  const gx = gol.x - bola.x, gy = gol.y - bola.y;
  const len = Math.hypot(gx, gy) || 1;
  return { x: bola.x - (gx / len) * recuo, y: bola.y - (gy / len) * recuo };
}

export function lanceIA(estado, movidosNoTurno = []) {
  const { discos, bola } = estado;
  const nossoCampo = bola.x > LARGURA * 0.5; // a bola está no NOSSO campo?
  const goleiro = discos.find(d => d.time === 'B' && d.goleiro);
  const meus = discos.filter(d => d.time === 'B' && !d.goleiro && !movidosNoTurno.includes(d));

  // 0) GOLEIRO: só defende quando a bola está no NOSSO campo —
  //    se a bola tá no campo de ataque, o goleiro NÃO gasta lance (ataque acima de tudo)
  if (goleiro && nossoCampo && !movidosNoTurno.includes(goleiro)) {
    const alvoY = clamp(bola.y, GOL_Y0 + 18, GOL_Y1 - 18);
    if (Math.abs(goleiro.y - alvoY) > 12 || Math.abs(goleiro.x - (LARGURA - 90)) > 20) {
      return { disco: goleiro, alvoX: LARGURA - 90, alvoY, tipo: 'goleiro' };
    }
  }

  // 1) AMEAÇA: adversário alinhado e PERTO do nosso gol → interpõe antes de tudo
  if (bola.x > LARGURA * 0.55) {
    const ameaca = discos.some(d => d.time === 'A' && !d.goleiro
      && hip(d, bola) < 240 && alinhamento(d, bola, GOL_B) > 0.6);
    if (ameaca) {
      const ponto = pontoDeChute(bola, GOL_B, -55); // 55px à frente da bola, na linha do nosso gol
      let escolhido = null, menor = Infinity;
      for (const d of meus) {
        const c = hip(d, ponto);
        if (c > 40 && c < menor) { menor = c; escolhido = d; } // corrida de verdade (mín. 40px)
      }
      if (escolhido) return { disco: escolhido, alvoX: ponto.x, alvoY: ponto.y, tipo: 'bloqueio' };
    }
  }

  // 2) CHUTAR AO GOL: o disco melhor alinhado atrás da bola chuta NA bola
  let melhor = null, melhorS = -Infinity;
  for (const d of meus) {
    const dist = hip(d, bola);
    const cos = alinhamento(d, bola, GOL_A);
    if (dist > 8 && dist < 320 && cos > 0.55) {
      const s = cos * 2 - dist / 320; // mais alinhado e mais perto ganha
      if (s > melhorS) { melhorS = s; melhor = d; }
    }
  }
  if (melhor) return { disco: melhor, alvoX: bola.x, alvoY: bola.y, tipo: 'chute' };

  // 3) POSICIONAR PRA CHUTAR: correr pra TRÁS da bola (ponto de chute) — nunca "mexer um
  //    pouquinho": corrida mínima de 40px, senão o disco já está coberto e outro é escolhido
  for (const recuo of [40, 90]) {
    const ponto = pontoDeChute(bola, GOL_A, recuo);
    let escolhido = null, menor = Infinity;
    for (const d of meus) {
      const c = hip(d, ponto);
      if (c < 40) continue;              // já está no ponto (ou a 40px = coberto)
      const ocupado = discos.some(o => o !== d && o.time === 'B' && hip(o, ponto) < 26);
      if (ocupado) continue;             // outro disco MEU já cobre o ponto
      if (c < menor && c < 340) { menor = c; escolhido = d; }
    }
    if (escolhido) return { disco: escolhido, alvoX: ponto.x, alvoY: ponto.y, tipo: 'posicao' };
  }

  // 4) FALLBACK: ninguém alinhado e nenhum ponto livre → o restante mais perto do ponto
  //    de chute VAI PRA TRÁS DA BOLA (a intenção continua: preparar o chute, não andar à toa)
  const ponto = pontoDeChute(bola, GOL_A, 40);
  let proximo = null, menor = Infinity;
  for (const d of meus) {
    const c = hip(d, ponto);
    if (c < menor) { menor = c; proximo = d; }
  }
  if (proximo) return { disco: proximo, alvoX: ponto.x, alvoY: ponto.y, tipo: 'posicao' };
  return null;
}

// aplica o lance com impulso PROPORCIONAL à distância:
// a física desliza ~40×v0 px no total → v0 = dist/40 faz o disco parar no alvo;
// chute ganha +4.2 de força para chegar na bola com velocidade de sobra (a bola voa pro gol)
export function aplicaLance(estado, lance) {
  const dx = lance.alvoX - lance.disco.x, dy = lance.alvoY - lance.disco.y;
  const dist = Math.hypot(dx, dy) || 1;
  let v0;
  if (lance.tipo === 'chute') v0 = Math.min(9, dist / 40 + 4.2);
  else v0 = clamp(dist / 40 + 0.35, 0.6, 9);
  toque(lance.disco, dx, dy, v0);
}

// joga o TURNO completo da IA (3 lances, sem repetir disco)
export function turnoIA(estado, aplica = aplicaLance, dificuldade = 'medio') {
  const lances = [];
  const movidos = [];
  for (let i = 0; i < LANCES_POR_TURNO; i++) {
    const lance = escolheLanceIA(estado, movidos, dificuldade);
    if (!lance) break;
    aplica(estado, lance);
    lances.push(lance);
    movidos.push(lance.disco);
  }
  return lances;
}

// ============================================================================
// MODOS DE DIFULDADE
//   fácil   → heurística com ERRO DE MIRA (±20° nos chutes, jitter no
//             posicionamento) e 35% de lance frouxo aleatório perto da bola
//   médio   → a heurística pura (fila de objetivo: goleiro→chuta→bloqueia→posiciona)
//   difícil → SIMULA CADA LANCE CANDIDATO na física (clone + roda até parar
//             ou gol) e escolhe o de melhor resultado — vê ricochetes, evita
//             gol contra, escolhe a tacada que mais aproxima a bola do gol
// ============================================================================

export function escolheLanceIA(estado, movidos = [], dificuldade = 'medio') {
  if (dificuldade === 'facil') return lanceFacil(estado, movidos);
  if (dificuldade === 'dificil') return lanceDificil(estado, movidos);
  return lanceIA(estado, movidos);
}

// --- FÁCIL: joga com erro ---------------------------------------------------
function lanceFacil(estado, movidos) {
  const meus = estado.discos.filter(d => d.time === 'B' && !d.goleiro && !movidos.includes(d));
  if (!meus.length) return lanceIA(estado, movidos);

  // 35% dos lances: frouxo — um dos botões perto da bola vai pra um ponto qualquer
  if (Math.random() < 0.35) {
    const ordenados = meus.slice().sort((a, b) => hip(a, estado.bola) - hip(b, estado.bola));
    const d = ordenados[Math.floor(Math.random() * Math.min(3, ordenados.length))];
    return {
      disco: d,
      alvoX: estado.bola.x + (Math.random() * 120 - 60),
      alvoY: estado.bola.y + (Math.random() * 120 - 60),
      tipo: 'aproximar',
    };
  }

  // o resto: a heurística, mas com MIRA IMPERFEITA
  const l = lanceIA(estado, movidos);
  if (!l) return null;
  if (l.tipo === 'chute') {
    const dx = l.alvoX - l.disco.x, dy = l.alvoY - l.disco.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx) + (Math.random() * 0.7 - 0.35); // erro de ±20°
    return { ...l, alvoX: l.disco.x + Math.cos(ang) * dist, alvoY: l.disco.y + Math.sin(ang) * dist };
  }
  return { ...l, alvoX: l.alvoX + (Math.random() * 80 - 40), alvoY: l.alvoY + (Math.random() * 80 - 40) };
}

// --- DIFÍCIL: simula cada candidato e escolhe o melhor resultado ------------
function cloneEstado(estado) {
  return {
    discos: estado.discos.map(d => ({ ...d })),
    bola: { ...estado.bola },
    golA: estado.golA, golB: estado.golB,
  };
}

// avaliação do resultado simulado (do ponto de vista da IA = time B, ataca o gol A)
function avaliarSim(e, gol) {
  if (gol === 'B') return 100000;   // a bola entrou no gol A → GOL NOSSO
  if (gol === 'A') return -100000;  // ricocheteu pro NOSSO gol → gol contra (o difícil NUNCA faz isso)
  let s = 0;
  const bola = e.bola;
  s += (LARGURA - bola.x) * 2;                                  // bola avançada = bom
  if (bola.x > LARGURA * 0.6) s -= (bola.x - LARGURA * 0.6) * 5; // bola no nosso campo = risco
  const goleiro = e.discos.find(d => d.time === 'B' && d.goleiro);
  const alvoY = clamp(bola.y, GOL_Y0 + 18, GOL_Y1 - 18);
  s += 25 - Math.abs(goleiro.y - alvoY);                        // goleiro cobrindo o eixo do gol
  let prontos = 0, ameacas = 0;
  for (const d of e.discos) {
    if (d.goleiro) continue;
    const dist = hip(d, bola);
    if (d.time === 'B' && alinhamento(d, bola, GOL_A) > 0.55 && dist < 220) prontos++;
    if (d.time === 'A' && alinhamento(d, bola, GOL_B) > 0.5 && dist < 260) ameacas++;
  }
  s += prontos * 20;   // botões nossos atrás da bola prontos pra chutar
  s -= ameacas * 30;   // botões deles apontando pro nosso gol
  return s;
}

// roda o lance candidato na física clonada e devolve a avaliação do resultado
function simulaLance(estado, cand) {
  const clone = cloneEstado(estado);
  const d = clone.discos[cand.idx];
  const dx = cand.alvoX - d.x, dy = cand.alvoY - d.y;
  const dist = Math.hypot(dx, dy) || 1;
  const v0 = cand.tipo === 'chute' ? Math.min(9, dist / 40 + 4.2) : clamp(dist / 40 + 0.35, 0.6, 9);
  toque(d, dx, dy, v0);
  let gol = null;
  for (let i = 0; i < 900 && !gol && !parado(clone); i++) {
    const r = passo(clone);
    if (r.gol) gol = r.gol;
  }
  return avaliarSim(clone, gol);
}

// todos os lances candidatos razoáveis (limitados pra manter a simulação rápida)
function candidatosLance(estado, movidos) {
  const { discos, bola } = estado;
  const out = [];
  const alvoY = clamp(bola.y, GOL_Y0 + 18, GOL_Y1 - 18);
  const nossoCampo = bola.x > LARGURA * 0.5;

  // goleiro: só quando a bola está no NOSSO campo (ataque acima de tudo)
  const gIdx = discos.findIndex(d => d.time === 'B' && d.goleiro);
  const g = discos[gIdx];
  if (!movidos.includes(g) && nossoCampo
      && (Math.abs(g.y - alvoY) > 14 || Math.abs(g.x - (LARGURA - 90)) > 20)) {
    out.push({ idx: gIdx, disco: g, alvoX: LARGURA - 90, alvoY, tipo: 'goleiro' });
  }

  const meus = discos.map((d, i) => ({ d, i }))
    .filter(({ d }) => d.time === 'B' && !d.goleiro && !movidos.includes(d));

  // ameaça → interpôr na linha do nosso gol (defesa acima de tudo; a simulação decide)
  if (bola.x > LARGURA * 0.55) {
    const ameaca = discos.some(d => d.time === 'A' && !d.goleiro
      && hip(d, bola) < 240 && alinhamento(d, bola, GOL_B) > 0.6);
    if (ameaca) {
      const ponto = pontoDeChute(bola, GOL_B, -55);
      meus.filter(({ d }) => hip(d, ponto) > 40 && hip(d, ponto) < 340)
        .sort((a, b) => hip(a.d, ponto) - hip(b.d, ponto))
        .slice(0, 2)
        .forEach(({ d, i }) => out.push({ idx: i, disco: d, alvoX: ponto.x, alvoY: ponto.y, tipo: 'bloqueio' }));
    }
  }

  // chutes: QUALQUER botão atrás da bola e perto — quem julga se vale é a SIMULAÇÃO
  // (ela rejeita gol contra com −100000 e premia a bola que avança pro gol)
  const chutes = [];
  for (const { d, i } of meus) {
    const dist = hip(d, bola);
    if (dist > 8 && dist < 340 && alinhamento(d, bola, GOL_A) > 0.05) {
      chutes.push({ idx: i, disco: d, alvoX: bola.x, alvoY: bola.y, tipo: 'chute', dist });
    }
  }
  chutes.sort((a, b) => a.dist - b.dist); // perto primeiro: empate na avaliação → o mais certeiro
  for (const { dist, ...c } of chutes) out.push(c);

  // posicionamento: correr pra TRÁS da bola (40px e 90px atrás) — no mínimo 40px de corrida
  const mapa = new Map();
  for (const recuo of [40, 90]) {
    const ponto = pontoDeChute(bola, GOL_A, recuo);
    for (const { d, i } of meus) {
      const dist = hip(d, ponto);
      if (dist > 40 && dist < 340) {
        const prev = mapa.get(i);
        if (!prev || prev.dist > dist) mapa.set(i, { idx: i, disco: d, alvoX: ponto.x, alvoY: ponto.y, tipo: 'posicao', dist });
      }
    }
  }
  const pos = [...mapa.values()].sort((a, b) => a.dist - b.dist).slice(0, 3);
  for (const { dist, ...c } of pos) out.push(c);

  return out;
}

function lanceDificil(estado, movidos) {
  const cands = candidatosLance(estado, movidos);
  if (!cands.length) return lanceIA(estado, movidos);
  let melhor = null, melhorS = -Infinity;
  for (const c of cands) {
    const s = simulaLance(estado, c);
    if (s > melhorS) { melhorS = s; melhor = c; }
  }
  if (!melhor) return lanceIA(estado, movidos);
  return { disco: melhor.disco, alvoX: melhor.alvoX, alvoY: melhor.alvoY, tipo: melhor.tipo };
}
