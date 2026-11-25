/** Simple AABB blockers: yards + houses. See NAMING.md */

export const PLOT_W = 18
/** Total depth; with PLOT_Z0, front gate stays ~+16 and extra length is at the back. */
export const PLOT_D = 36
/** Plot center Z — negative so growth goes behind the house, not past the gate. */
export const PLOT_Z0 = -2
export const GATE_HALF = 1.8

/** Ділянка Олександри — 30% narrower than mine. */
export const SIDE_PLOT_W = PLOT_W * 0.7
export const sideLeftX = () => PLOT_W / 2
export const sideRightX = () => PLOT_W / 2 + SIDE_PLOT_W
export const sideCenterX = () => PLOT_W / 2 + SIDE_PLOT_W / 2

/**
 * Wider strip beyond Oleksandra, split front/back:
 * zombie (street, smaller) + father (back, larger).
 */
export const SPLIT_PLOT_W = SIDE_PLOT_W * 1.35
export const splitLeftX = () => sideRightX()
export const splitRightX = () => sideRightX() + SPLIT_PLOT_W
export const splitCenterX = () => sideRightX() + SPLIT_PLOT_W / 2

/** Zombie depth fraction of full plot depth (closer to street = smaller). */
export const ZOMBIE_DEPTH_RATIO = 0.38
export const zombieFrontZ = () => plotFrontZ()
export const zombieBackZ = () => plotFrontZ() - PLOT_D * ZOMBIE_DEPTH_RATIO
export const zombieCenterZ = () => (zombieFrontZ() + zombieBackZ()) / 2
export const zombieDepth = () => PLOT_D * ZOMBIE_DEPTH_RATIO

export const fatherFrontZ = () => zombieBackZ()
export const fatherBackZ = () => plotBackZ()
export const fatherCenterZ = () => (fatherFrontZ() + fatherBackZ()) / 2
export const fatherDepth = () => fatherFrontZ() - fatherBackZ()

/** Ділянка Тєрєнтьєва — past Oleksandra + father/zombie (`FAR_*` ids). */
export const FAR_PLOT_W = SIDE_PLOT_W * 1.1
export const farLeftX = () => splitRightX()
export const farRightX = () => splitRightX() + FAR_PLOT_W
export const farCenterX = () => splitRightX() + FAR_PLOT_W / 2
export const terentyevLeftX = farLeftX
export const terentyevRightX = farRightX
export const terentyevCenterX = farCenterX

/** Rightmost fence edge of all yards. */
export const yardsRightX = () => farRightX()

/** Shared walkway gaps between adjacent yards (on common fences). */
export const SIDE_GAP_HALF = 1.6
/** Two fence sections (2 × 2.2) toward plot fronts from former −5. */
export const SIDE_GAP_Z = -0.6

/** Zombie yard fence is sealed (no gates/gaps); taller board wall in world.js. */
export const ZOMBIE_FENCE_SCALE = 1.3

export const HOUSE = {
  x: 0,
  z: -5,
  halfW: 3.85 * 1.1,
  halfD: 3.0 * 1.1,
}

/** Будиночок Олександри — middle-back of her plot. */
export const SIDE_HOUSE = {
  x: PLOT_W / 2 + SIDE_PLOT_W / 2,
  z: PLOT_Z0 - 3,
  halfW: 1.35,
  halfD: 1.25,
}

/** Мій будинок length (X) — father house is 1.5× this along the shared fence. */
const MY_HOUSE_LEN = 7.2 * 1.1
const FATHER_LEN = MY_HOUSE_LEN * 1.5
const FATHER_WID = 4.4
const FATHER_DOOR_FROM_END = 1.1

/** Будинок батька — along fence with Oleksandra; shifted back from zombie yard. */
export const FATHER_HOUSE = {
  x: PLOT_W / 2 + SIDE_PLOT_W + FATHER_WID / 2 + 0.55,
  /** ~5m farther from zombie (+Z) than the gap-aligned placement. */
  z: SIDE_GAP_Z - (FATHER_LEN / 2 - FATHER_DOOR_FROM_END) - 5,
  halfW: FATHER_WID / 2,
  halfD: FATHER_LEN / 2,
  /** Local Z of door on +X wall (into father plot, opposite Oleksandra). */
  doorLocalZ: FATHER_LEN / 2 - FATHER_DOOR_FROM_END,
}

