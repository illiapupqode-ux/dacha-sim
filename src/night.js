import * as THREE from 'three'

/** Waves that are night. */
export const NIGHT_WAVES = new Set([3, 6, 7, 9, 10, 11, 12])

export function isNightWave(wave) {
  return NIGHT_WAVES.has(wave)
}

const DAY_BG = new THREE.Color(0x87aec8)
const NIGHT_BG = new THREE.Color(0x141c2a)
const DAY_FOG = new THREE.Color(0x87aec8)
const NIGHT_FOG = new THREE.Color(0x141c2a)
const DAY_AMB = new THREE.Color(0xc8d6c0)
const NIGHT_AMB = new THREE.Color(0x4a5568)
const DAY_SUN = new THREE.Color(0xfff2d6)
const NIGHT_SUN = new THREE.Color(0x7a8aaa)

/**
 * Smooth day↔night fade by wave schedule.
 * Window SpotLights cast outdoor silhouettes at night.
 */
export function createNightCycle({
  scene,
  ambient,
  sun,
  windowMats,
  windowLights = [],
  getWave,
  startAtNight = false,
}) {
  let night = startAtNight ? 1 : 0
  const tmp = new THREE.Color()

  const apply = (n) => {
    scene.background.copy(DAY_BG).lerp(NIGHT_BG, n)
    if (scene.fog) {
      scene.fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, n)
      scene.fog.near = 22 - n * 4
      scene.fog.far = 55 - n * 8
    }
    ambient.color.copy(DAY_AMB).lerp(NIGHT_AMB, n)
    ambient.intensity = 0.55 - n * 0.18
    sun.color.copy(DAY_SUN).lerp(NIGHT_SUN, n)
    sun.intensity = 1.05 - n * 0.55

    for (const m of windowMats) {
      m.emissiveIntensity = n * 1.5
      tmp.setHex(0x9eb8c8).lerp(new THREE.Color(0xffe082), n)
      m.color.copy(tmp)
    }
    for (const L of windowLights) {
      L.intensity = n * 4.5
      L.visible = n > 0.02
    }
  }

  apply(night)

  return {
    update(dt) {
      const target = isNightWave(getWave()) ? 1 : 0
      const fadeSec = 11
      if (night < target) night = Math.min(target, night + dt / fadeSec)
      else if (night > target) night = Math.max(target, night - dt / fadeSec)
      apply(night)
      return night
    },
    reset() {
      night = startAtNight || isNightWave(getWave()) ? (startAtNight ? 1 : 0) : 0
      if (startAtNight) night = 1
      else night = 0
      apply(night)
    },
    getNight: () => night,
  }
}

/** @deprecated use NIGHT_WAVES / isNightWave */
export function setNightFromWave() {}
