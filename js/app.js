// UI do futebol de botão — canvas com o campo, os discos e a bola; controle por clique-arrasto (flick).
// O humano é o time A (esquerda, ataca para a direita). A IA é o B. 3 lances por turno.

import { estadoInicialFisica, passo, parado, reposicionaBola, toque, LARGURA, ALTURA, GOL_Y0, GOL_Y1 } from './fisica.js';
import { lanceIA, aplicaLance } from './ia.js';

const $canvas = document.getElementById('campo');
const $status = document.getElementById('status');
const $placar = document.getElementById('placar');
const $reiniciar = document.getElementById('reiniciar');
const ctx2d = $canvas.getContext('2d');

let estado = estadoInicialFisica();
let lancesRestantes = 3;
let discoSelecionado = null;
let arrasto = null;        // {x1, y1} — ponto atual da mira
let esperandoFisica = false;
let fase = 'humano';       // 'humano' (input) | 'ia' (lances da IA)
let lancesIAFeitos = 0;

function avisa(msg) { $status.textContent = msg; }
function pintaPlacar() { $placar.textContent = `Você ${estado.golA} × ${estado.golB} IA`; }

function desenha() {
  const c = ctx2d;
  c.fillStyle = '#2e7d32';
  c.fillRect(0, 0, LARGURA, ALTURA);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 8; i += 2) c.fillRect((LARGURA / 8) * i, 0, LARGURA / 8, ALTURA);
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 2;
  c.strokeRect(6, 6, LARGURA - 12, ALTURA - 12);
  c.beginPath(); c.moveTo(LARGURA / 2, 6); c.lineTo(LARGURA / 2, ALTURA - 6); c.stroke();
  c.beginPath(); c.arc(LARGURA / 2, ALTURA / 2, 60, 0, Math.PI * 2); c.stroke();
  // gols (aberturas nas laterais)
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(0, GOL_Y0, 8, GOL_Y1 - GOL_Y0);
  c.fillRect(LARGURA - 8, GOL_Y0, 8, GOL_Y1 - GOL_Y0);
  c.fillStyle = '#ffd166';
  c.fillRect(0, GOL_Y0, 8, 4);
  c.fillRect(0, GOL_Y1 - 4, 8, 4);
  c.fillRect(LARGURA - 8, GOL_Y0, 8, 4);
  c.fillRect(LARGURA - 8, GOL_Y1 - 4, 8, 4);

  // linha de mira do arrasto
  if (arrasto && discoSelecionado) {
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.setLineDash([6, 4]);
    c.beginPath();
    c.moveTo(discoSelecionado.x, discoSelecionado.y);
    c.lineTo(arrasto.x1, arrasto.y1);
    c.stroke();
    c.setLineDash([]);
  }

  for (const d of estado.discos) {
    c.beginPath();
    c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    c.fillStyle = d.time === 'A' ? '#e53935' : '#1e88e5';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.stroke();
    if (d.goleiro) {
      c.beginPath();
      c.arc(d.x, d.y, d.r - 6, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.stroke();
    }
    if (d === discoSelecionado && fase === 'humano') {
      c.beginPath();
      c.arc(d.x, d.y, d.r + 4, 0, Math.PI * 2);
      c.strokeStyle = '#ffd166';
      c.lineWidth = 3;
      c.stroke();
    }
  }

  c.beginPath();
  c.arc(estado.bola.x, estado.bola.y, estado.bola.r, 0, Math.PI * 2);
  c.fillStyle = '#fff';
  c.fill();
  c.strokeStyle = '#222';
  c.lineWidth = 1.5;
  c.stroke();
}

// aplica o gol (se houver) e reposiciona a bola
function cuidaGol() {
  const res = passo(estado);
  if (res.gol) {
    pintaPlacar();
    reposicionaBola(estado);
    avisa(res.gol === 'A' ? 'GOL seu! 🎉 Bola no centro' : 'Gol da IA. Bola no centro');
  }
}

function rodaFisica() {
  for (let i = 0; i < 3; i++) cuidaGol();
  if (parado(estado)) {
    esperandoFisica = false;
    if (fase === 'ia') {
      lancesIAFeitos++;
      if (lancesIAFeitos < 3) {
        setTimeout(lanceDaIA, 450); // próximo lance da IA
      } else {
        lancesIAFeitos = 0;
        fase = 'humano';
        lancesRestantes = 3;
        movidosHumano = [];
        avisa('Seu turno: 3 lances — clique num botão e arraste');
      }
    } else if (lancesRestantes > 0) {
      avisa(`Seu lance: ${lancesRestantes} restante(s)`);
    } else {
      fase = 'ia';
      lancesIAFeitos = 0;
      movidosIA = []; // cada turno começa limpo (regra: não repetir botão)
      avisa('Turno da IA...');
      setTimeout(lanceDaIA, 700);
    }
  }
}