/** Будинок Тєрєнтьєва — street side of his plot. */
export const TERENTYEV_HOUSE = {
  x: PLOT_W / 2 + SIDE_PLOT_W + SPLIT_PLOT_W + FAR_PLOT_W / 2,
  z: PLOT_Z0 + PLOT_D / 2 - 4.2,
  halfW: 2.9,
  halfD: 2.35,
}

/** Vegetable bed centers on Тєрєнтьєв plot (world XZ) — blues water these at night. */
export const TERENTYEV_BEDS = (() => {
  const hx = TERENTYEV_HOUSE.x
  const hz = TERENTYEV_HOUSE.z - TERENTYEV_HOUSE.halfD - 3.2
  return [
    { x: hx - 1.6, z: hz - 2.2 },
    { x: hx + 1.5, z: hz - 2.2 },
    { x: hx - 1.6, z: hz + 0.1 },
    { x: hx + 1.5, z: hz + 0.1 },
    { x: hx - 0.1, z: hz + 2.4 },
  ]
})()

export const plotFrontZ = () => PLOT_Z0 + PLOT_D / 2
export const plotBackZ = () => PLOT_Z0 - PLOT_D / 2

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

function inRect(x, z, x0, x1, z0, z1, margin = 0) {
  return (
    x >= x0 + margin &&
    x <= x1 - margin &&
    z >= z0 + margin &&
    z <= z1 - margin
  )
}

export function insidePlot(x, z, margin = 0) {
  return (
    Math.abs(x) <= PLOT_W / 2 - margin &&
    Math.abs(z - PLOT_Z0) <= PLOT_D / 2 - margin
  )
}

export function insideSidePlot(x, z, margin = 0) {
  return inRect(x, z, sideLeftX(), sideRightX(), plotBackZ(), plotFrontZ(), margin)
}

export function insideZombiePlot(x, z, margin = 0) {
  return inRect(x, z, splitLeftX(), splitRightX(), zombieBackZ(), zombieFrontZ(), margin)
}

export function insideFatherPlot(x, z, margin = 0) {
  return inRect(x, z, splitLeftX(), splitRightX(), fatherBackZ(), fatherFrontZ(), margin)
}

export function insideFarPlot(x, z, margin = 0) {
  return inRect(x, z, farLeftX(), farRightX(), plotBackZ(), plotFrontZ(), margin)
}

export function insideAnyYard(x, z, margin = 0) {
  return (
    insidePlot(x, z, margin) ||
    insideSidePlot(x, z, margin) ||
    insideZombiePlot(x, z, margin) ||
    insideFatherPlot(x, z, margin) ||
    insideFarPlot(x, z, margin)
  )
}

function inNeighborGap(z, radius = 0) {
  return Math.abs(z - SIDE_GAP_Z) <= SIDE_GAP_HALF - radius
}

function pushHouses(x, z, radius) {
  let p = pushOutAABB(x, z, HOUSE, radius)
  p = pushOutAABB(p.x, p.z, SIDE_HOUSE, radius)
  p = pushOutAABB(p.x, p.z, FATHER_HOUSE, radius)
  return pushOutAABB(p.x, p.z, TERENTYEV_HOUSE, radius)
}

function clampYard(x, z, radius, x0, x1, z0, z1, opts = {}) {
  const {
    gateX = null,
    leftGapTo = null,
    rightGapTo = null,
  } = opts
  let nx = x
  let nz = z
  const xMin = x0 + radius
  const xMax = x1 - radius
  const zMin = z0 + radius
  const zMax = z1 - radius

  if (nx < xMin) {
    const allow =
      leftGapTo != null &&
      inNeighborGap(nz, radius) &&
      nx >= leftGapTo + radius
    if (!allow) nx = xMin
  }
  if (nx > xMax) {
    const allow =
      rightGapTo != null &&
      inNeighborGap(nz, radius) &&
      nx <= rightGapTo - radius
    if (!allow) nx = xMax
  }
  if (nz < zMin) nz = zMin
  if (nz > zMax) {
    if (gateX != null && Math.abs(nx - gateX) <= GATE_HALF - radius) {
      // street gate
    } else {
      nz = zMax
    }
  }

  return pushHouses(nx, nz, radius)
}

