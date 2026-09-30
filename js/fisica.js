// Física do futebol de botão — discos, bola, atrito, colisões elásticas, paredes e gols.
// Campo 800x500 (px), gols: aberturas de 150px de altura nas laterais esquerda/direita.
// Disco: {x, y, vx, vy, r, time ('A'|'B'), goleiro?: boolean} | bola: {x, y, vx, vy, r} (time null).

export const LARGURA = 800;
export const ALTURA = 500;
export const GOL_ALTURA = 150;
export const GOL_Y0 = (ALTURA - GOL_ALTURA) / 2;
export const GOL_Y1 = (ALTURA + GOL_ALTURA) / 2;
export const ATRITO_DISCO = 0.975;
export const ATRITO_BOLA = 0.985;
export const ATRITO_GOLEIRO = 0.9; // goleiro para mais rápido (fica no eixo)
export const IMPULSO = 9;
export const PARADA = 0.08; // velocidade abaixo disso = parado

export function formação(time) {
  // 1 goleiro + 9 de linha (2-4-2-1). As linhas do meio EVITAM a linha do centro (y=250):
  // a bola começa em (400,250) e nenhum botão pode sanduíchá-la — senão todo chute ricocheteia na hora.
  const discos = [];
  const lado = time === 'A' ? 1 : -1; // A ataca para a direita (gol B); B para a esquerda (gol A)
  const base = time === 'A' ? 70 : LARGURA - 70;
  const cx = time === 'A' ? 90 : LARGURA - 90;

  discos.push({ x: cx, y: ALTURA / 2, vx: 0, vy: 0, r: 20, time, goleiro: true });

  const linhas = [
    { dx: 0, ys: [140, 360] },             // 2 zagueiros
    { dx: 150, ys: [90, 190, 310, 410] }, // 4 meio-campistas (fora da linha do centro)
    { dx: 300, ys: [160, 340] },          // 2 pontas (abertos)
    { dx: 430, ys: [250] },                // 1 centroavante (adiante da bola, não atrás)
  ];
  for (const linha of linhas) {
    for (const y of linha.ys) {
      discos.push({ x: base + linha.dx * lado, y, vx: 0, vy: 0, r: 18, time });
    }
  }
  return discos;
}

export function estadoInicialFisica() {
  return {
    discos: [...formação('A'), ...formação('B')],
    bola: { x: LARGURA / 2, y: ALTURA / 2, vx: 0, vy: 0, r: 9 },
    golA: 0, // gols do time A (bola entra na esquerda = gol do B)
    golB: 0,
  };
}

// aplica um toque: o disco desliza na direção do vetor (dx, dy) com o impulso
export function toque(disco, dx, dy, impulso = IMPULSO) {
  const len = Math.hypot(dx, dy) || 1;
  disco.vx = (dx / len) * impulso;
  disco.vy = (dy / len) * impulso;
}

