/**
 * Wave balance: day/night rhythm, counts, climbers, heal tiers, difficulty coef.
 *
 * Rhythm blocks (cycle): 2D+1N → 2D+2N → 3D+2N → …
 * Score: D = Z*(1+0.35*N) + C*1.8 - H*0.45  (then × difficulty coef for spawn scaling)
 */

export const DIFFICULTIES = [
  { id: 'peace', label: 'Peace', coef: 0, noMobs: true },
  { id: 'low', label: 'Low', coef: 0.7 },
  { id: 'med', label: 'Med', coef: 1.0 },
  { id: 'high', label: 'High', coef: 1.35 },
  { id: 'hell', label: 'Hell', coef: 1.75 },
]

const BLOCKS = [
  { day: 2, night: 1 },
  { day: 2, night: 2 },
  { day: 3, night: 2 },
]

/** Heal bottle tiers by night-block index (0-based). */
export const HEAL_TIERS = [
  { id: 'green', hearts: 3, color: 0x66bb6a, emissive: 0x00e676, light: 0x69f0ae },
  { id: 'teal', hearts: 4, color: 0x26a69a, emissive: 0x1de9b6, light: 0x64ffda },
  { id: 'blue', hearts: 5, color: 0x42a5f5, emissive: 0x448aff, light: 0x82b1ff },
  { id: 'gold', hearts: 7, color: 0xffb300, emissive: 0xffd54f, light: 0xffe082 },
]

const STORAGE_KEY = 'dacha-difficulty'

let currentId = 'med'

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (DIFFICULTIES.some((d) => d.id === saved)) currentId = saved
} catch {
  /* ignore */
}

export function getDifficultyId() {
  return currentId
}

export function getDifficulty() {
  return DIFFICULTIES.find((d) => d.id === currentId) || DIFFICULTIES.find((d) => d.id === 'med')
}

export function isPeaceMode() {
  return !!getDifficulty().noMobs
}

export function setDifficulty(id) {
  if (!DIFFICULTIES.some((d) => d.id === id)) return getDifficulty()
  currentId = id
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  return getDifficulty()
}

export function getCoef() {
  return getDifficulty().coef
}

/** Locate which day/night segment wave `w` sits in. */
function locateWave(w) {
  let i = 1
  let bi = 0
  let nightBlock = -1
  while (true) {
    const b = BLOCKS[bi % BLOCKS.length]
    const dayStart = i
    const dayEnd = i + b.day - 1
    const nightStart = dayEnd + 1
    const nightEnd = dayEnd + b.night
    if (w >= dayStart && w <= dayEnd) {
      return { night: false, nightBlock, blockIndex: bi, nightStart, nightEnd }
    }
    if (w >= nightStart && w <= nightEnd) {
      nightBlock++
      return {
        night: true,
        nightBlock,
        blockIndex: bi,
        nightStart,
        nightEnd,
        nightWaveIndex: w - nightStart,
      }
    }
    // count this block's night for index tracking when skipping past
    nightBlock++
    i = nightEnd + 1
    bi++
    if (bi > 200) return { night: false, nightBlock: 0, blockIndex: 0 }
  }
}

export function isNightWave(wave) {
  return locateWave(Math.max(1, wave | 0)).night
}

export function isNightBlockStart(wave) {
  const w = Math.max(1, wave | 0)
  return isNightWave(w) && (w === 1 || !isNightWave(w - 1))
}

export function getNightBlockIndex(wave) {
  const loc = locateWave(Math.max(1, wave | 0))
  return Math.max(0, loc.nightBlock)
}

export function getHealTierForWave(wave) {
  if (!isNightBlockStart(wave)) return null
  const bi = getNightBlockIndex(wave)
  if (bi >= 3 && bi % 3 === 2) return HEAL_TIERS[3] // gold every 3rd late night
  return HEAL_TIERS[Math.min(2, bi)]
}

function clampInt(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/**
 * Full plan for a wave at current (or given) difficulty coef.
 * @returns {{
 *   wave: number, night: boolean, zombies: number, climbers: number,
 *   zombieHp: number, heal: null|{hearts:number,id:string,color:number,emissive:number,light:number},
 *   score: number, coef: number
 * }}
 */
export function getWavePlan(wave, coef = getCoef()) {
  const w = Math.max(1, wave | 0)
  const night = isNightWave(w)
  const k = coef

  if (isPeaceMode() || k <= 0) {
    return {
      wave: w,
      night,
      zombies: 0,
      climbers: 0,
      zombieHp: 0,
      heal: getHealTierForWave(w),
      score: 0,
      coef: 0,
    }
  }

  let zombies
  let climbers
  if (night) {
    zombies = clampInt((3 + Math.floor(0.7 * w)) * k, 3, 40)
    const rate = 0.18 + 0.02 * w
    climbers = clampInt(zombies * rate * Math.min(1.25, k), 1, Math.min(5, zombies))
  } else {
    zombies = clampInt((4 + Math.floor(1.4 * w)) * k, 4, 48)
    climbers = clampInt(Math.floor((w - 1) / 5) * (k >= 1.3 ? 1.2 : 1), 0, 3)
    climbers = Math.min(climbers, Math.floor(zombies * 0.25))
  }

  const zombieHp = clampInt(2 + Math.floor(w / 6) + (k >= 1.5 ? 1 : 0), 2, 6)
  const heal = getHealTierForWave(w)
  // on harder modes, slightly less heal
  let healOut = heal
  if (heal && k >= 1.5) {
    healOut = { ...heal, hearts: Math.max(2, heal.hearts - 1) }
  } else if (heal && k <= 0.75) {
    healOut = { ...heal, hearts: heal.hearts + 1 }
  }

  const H = healOut?.hearts ?? 0
  const N = night ? 1 : 0
  const score =
    Math.round((zombies * (1 + 0.35 * N) + climbers * 1.8 - H * 0.45) * 10) / 10

  return {
    wave: w,
    night,
    zombies,
    climbers,
    zombieHp,
    heal: healOut,
    score,
    coef: k,
  }
}

export function difficultyScore(wave, coef = getCoef()) {
  return getWavePlan(wave, coef).score
}
