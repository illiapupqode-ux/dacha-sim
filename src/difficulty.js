/**
 * Wave balance: day/night rhythm, counts, climbers, heal tiers, difficulty coef.
 *
 * Rhythm blocks (cycle): 2D+1N → 2D+2N → 3D+2N → …
 * Score: D = Z*(1+0.35*N) + C*1.8 - H*0.45  (then × difficulty coef for spawn scaling)
 */

/**
 * Low is the old Hell (1.75). Higher steps sit above that baseline.
 * surge: once every `every` seconds, run `percent`% faster for `duration` seconds.
 * Peace and Low do not surge.
 */
export const DIFFICULTIES = [
  { id: 'peace', label: 'Peace', coef: 0, noMobs: true },
  { id: 'low', label: 'Low', coef: 1.75 },
  { id: 'med', label: 'Med', coef: 2.25, surge: { every: 7, duration: 1.4, percent: 40 } },
  { id: 'high', label: 'High', coef: 2.85, surge: { every: 5.5, duration: 1.7, percent: 60 } },
  { id: 'hell', label: 'Hell', coef: 3.5, surge: { every: 4, duration: 2, percent: 80 } },
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

/** Speed burst for this coef. Null on Peace and Low. */
export function getSurge(coef = getCoef()) {
  if (!(coef > 0)) return null
  let best = null
  for (const d of DIFFICULTIES) {
    if (!d.surge || d.coef > coef + 1e-9) continue
    if (!best || d.coef > best.coef) best = d
  }
  return best ? best.surge : null
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
 *   surge: null|{every:number,duration:number,percent:number},
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
      surge: null,
      score: 0,
      coef: 0,
    }
  }

  // Spawn counts grow with difficulty. HP stays inside one magazine (see killsPerMagazine).
  const nightCap = clampInt(40 * (k / 1.75), 40, 72)
  const dayCap = clampInt(48 * (k / 1.75), 48, 90)
  const climberMul = Math.min(1.25, k) + Math.max(0, (k - 1.75) * 0.35)
  const nightClimberMax = k >= 3.2 ? 8 : k >= 2.6 ? 7 : k >= 2.1 ? 6 : 5

  let zombies
  let climbers
  if (night) {
    zombies = clampInt((3 + Math.floor(0.7 * w)) * k, 3, nightCap)
    const rate = 0.18 + 0.02 * w
    climbers = clampInt(zombies * rate * climberMul, 1, Math.min(nightClimberMax, zombies))
  } else {
    const dayMul = k >= 3.2 ? 2 : k >= 2.6 ? 1.6 : k >= 2.1 ? 1.4 : k >= 1.3 ? 1.2 : 1
    const dayCapClimbers = k >= 3.2 ? 6 : k >= 2.6 ? 5 : k >= 2.1 ? 4 : 3
    zombies = clampInt((4 + Math.floor(1.4 * w)) * k, 4, dayCap)
    climbers = clampInt(Math.floor((w - 1) / 5) * dayMul, 0, dayCapClimbers)
    climbers = Math.min(climbers, Math.floor(zombies * 0.25))
  }

  // Low matches old Hell (3, then 4). High/Hell start at 4. Never past 4:
  // 5+ shots cannot earn the next mag from a 12-round magazine.
  const hpBonus = k >= 2.6 ? 2 : k >= 1.5 ? 1 : 0
  const zombieHp = clampInt(2 + Math.floor(w / 6) + hpBonus, 2, 4)
  const heal = getHealTierForWave(w)
  let healOut = heal
  if (heal && k >= 3.2) {
    healOut = { ...heal, hearts: Math.max(1, heal.hearts - 3) }
  } else if (heal && k >= 2.6) {
    healOut = { ...heal, hearts: Math.max(1, heal.hearts - 2) }
  } else if (heal && k >= 2.1) {
    healOut = { ...heal, hearts: Math.max(2, heal.hearts - 2) }
  } else if (heal && k >= 1.5) {
    healOut = { ...heal, hearts: Math.max(2, heal.hearts - 1) }
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
    surge: getSurge(k),
    score,
    coef: k,
  }
}

export function difficultyScore(wave, coef = getCoef()) {
  return getWavePlan(wave, coef).score
}

/**
 * Kills that earn one magazine.
 * Those kills must fit in a full mag and leave at least 3 rounds.
 */
export function killsPerMagazine(zombieHp, magSize = 12) {
  const hp = Math.max(1, zombieHp | 0)
  const budget = Math.max(hp, magSize - 3)
  return Math.max(1, Math.min(3, Math.floor(budget / hp)))
}
