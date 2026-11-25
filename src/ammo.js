import * as THREE from 'three'
import {
  PLOT_W,
  PLOT_D,
  PLOT_Z0,
  SIDE_PLOT_W,
  SPLIT_PLOT_W,
  FAR_PLOT_W,
  plotBackZ,
  HOUSE,
  SIDE_HOUSE,
  FATHER_HOUSE,
  TERENTYEV_HOUSE,
  insideZombiePlot,
} from './collision.js'

export const MAX_AMMO = 12
const MAX_MAGS_ON_GROUND = 3
const KILLS_PER_MAG = 3

function makeMat(color, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshLambertMaterial({
    color,
    emissive,
    emissiveIntensity,
    flatShading: true,
  })
}

function overlapsHouse(x, z, b, pad = 1.5) {
  return (
    Math.abs(x - b.x) < b.halfW + pad &&
    Math.abs(z - b.z) < b.halfD + pad
  )
}

function randomMagDropPos() {
  const totalW = PLOT_W + SIDE_PLOT_W + SPLIT_PLOT_W + FAR_PLOT_W
  const left = -PLOT_W / 2 + 1.5
  for (let i = 0; i < 20; i++) {
    const x = left + Math.random() * (totalW - 3)
    const z = plotBackZ() + 2 + Math.random() * (PLOT_D - 4)
    // no access to zombie paddock — never drop mags there
    if (insideZombiePlot(x, z, -1)) continue
    if (
      overlapsHouse(x, z, HOUSE) ||
      overlapsHouse(x, z, SIDE_HOUSE) ||
      overlapsHouse(x, z, FATHER_HOUSE) ||
      overlapsHouse(x, z, TERENTYEV_HOUSE)
    ) {
      continue
    }
    return { x, z }
  }
  return { x: 2 + Math.random() * 4, z: PLOT_Z0 + 4 }
}

function makeMagazine() {
  const g = new THREE.Group()
  const brass = makeMat(0xc9a227, 0xffb300, 1.05)
  const dark = makeMat(0x3e2723, 0x5d4037, 0.35)

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.28), brass)
  body.position.y = 0.22
  body.castShadow = true
  g.add(body)

  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.32), dark)
  lip.position.y = 0.45
  g.add(lip)

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.3), dark)
  base.position.y = 0.03
  g.add(base)

  // ammo tips peeking
  for (let i = 0; i < 3; i++) {
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.08, 5),
      makeMat(0xffe082, 0xffc107, 0.9),
    )
    tip.position.set(-0.04 + i * 0.04, 0.5, 0)
    g.add(tip)
  }

  const light = new THREE.PointLight(0xffc078, 2.6, 9, 2)
  light.position.y = 0.3
  g.add(light)

  g.userData.isAmmoPickup = true
  return g
}

/**
 * Ammo counter (12) + glowing magazine pickups.
 * Every 3 kills drops one mag (max 3 on the ground).
 */
export function createAmmoSystem(scene, getPlayerPos, { onChange } = {}) {
  let ammo = MAX_AMMO
  let killsTowardDrop = 0
  const mags = []
  let t = 0

  const notify = () => onChange?.(ammo)

  const removeMag = (mag) => {
    const i = mags.indexOf(mag)
    if (i >= 0) mags.splice(i, 1)
    scene.remove(mag)
  }

  const spawnMag = () => {
    if (mags.length >= MAX_MAGS_ON_GROUND) return false
    const mag = makeMagazine()
    const pos = randomMagDropPos()
    mag.position.set(pos.x, 0.35, pos.z)
    mag.rotation.y = Math.random() * Math.PI * 2
    mag.userData.bob = Math.random() * Math.PI * 2
    scene.add(mag)
    mags.push(mag)
    return true
  }

  const clearMags = () => {
    for (const m of mags) scene.remove(m)
    mags.length = 0
  }

  return {
    getAmmo: () => ammo,
    MAX_AMMO,

    /** Spend 1 round if available. */
    tryFire() {
      if (ammo <= 0) return false
      ammo -= 1
      notify()
      return true
    },

    /** Call after a real zombie kill (not Terentyev). */
    onKill() {
      killsTowardDrop += 1
      if (killsTowardDrop >= KILLS_PER_MAG) {
        killsTowardDrop = 0
        spawnMag()
      }
    },

    update(dt, { paused } = {}) {
      if (paused) return
      t += dt
      const p = getPlayerPos()

      for (let i = mags.length - 1; i >= 0; i--) {
        const mag = mags[i]
        mag.userData.bob = (mag.userData.bob || 0) + dt * 2.2
        mag.rotation.y += dt * 1.8
        mag.position.y = 0.35 + Math.sin(mag.userData.bob) * 0.1
        const pulse = 0.85 + Math.sin(t * 5 + i) * 0.35
        mag.traverse((c) => {
          if (c.isPointLight) c.intensity = 2.2 * pulse
          if (c.isMesh && c.material?.emissiveIntensity != null) {
            c.material.emissiveIntensity = 0.75 + pulse * 0.55
          }
        })

        const dx = p.x - mag.position.x
        const dz = p.z - mag.position.z
        if (dx * dx + dz * dz < 1.55 * 1.55 && Math.abs((p.y || 1.6) - mag.position.y) < 2.2) {
          ammo = MAX_AMMO
          notify()
          removeMag(mag)
        }
      }
    },

    reset() {
      ammo = MAX_AMMO
      killsTowardDrop = 0
      clearMags()
      notify()
    },
  }
}