const INTENCAO = {
  chute: 'IA CHUTA pro gol!',
  posicao: 'IA se posiciona atrás da bola pra chutar',
  bloqueio: 'IA bloqueia o caminho do gol',
  goleiro: 'Goleiro acompanha a bola',
  aproximar: 'IA avança em direção à bola',
};

function lanceDaIA() {
  if (esperandoFisica) return;
  const lance = lanceIA(estado, movidosIA);
  if (lance) {
    aplicaLance(estado, lance); // impulso proporcional: chega na bola / para no alvo
    movidosIA.push(lance.disco); // regra dos 3 lances: não repete o botão
    esperandoFisica = true;
    avisa(`${INTENCAO[lance.tipo] || 'IA jogando'} (lance ${lancesIAFeitos + 1}/3)`);
  } else {
    // sem lance: passa a vez (conta como lance feito)
    lancesIAFeitos++;
    if (lancesIAFeitos < 3) setTimeout(lanceDaIA, 300);
    else {
      lancesIAFeitos = 0;
      fase = 'humano';
      lancesRestantes = 3;
      movidosHumano = [];
      avisa('Seu turno: 3 lances');
    }
  }
}

let movidosIA = [];
let movidosHumano = []; // botões já mexidos pelo humano no turno (regra: não repetir)

// converte as coordenadas da tela para as do jogo (o canvas escala por CSS)
function coordsJogo(e) {
  const rect = $canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (LARGURA / rect.width),
    y: (e.clientY - rect.top) * (ALTURA / rect.height),
  };
}

$canvas.addEventListener('mousedown', (e) => {
  if (fase !== 'humano' || esperandoFisica || lancesRestantes <= 0) return;
  const { x, y } = coordsJogo(e);
  const d = estado.discos.find(d => d.time === 'A' && Math.hypot(d.x - x, d.y - y) <= d.r + 10);
  if (d) {
    discoSelecionado = d;
    arrasto = { x1: x, y1: y };
  }
});
$canvas.addEventListener('mousemove', (e) => {
  if (arrasto && discoSelecionado) {
    const { x, y } = coordsJogo(e);
    arrasto.x1 = x;
    arrasto.y1 = y;
  }
});
window.addEventListener('mouseup', (e) => {
  if (arrasto && discoSelecionado && fase === 'humano' && !esperandoFisica) {
    const dx = arrasto.x1 - discoSelecionado.x, dy = arrasto.y1 - discoSelecionado.y;
    if (Math.hypot(dx, dy) > 8) {
      if (movidosHumano.includes(discoSelecionado)) {
        avisa('Você já mexeu esse botão neste turno — escolha outro');
      } else {
        // impulso PROPORCIONAL ao arrasto: arrasto curto = toque leve; arrasto longo = força máxima
        // (a física desliza ~40×v0 px — o arrasto vira a distância que o botão vai andar)
        const v0 = Math.min(9, Math.max(0.8, Math.hypot(dx, dy) / 45 + 0.5));
        toque(discoSelecionado, dx, dy, v0);
        movidosHumano.push(discoSelecionado); // regra dos 3 lances: não repete o botão
        lancesRestantes--;
        esperandoFisica = true;
        avisa(`Lance dado! ${lancesRestantes} restante(s)`);
      }
    }
    arrasto = null;
    discoSelecionado = null;
  }
});

$reiniciar.addEventListener('click', () => {
  estado = estadoInicialFisica();
  fase = 'humano';
  lancesRestantes = 3;
  lancesIAFeitos = 0;
  movidosIA = [];
  movidosHumano = [];
  discoSelecionado = null;
  arrasto = null;
  esperandoFisica = false;
  pintaPlacar();
  avisa('Jogo novo: seu turno — 3 lances');
});

function loop() {
  if (esperandoFisica) rodaFisica();
  desenha();
  requestAnimationFrame(loop);
}

pintaPlacar();
avisa('Seu turno: 3 lances — clique num botão vermelho e arraste');
loop();

// hook de debug/E2E: expõe o estado do jogo para testes automatizados
window.__botao = {
  get estado() { return estado; },
  get fase() { return fase; },
  get lances() { return lancesRestantes; },
  get selecao() { return discoSelecionado ? { x: discoSelecionado.x, y: discoSelecionado.y } : null; },
  get arrasto() { return arrasto; },
  get esperando() { return esperandoFisica; },
};