// um passo da física (por frame): movimento + atrito + colisões + paredes/gols
// devolve {gol: 'A'|'B'|null} (o time que MARCOU)
export function passo(estado) {
  const { discos, bola } = estado;
  let gol = null;

  for (const d of discos) {
    d.x += d.vx; d.y += d.vy;
    const atrito = d.goleiro ? ATRITO_GOLEIRO : ATRITO_DISCO;
    d.vx *= atrito; d.vy *= atrito;
    if (Math.hypot(d.vx, d.vy) < PARADA) { d.vx = 0; d.vy = 0; }
    // paredes (o goleiro fica preso na área do gol)
    if (d.x - d.r < 0) { d.x = d.r; d.vx = Math.abs(d.vx) * 0.5; }
    if (d.x + d.r > LARGURA) { d.x = LARGURA - d.r; d.vx = -Math.abs(d.vx) * 0.5; }
    if (d.y - d.r < 0) { d.y = d.r; d.vy = Math.abs(d.vy) * 0.5; }
    if (d.y + d.r > ALTURA) { d.y = ALTURA - d.r; d.vy = -Math.abs(d.vy) * 0.5; }
  }

  bola.x += bola.vx; bola.y += bola.vy;
  bola.vx *= ATRITO_BOLA; bola.vy *= ATRITO_BOLA;
  if (Math.hypot(bola.vx, bola.vy) < PARADA) { bola.vx = 0; bola.vy = 0; }

  // GOL: bola cruza a linha dentro da abertura
  if (bola.x + bola.r < 0 && bola.y > GOL_Y0 && bola.y < GOL_Y1) {
    gol = 'B'; // entrou na esquerda → gol do B
  }
  if (bola.x - bola.r > LARGURA && bola.y > GOL_Y0 && bola.y < GOL_Y1) {
    gol = 'A'; // entrou na direita → gol do A
  }
  if (!gol) {
    // paredes: dentro da abertura do gol, a bola entra; fora, rebate
    if (bola.x - bola.r < 0) {
      if (bola.y > GOL_Y0 && bola.y < GOL_Y1) { /* entra no gol (a bola continua até x + r < 0) */ }
      else { bola.x = bola.r; bola.vx = Math.abs(bola.vx) * 0.6; }
    }
    if (bola.x - bola.r > LARGURA) {
      if (bola.y > GOL_Y0 && bola.y < GOL_Y1) { /* idem direita */ }
      else { bola.x = LARGURA - bola.r; bola.vx = -Math.abs(bola.vx) * 0.6; }
    }
    if (bola.y - bola.r < 0) { bola.y = bola.r; bola.vy = Math.abs(bola.vy) * 0.6; }
    if (bola.y + bola.r > ALTURA) { bola.y = ALTURA - bola.r; bola.vy = -Math.abs(bola.vy) * 0.6; }
  }

  // colisões disco-disco (elástica, massas iguais)
  for (let i = 0; i < discos.length; i++) {
    for (let j = i + 1; j < discos.length; j++) {
      const a = discos[i], b = discos[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (dist > 0 && dist < min) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = min - dist;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        // troca as componentes da velocidade na normal
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        const da = vb - va;
        a.vx += da * nx; a.vy += da * ny;
        b.vx -= da * nx; b.vy -= da * ny;
      }
    }
  }

  // colisões disco-bola ELÁSTICAS (restituição e=0.8): a bola quica nos botões.
  // Modelo: bola leve vs botão pesado → vBola' = (1+e)·vDisco − e·vBola (na normal).
  //   botão chuta a bola: ela sai a 1.8× a velocidade do botão ✔
  //   bola bate num botão parado: ela RICA de volta a 80% ✔ (antes: morria na frente — o bug!)
  for (const d of discos) {
    const dx = bola.x - d.x, dy = bola.y - d.y;
    const dist = Math.hypot(dx, dy);
    const min = d.r + bola.r;
    if (dist > 0 && dist < min) {
      const nx = dx / dist, ny = dy / dist;
      const overlap = min - dist;
      bola.x += nx * overlap; bola.y += ny * overlap;
      const vDisco = d.vx * nx + d.vy * ny;
      const vBola = bola.vx * nx + bola.vy * ny;
      if (vBola - vDisco < 0) { // só se ainda estão se aproximando
        const e = 0.8;
        const novoVBola = (1 + e) * vDisco - e * vBola;
        const delta = novoVBola - vBola;
        bola.vx += delta * nx; bola.vy += delta * ny;
        d.vx *= 0.35; d.vy *= 0.35; // o botão pesado quase não sente o impacto
      }
    }
  }

  if (gol) {
    if (gol === 'A') estado.golA++; else estado.golB++;
  }
  return { gol };
}

// a física parou? (todos os discos e a bola parados)
export function parado(estado) {
  const { discos, bola } = estado;
  return discos.every(d => d.vx === 0 && d.vy === 0) && bola.vx === 0 && bola.vy === 0;
}

// recoloca a bola no centro (após o gol)
export function reposicionaBola(estado) {
  estado.bola.x = LARGURA / 2;
  estado.bola.y = ALTURA / 2;
  estado.bola.vx = 0;
  estado.bola.vy = 0;
}