/** Player: all yards, houses solid, street gates + neighbor gaps. */
export function resolveWorldXZ(x, z, radius = 0.4) {
  const soft = -radius * 0.5
  const my = insidePlot(x, z, soft)
  const olek = insideSidePlot(x, z, soft)
  const zom = insideZombiePlot(x, z, soft)
  const fat = insideFatherPlot(x, z, soft)
  const far = insideFarPlot(x, z, soft)

  if (my) {
    return clampYard(x, z, radius, -PLOT_W / 2, PLOT_W / 2, plotBackZ(), plotFrontZ(), {
      gateX: 0,
      rightGapTo: sideRightX(),
    })
  }
  if (olek) {
    return clampYard(x, z, radius, sideLeftX(), sideRightX(), plotBackZ(), plotFrontZ(), {
      gateX: sideCenterX(),
      leftGapTo: -PLOT_W / 2,
      // gap only reaches father strip (SIDE_GAP_Z), not sealed zombie yard
      rightGapTo: splitRightX(),
    })
  }
  // Player never walks the sealed zombie yard — treat as solid block
  if (zom) {
    return pushOutAABB(x, z, zombieBlock(), radius)
  }
  if (fat) {
    return clampYard(x, z, radius, splitLeftX(), splitRightX(), fatherBackZ(), fatherFrontZ(), {
      leftGapTo: sideLeftX(),
      rightGapTo: farRightX(),
      // no frontGap into zombie — sealed
    })
  }
  if (far) {
    return clampYard(x, z, radius, farLeftX(), farRightX(), plotBackZ(), plotFrontZ(), {
      gateX: farCenterX(),
      leftGapTo: splitLeftX(),
    })
  }

  // Outside — pull into nearest walkable yard (skip sealed zombie)
  if (x < sideLeftX()) {
    return clampYard(x, z, radius, -PLOT_W / 2, PLOT_W / 2, plotBackZ(), plotFrontZ(), {
      gateX: 0,
      rightGapTo: sideRightX(),
    })
  }
  if (x < splitLeftX()) {
    return clampYard(x, z, radius, sideLeftX(), sideRightX(), plotBackZ(), plotFrontZ(), {
      gateX: sideCenterX(),
      leftGapTo: -PLOT_W / 2,
      rightGapTo: splitRightX(),
    })
  }
  if (x < farLeftX()) {
    // Prefer father; bounce off zombie block if in that Z band
    if (z >= zombieBackZ()) {
      return pushOutAABB(x, z, zombieBlock(), radius)
    }
    return clampYard(x, z, radius, splitLeftX(), splitRightX(), fatherBackZ(), fatherFrontZ(), {
      leftGapTo: sideLeftX(),
      rightGapTo: farRightX(),
    })
  }
  return clampYard(x, z, radius, farLeftX(), farRightX(), plotBackZ(), plotFrontZ(), {
    gateX: farCenterX(),
    leftGapTo: splitLeftX(),
  })
}

function zombieBlock() {
  return {
    x: splitCenterX(),
    z: zombieCenterZ(),
    halfW: SPLIT_PLOT_W / 2,
    halfD: zombieDepth() / 2,
  }
}

/** Keep climbers inside the sealed zombie paddock until they climb out. */
export function clampInsideZombiePlot(x, z, radius = 0.5) {
  const xMin = splitLeftX() + radius
  const xMax = splitRightX() - radius
  const zMin = zombieBackZ() + radius
  const zMax = zombieFrontZ() - radius
  return {
    x: Math.max(xMin, Math.min(xMax, x)),
    z: Math.max(zMin, Math.min(zMax, z)),
  }
}

