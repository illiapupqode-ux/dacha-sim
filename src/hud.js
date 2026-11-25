/** Pixel-art HUD pips (hearts / cartridges) via crisp SVG. */

const HEART = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000',
]

/**
 * Vertical rifle cartridge (tip up → rim down).
 * T = tip/brass, B = body, R = rim
 */
const CARTRIDGE = [
  '.TT.',
  'TTTT',
  'TTTT',
  'BBBB',
  'BBBB',
  'BBBB',
  'BBBB',
  '.RR.',
]

const HEART_ON = '#e53935'
const HEART_OFF = '#757575'
const CART = {
  T: { on: '#d4a017', off: '#a3a3a3' },
  B: { on: '#6b3f24', off: '#737373' },
  R: { on: '#4a2c17', off: '#525252' },
}

function svgFromMono(grid, fill, className) {
  const h = grid.length
  const w = grid[0].length
  let rects = ''
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== '1') continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  }
  return `<svg class="${className}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`
}

function svgCartridge(filled) {
  const h = CARTRIDGE.length
  const w = CARTRIDGE[0].length
  let rects = ''
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = CARTRIDGE[y][x]
      const pal = CART[ch]
      if (!pal) continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${filled ? pal.on : pal.off}"/>`
    }
  }
  return `<svg class="pip pip-bullet" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`
}

export function renderHearts(el, current, max) {
  if (!el) return
  const cur = Math.max(0, Math.min(max, current | 0))
  let html = ''
  for (let i = 0; i < max; i++) {
    html += svgFromMono(HEART, i < cur ? HEART_ON : HEART_OFF, 'pip pip-heart')
  }
  el.innerHTML = html
}

export function renderBullets(el, current, max) {
  if (!el) return
  const cur = Math.max(0, Math.min(max, current | 0))
  let html = ''
  for (let i = 0; i < max; i++) {
    html += svgCartridge(i < cur)
  }
  el.innerHTML = html
}
