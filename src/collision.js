/** Simple AABB blockers: fence plot + house. */

export const PLOT_W = 20
export const PLOT_D = 32
export const GATE_HALF = 1.8

export const HOUSE = {
  x: 0,
  z: -5,
  halfW: 3.85,
  halfD: 3.0,
}

function pushOutAABB(x, z, b, pad = 0) {
  const left = b.x - b.halfW - pad
  const right = b.x + b.halfW + pad
  const back = b.z - b.halfD - pad
  const front = b.z + b.halfD + pad
  if (x <= left || x >= right || z <= back || z >= front) return { x, z }

  const dl = x - left
  const dr = right - x
  const db = z - back
  const df = front - z
  const m = Math.min(dl, dr, db, df)
  if (m === dl) return { x: left, z }
  if (m === dr) return { x: right, z }
  if (m === db) return { x, z: back }
  return { x, z: front }
}

export function insidePlot(x, z, margin = 0) {
  return Math.abs(x) <= PLOT_W / 2 - margin && Math.abs(z) <= PLOT_D / 2 - margin
}

/** Player: stay inside fence, outside house. Gate on +Z. */
export function resolveWorldXZ(x, z, radius = 0.4) {
  const hw = PLOT_W / 2 - radius
  const hd = PLOT_D / 2 - radius

  if (x < -hw) x = -hw
  if (x > hw) x = hw
  if (z < -hd) z = -hd
  if (z > hd) {
    if (Math.abs(x) > GATE_HALF - radius) z = hd
  }

  return pushOutAABB(x, z, HOUSE, radius)
}

function pushOutsidePlot(x, z, radius) {
  const hw = PLOT_W / 2 + radius
  const hd = PLOT_D / 2 + radius
  if (Math.abs(x) >= PLOT_W / 2 + radius * 0.5 || Math.abs(z) >= PLOT_D / 2 + radius * 0.5) {
    return { x, z }
  }
  const distLeft = x + PLOT_W / 2
  const distRight = PLOT_W / 2 - x
  const distBack = z + PLOT_D / 2
  const distFront = PLOT_D / 2 - z
  const m = Math.min(distLeft, distRight, distBack, distFront)
  if (m === distLeft) return { x: -hw, z }
  if (m === distRight) return { x: hw, z }
  if (m === distBack) return { x, z: -hd }
  return { x, z: hd }
}

/**
 * Zombies: house always solid.
 * Non-climbers blocked by fence EXCEPT front gate (|x| < GATE_HALF).
 * Climbers / already inside: fence ignored.
 */
export function resolveZombieXZ(x, z, radius = 0.5, { canEnter = false } = {}) {
  let p = { x, z }
  if (!canEnter) {
    const inGate = Math.abs(x) <= GATE_HALF - radius * 0.35
    // may enter/stay only through front gate strip; otherwise stay outside
    if (insidePlot(x, z, 0) && !inGate) {
      p = pushOutsidePlot(x, z, radius)
    }
  }
  return pushOutAABB(p.x, p.z, HOUSE, radius)
}

/** Random point outside the fence for spawns */
export function randomOutsideSpawn(minPad = 2.5, maxPad = 10) {
  const pad = minPad + Math.random() * (maxPad - minPad)
  const side = Math.floor(Math.random() * 4)
  const hw = PLOT_W / 2 + pad
  const hd = PLOT_D / 2 + pad
  if (side === 0) return { x: -hw, z: (Math.random() * 2 - 1) * (PLOT_D / 2 + pad * 0.5) }
  if (side === 1) return { x: hw, z: (Math.random() * 2 - 1) * (PLOT_D / 2 + pad * 0.5) }
  if (side === 2) return { x: (Math.random() * 2 - 1) * (PLOT_W / 2 + pad * 0.5), z: -hd }
  return { x: (Math.random() * 2 - 1) * (PLOT_W / 2 + pad * 0.5), z: hd }
}