/** Keep Тєрєнтьєв ambient zombies on their plot (outside his house). */
export function clampInsideFarPlot(x, z, radius = 0.5) {
  const xMin = farLeftX() + radius
  const xMax = farRightX() - radius
  const zMin = plotBackZ() + radius
  const zMax = plotFrontZ() - radius
  const clamped = {
    x: Math.max(xMin, Math.min(xMax, x)),
    z: Math.max(zMin, Math.min(zMax, z)),
  }
  return pushOutAABB(clamped.x, clamped.z, TERENTYEV_HOUSE, radius)
}

export function randomFarPlotSpawn(margin = 2) {
  const x0 = farLeftX() + margin
  const x1 = farRightX() - margin
  const z0 = plotBackZ() + margin
  const z1 = plotFrontZ() - margin
  for (let i = 0; i < 12; i++) {
    const p = {
      x: x0 + Math.random() * Math.max(0.2, x1 - x0),
      z: z0 + Math.random() * Math.max(0.2, z1 - z0),
    }
    const out = pushOutAABB(p.x, p.z, TERENTYEV_HOUSE, 1.2)
    if (out.x === p.x && out.z === p.z) return p
  }
  // fallback: behind the house
  return {
    x: TERENTYEV_HOUSE.x,
    z: TERENTYEV_HOUSE.z - TERENTYEV_HOUSE.halfD - 2.5,
  }
}

/** Spawn point inside ділянка зомбі for climbers. */
export function randomZombiePlotSpawn(margin = 1.4) {
  const x0 = splitLeftX() + margin
  const x1 = splitRightX() - margin
  const z0 = zombieBackZ() + margin
  const z1 = zombieFrontZ() - margin
  return {
    x: x0 + Math.random() * Math.max(0.2, x1 - x0),
    z: z0 + Math.random() * Math.max(0.2, z1 - z0),
  }
}

function pushOutsidePlot(x, z, radius) {
  const hw = PLOT_W / 2 + radius
  const zMin = plotBackZ() - radius
  const zMax = plotFrontZ() + radius
  const back = plotBackZ()
  const front = plotFrontZ()
  if (
    Math.abs(x) >= PLOT_W / 2 + radius * 0.5 ||
    z <= back - radius * 0.5 ||
    z >= front + radius * 0.5
  ) {
    return { x, z }
  }
  const distLeft = x + PLOT_W / 2
  const distRight = PLOT_W / 2 - x
  const distBack = z - back
  const distFront = front - z
  const m = Math.min(distLeft, distRight, distBack, distFront)
  if (m === distLeft) return { x: -hw, z }
  if (m === distRight) return { x: hw, z }
  if (m === distBack) return { x, z: zMin }
  return { x, z: zMax }
}

/**
 * Zombies: houses always solid.
 * Non-climbers blocked by my fence EXCEPT front gate (|x| < GATE_HALF).
 * Climbers / already inside: fence ignored.
 */
export function resolveZombieXZ(x, z, radius = 0.5, { canEnter = false } = {}) {
  let p = { x, z }
  if (!canEnter) {
    const inGate = Math.abs(x) <= GATE_HALF - radius * 0.35
    if (insidePlot(x, z, 0) && !inGate) {
      p = pushOutsidePlot(x, z, radius)
    }
  }
  return pushHouses(p.x, p.z, radius)
}

/** Random point outside the fence for spawns */
export function randomOutsideSpawn(minPad = 2.5, maxPad = 10) {
  const pad = minPad + Math.random() * (maxPad - minPad)
  const side = Math.floor(Math.random() * 4)
  const left = -PLOT_W / 2 - pad
  const right = yardsRightX() + pad
  const zMin = plotBackZ() - pad
  const zMax = plotFrontZ() + pad
  const zSpan = PLOT_D / 2 + pad * 0.5
  if (side === 0) return { x: left, z: PLOT_Z0 + (Math.random() * 2 - 1) * zSpan }
  if (side === 1) return { x: right, z: PLOT_Z0 + (Math.random() * 2 - 1) * zSpan }
  if (side === 2) {
    return {
      x: left + Math.random() * (right - left),
      z: zMin,
    }
  }
  return {
    x: left + Math.random() * (right - left),
    z: zMax,
  }
}
