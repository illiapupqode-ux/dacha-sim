import * as THREE from 'three'
import { getWavePlan, HEAL_TIERS } from './difficulty.js'

/** Glowing health bottle — once per night block, tier from difficulty map. */
export function createHealthPickup(scene, getPlayerPos, { heal, getNight, getWave }) {
  let bottle = null
  let wasNight = false
  let t = 0
  let pendingHeal = HEAL_TIERS[0]

  const makeBottle = (tier) => {
    const g = new THREE.Group()
    const glassMat = new THREE.MeshLambertMaterial({
      color: tier.color,
      emissive: tier.emissive,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 8), glassMat)
    body.position.y = 0.22
    body.castShadow = true
    g.add(body)

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.14, 6),
      glassMat.clone(),
    )
    neck.position.y = 0.48
    g.add(neck)

    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6),
      new THREE.MeshLambertMaterial({ color: 0x6d4c41, flatShading: true }),
    )
    cork.position.y = 0.57
    g.add(cork)

    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.18, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    cross.position.set(0, 0.24, 0.14)
    g.add(cross)
    const crossArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    crossArm.position.set(0, 0.28, 0.14)
    g.add(crossArm)

    const light = new THREE.PointLight(tier.light, 2.8, 10, 2)
    light.position.y = 0.35
    g.add(light)

    g.position.set(1.1, 0.55, -9.4)
    g.userData.isHealthPickup = true
    g.userData.healHearts = tier.hearts
    scene.add(g)
    return g
  }

  const despawn = () => {
    if (!bottle) return
    scene.remove(bottle)
    bottle = null
  }

  const spawn = () => {
    const wave = getWave?.() ?? 1
    const plan = getWavePlan(wave)
    const tier = plan.heal || HEAL_TIERS[0]
    pendingHeal = tier
    despawn()
    bottle = makeBottle(tier)
    t = 0
  }

  return {
    update(dt, { paused } = {}) {
      if (paused) return
      const night = getNight() > 0.55

      if (night && !wasNight) spawn()
      if (!night && wasNight) despawn()
      wasNight = night

      if (!bottle) return
      t += dt
      bottle.rotation.y += dt * 2.1
      bottle.position.y = 0.55 + Math.sin(t * 3.2) * 0.1
      const pulse = 0.85 + Math.sin(t * 5) * 0.35
      bottle.traverse((c) => {
        if (c.isPointLight) c.intensity = 2.2 * pulse
        if (c.isMesh && c.material?.emissiveIntensity != null) {
          c.material.emissiveIntensity = 0.8 + pulse * 0.5
        }
      })

      const p = getPlayerPos()
      const dx = p.x - bottle.position.x
      const dz = p.z - bottle.position.z
      if (dx * dx + dz * dz < 1.55 * 1.55 && Math.abs(p.y - bottle.position.y) < 2.2) {
        heal(bottle.userData.healHearts ?? pendingHeal.hearts)
        despawn()
      }
    },
    reset() {
      despawn()
      wasNight = false
      t = 0
    },
  }
}
