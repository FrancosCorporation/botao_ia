// IA heurística do futebol de botão — o "cérebro" mínimo que pensa: chuta ao gol, bloqueia, posiciona, defende.
// A IA joga com o time B (ataca para a ESQUERDA, o gol A). O humano é o A (ataca para a direita).
// 3 lances por turno; não pode mover o mesmo disco 2x no mesmo turno.

import { toque, GOL_Y0, GOL_Y1, LARGURA, ALTURA } from './fisica.js';

const LANCES_POR_TURNO = 3;

// o ponto atrás da bola, alinhado bola → centro do gol adversário
function pontoDeChute(estado, golCx) {
  const { bola } = estado;
  const golCy = (GOL_Y0 + GOL_Y1) / 2;
  const dx = golCx - bola.x, dy = golCy - bola.y;
  const len = Math.hypot(dx, dy) || 1;
  // o disco precisa chegar por TRÁS da bola (na linha bola→gol, antes da bola)
  const recuo = 26; // raio do disco + folga
  return { x: bola.x - (dx / len) * recuo, y: bola.y - (dy / len) * recuo };
}

// o disco consegue chutar? (está atrás da bola em relação ao gol e perto o suficiente)
function podeChutar(estado, disco, golCx) {
  const { bola } = estado;
  const golCy = (GOL_Y0 + GOL_Y1) / 2;
  // o disco está do lado oposto ao gol em relação à bola (atrás dela)?
  const atrás = (bola.x - disco.x) * (golCx - bola.x) > 0 || (bola.y - disco.y) * (golCy - bola.y) > 0;
  const dist = Math.hypot(bola.x - disco.x, bola.y - disco.y);
  return atrás && dist < 220;
}

// o adversário está alinhado para chutar? (existe disco adversário atrás da bola apontando pro nosso gol)
function ameacaDeGol(estado, nossoGolCx) {
  const { bola } = estado;
  const golCy = (GOL_Y0 + GOL_Y1) / 2;
  for (const d of estado.discos) {
    if (d.goleiro) continue;
    const atrás = (bola.x - d.x) * (nossoGolCx - bola.x) > 0;
    const dist = Math.hypot(bola.x - d.x, bola.y - d.y);
    // alinhado na vertical (a bola está entre o disco e o nosso gol, dentro da faixa do gol)
    if (atrás && dist < 260 && Math.abs(bola.y - d.y) < 120) return d;
  }
  return null;
}

// decide o PRÓXIMO LANCE da IA: devolve {disco, alvoX, alvoY} ou null (sem lance)
export function lanceIA(estado, movidosNoTurno = []) {
  const { discos, bola } = estado;
  const golAlvo = 0;             // o gol A (que a IA ataca) fica na esquerda (x=0)
  const nossoGol = LARGURA;      // o gol B (que a IA defende) fica na direita (x=LARGURA)
  const goleiro = discos.find(d => d.time === 'B' && d.goleiro);
  const meus = discos.filter(d => d.time === 'B' && !d.goleiro && !movidosNoTurno.includes(d));

  // 1) GOLEIRO: segue a bola na vertical (fica no eixo do gol)
  if (goleiro && !movidosNoTurno.includes(goleiro)) {
    const alvoY = Math.min(Math.max(bola.y, GOL_Y0 + 20), GOL_Y1 - 20);
    if (Math.abs(goleiro.y - alvoY) > 14) {
      return { disco: goleiro, alvoX: goleiro.x, alvoY };
    }
  }

  // 2) CHUTAR: algum disco meu está atrás da bola apontando pro gol deles
  for (const d of meus) {
    if (podeChutar(estado, d, golAlvo)) {
      const alvo = pontoDeChute(estado, golAlvo);
      return { disco: d, alvoX: alvo.x, alvoY: alvo.y, chutar: true };
    }
  }

  // 3) BLOQUEAR: o adversário ameaça o nosso gol → o disco mais próximo interpõe na linha
  const ameaca = ameacaDeGol(estado, nossoGol);
  if (ameaca) {
    const golCy = (GOL_Y0 + GOL_Y1) / 2;
    // ponto na linha bola → nosso gol, perto da bola
    const dx = nossoGol - bola.x, dy = golCy - bola.y;
    const len = Math.hypot(dx, dy) || 1;
    const alvo = { x: bola.x + (dx / len) * 60, y: bola.y + (dy / len) * 60 };
    // o disco meu mais próximo da bola que não mexeu
    let maisPerto = null, menorDist = Infinity;
    for (const d of meus) {
      const dist = Math.hypot(bola.x - d.x, bola.y - d.y);
      if (dist < menorDist) { menorDist = dist; maisPerto = d; }
    }
    if (maisPerto) return { disco: maisPerto, alvoX: alvo.x, alvoY: alvo.y };
  }

  // 4) POSICIONAR: o disco mais próximo da bola vai para TRÁS dela (alinhado pro gol de ataque)
  let maisPerto = null, menorDist = Infinity;
  for (const d of meus) {
    const dist = Math.hypot(bola.x - d.x, bola.y - d.y);
    if (dist < menorDist) { menorDist = dist; maisPerto = d; }
  }
  if (maisPerto && menorDist > 30) {
    const alvo = pontoDeChute(estado, golAlvo);
    return { disco: maisPerto, alvoX: alvo.x, alvoY: alvo.y };
  }

  return null;
}

// joga o TURNO completo da IA (3 lances): devolve a lista de lances aplicados
export function turnoIA(estado, aplicaLance = (estado, lance) => toque(lance.disco, lance.alvoX - lance.disco.x, lance.alvoY - lance.disco.y)) {
  const lances = [];
  const movidos = [];
  for (let i = 0; i < LANCES_POR_TURNO; i++) {
    const lance = lanceIA(estado, movidos);
    if (!lance) break;
    aplicaLance(estado, lance);
    lances.push(lance);
    movidos.push(lance.disco);
  }
  return lances;
}
