import * as THREE from 'three'
import {
  PLOT_W,
  PLOT_D,
  PLOT_Z0,
  GATE_HALF,
  ZOMBIE_FENCE_SCALE,
  plotFrontZ,
  insidePlot,
  insideAnyYard,
  insideZombiePlot,
  resolveZombieXZ,
  randomOutsideSpawn,
  randomZombiePlotSpawn,
  randomFarPlotSpawn,
  clampInsideZombiePlot,
  clampInsideFarPlot,
  TERENTYEV_BEDS,
  splitLeftX,
  splitRightX,
  zombieBackZ,
  zombieFrontZ,
} from './collision.js'
import { getSurge, getWavePlan } from './difficulty.js'

const SPEED = 2.0
const TERENTYEV_SPEED = SPEED * 2
const HIT_R = 0.9
const DEFAULT_HP = 3
const EMERGE_Y = -2.2
const EMERGE_SPEED = 2.4
const WAVE_GAP = 3.5
const SPAWN_GAP = 1.1
const TOUCH_R = 1.35
const CLIMB_DUR = 1.35
const CLIMB_OUT_DUR = 1.55
const ZOMBIE_CLIMB_H = 2.2 * ZOMBIE_FENCE_SCALE

function makeMat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true })
}

const PALETTE = {
  green: {
    body: 0x2e7d32,
    head: 0x1b5e20,
    arm: 0x388e3c,
    leg: 0x1b5e20,
    brow: 0x0d1f0d,
  },
  gray: {
    body: 0x616161,
    head: 0x424242,
    arm: 0x757575,
    leg: 0x373737,
    brow: 0x212121,
  },
  blue: {
    body: 0x1565c0,
    head: 0x0d47a1,
    arm: 0x1e88e5,
    leg: 0x0d47a1,
    brow: 0x061a3a,
  },
}

export function makeZombie(kind = 'green') {
  const p = PALETTE[kind] || PALETTE.green
  const g = new THREE.Group()
  g.userData.isZombie = true
  g.userData.kind = kind
  g.userData.climber = kind === 'gray'
  g.userData.ambient = kind === 'blue'
  g.userData.immortal = kind === 'blue'
  g.userData.noAttack = kind === 'blue'

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.4), makeMat(p.body))
  body.position.y = 1.1
  body.castShadow = true
  g.add(body)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.65), makeMat(p.head))
  head.position.y = 1.9
  head.castShadow = true
  g.add(head)

  ;[-0.2, 0.2].forEach((x, i) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.1), makeMat(p.brow))
    brow.position.set(x, 2.12, 0.34)
    brow.rotation.z = i ? 0.45 : -0.45
    g.add(brow)
  })

  g.userData.eyeMats = []
  ;[-0.16, 0.16].forEach((x) => {
    const eyeMat = new THREE.MeshLambertMaterial({
      color: 0xff1744,
      emissive: 0xff1744,
      emissiveIntensity: 0,
      flatShading: true,
    })
    g.userData.eyeMats.push(eyeMat)
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), eyeMat)
    eye.position.set(x, 1.95, 0.36)
    eye.userData.isEye = true
    g.add(eye)
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), makeMat(0x212121))
    slit.position.set(x, 1.95, 0.41)
    g.add(slit)
  })

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), makeMat(0x311))
  mouth.position.set(0, 1.68, 0.38)
  g.add(mouth)
  ;[-0.08, 0.08].forEach((x) => {
    const fang = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), makeMat(0xeceff1))
    fang.position.set(x, 1.62, 0.42)
    g.add(fang)
  })

  ;[-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.75), makeMat(p.arm))
    arm.position.set(s * 0.48, 1.3, 0.4)
    arm.rotation.x = -1.05
    arm.castShadow = true
    g.add(arm)
  })

  ;[-0.18, 0.18].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), makeMat(p.leg))
    leg.position.set(x, 0.32, 0)
    leg.castShadow = true
    g.add(leg)
  })

  return g
}

const BODY_SEP = 1.05

/** Next gap is a fresh random multiple of `every`, not a shared clock. */
function rollSurgeWait(every) {
  return every * (0.35 + Math.random() * 2.1)
}

function tickSurge(z, surge, dt) {
  if (!surge || surge.duration <= 0 || surge.every <= 0) return 1
  if (z.userData.surgeWait == null) {
    z.userData.surgeWait = surge.every * (0.15 + Math.random() * 2.6)
  }
  if (z.userData.surgeLeft > 0) {
    z.userData.surgeLeft -= dt
    if (z.userData.surgeLeft > 0) return 1 + (z.userData.surgePercent || surge.percent) / 100
    z.userData.surgeWait = rollSurgeWait(surge.every)
    return 1
  }
  z.userData.surgeWait -= dt
  if (z.userData.surgeWait <= 0) {
    z.userData.surgeLeft = surge.duration * (0.55 + Math.random() * 0.9)
    z.userData.surgePercent = surge.percent * (0.7 + Math.random() * 0.65)
    return 1 + z.userData.surgePercent / 100
  }
  return 1
}

function clampMobFeet(z) {
  const inZombieYard = insideZombiePlot(z.position.x, z.position.z, 0.1)
  if (inZombieYard && z.userData.fromZombieYard && !z.userData.hasEntered) {
    const c = clampInsideZombiePlot(z.position.x, z.position.z, 0.55)
    z.position.x = c.x
    z.position.z = c.z
    return
  }
  const inside = insidePlot(z.position.x, z.position.z, 0.15)
  const inAnyYard = insideAnyYard(z.position.x, z.position.z, 0.1)
  const canEnter = z.userData.climber || z.userData.hasEntered || inside
  const c = resolveZombieXZ(z.position.x, z.position.z, 0.55, { canEnter })
  z.position.x = c.x
  z.position.z = c.z
}

/** Push overlapping mobs apart so a crowd stays a crowd, not one stacked body. */
function separateMobs(horde) {
  const mobs = []
  for (const z of horde) {
    if (!z.userData.alive || z.userData.emerging || z.userData.climbing) continue
    mobs.push(z)
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < mobs.length; i++) {
      const a = mobs[i]
      for (let j = i + 1; j < mobs.length; j++) {
        const b = mobs[j]
        let dx = b.position.x - a.position.x
        let dz = b.position.z - a.position.z
        let dist = Math.hypot(dx, dz)
        if (dist >= BODY_SEP) continue
        if (dist < 1e-3) {
          const ang = i * 2.399963 + pass
          dx = Math.cos(ang)
          dz = Math.sin(ang)
          dist = 1
        }
        const push = (BODY_SEP - dist) * 0.5
        const nx = (dx / dist) * push
        const nz = (dz / dist) * push
        a.position.x -= nx
        a.position.z -= nz
        b.position.x += nx
        b.position.z += nz
      }
    }
    for (const z of mobs) clampMobFeet(z)
  }
}

function setSurgeEyes(z, on) {
  const mats = z.userData.eyeMats
  if (!mats) return
  for (const mat of mats) mat.emissiveIntensity = on ? 1.1 : 0
}

function findZombieRoot(obj) {
  while (obj && !obj.userData?.isZombie) obj = obj.parent
  return obj
}

function damageZombie(z, killsRef, onStats, onTerentyevHit, onKill) {
  if (!z?.userData?.alive || z.userData.emerging || z.userData.climbing) return false
  // Тєрєнтьєв blues — immortal; still flash so shots feel registered
  if (z.userData.immortal) {
    z.userData.flash = 0.12
    z.traverse((c) => {
      if (c.isMesh && c.material?.color) {
        c.userData._baseColor = c.userData._baseColor || c.material.color.getHex()
        c.material.color.setHex(0x90caf9)
      }
    })
    onTerentyevHit?.()
    return true
  }
  z.userData.hp = (z.userData.hp ?? DEFAULT_HP) - 1
  z.userData.flash = 0.15
  z.traverse((c) => {
    if (c.isMesh && c.material?.color) {
      c.userData._baseColor = c.userData._baseColor || c.material.color.getHex()
      c.material.color.setHex(0xa5d6a7)
    }
  })
  if (z.userData.hp <= 0) {
    z.userData.alive = false
    z.userData.dieT = 0
    z.userData.dieStartY = z.position.y
    z.userData.dieSpin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.4)
    z.traverse((c) => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone()
        c.material.transparent = true
        c.material.depthWrite = false
        if (c.material.emissive) c.material.emissiveIntensity = 0
      }
    })
    killsRef.n++
    onStats?.()
    onKill?.()
    return true
  }
  return true
}

function nearFenceOutside(x, z, band = 2.2) {
  const hw = PLOT_W / 2
  const hd = PLOT_D / 2
  const lz = z - PLOT_Z0
  if (insidePlot(x, z, 0.05)) return false
  const nearX = Math.abs(x) >= hw - 0.3 && Math.abs(x) <= hw + band && Math.abs(lz) <= hd + band
  const nearZ = Math.abs(lz) >= hd - 0.3 && Math.abs(lz) <= hd + band && Math.abs(x) <= hw + band
  return nearX || nearZ
}

function climbTargets(x, z) {
  const hw = PLOT_W / 2 - 0.6
  const zMin = PLOT_Z0 - (PLOT_D / 2 - 0.6)
  const zMax = PLOT_Z0 + (PLOT_D / 2 - 0.6)
  const lz = z - PLOT_Z0
  // land just inside nearest edge of my plot
  if (Math.abs(x) / (PLOT_W / 2) >= Math.abs(lz) / (PLOT_D / 2)) {
    return { x: Math.sign(x || 1) * hw, z: Math.max(zMin, Math.min(zMax, z)) }
  }
  return { x: Math.max(-hw, Math.min(hw, x)), z: Math.sign(lz || 1) * (PLOT_D / 2 - 0.6) + PLOT_Z0 }
}

function nearZombieFenceInside(x, z, band = 1.6) {
  if (!insideZombiePlot(x, z, 0.05)) return false
  const x0 = splitLeftX()
  const x1 = splitRightX()
  const z0 = zombieBackZ()
  const z1 = zombieFrontZ()
  return (
    x <= x0 + band ||
    x >= x1 - band ||
    z <= z0 + band ||
    z >= z1 - band
  )
}

/** Climb out of sealed zombie paddock toward the player. */
function climbOutOfZombieTarget(x, z, px, pz) {
  const x0 = splitLeftX()
  const x1 = splitRightX()
  const z0 = zombieBackZ()
  const z1 = zombieFrontZ()
  const pad = 1.35
  const candidates = [
    { x: x0 - pad, z },
    { x: x1 + pad, z },
    { x, z: z0 - pad },
    { x, z: z1 + pad },
  ]
  let best = candidates[0]
  let bestD = Infinity
  for (const c of candidates) {
    const d = Math.hypot(c.x - px, c.z - pz)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

export function createZombieSystem(scene, getPlayerPos, onStats, hooks = {}) {
  const { onTerentyevHit, onKill } = hooks
  const list = []
  const ambient = []
  const raycaster = new THREE.Raycaster()
  const killsRef = { n: 0 }
  let wave = 1
  let toSpawn = 0
  let spawnCD = 0
  let betweenWaves = 1.2
  let phase = 'countdown'
  let spawnTotal = 0
  let climbersLeft = 0
  let waveHp = DEFAULT_HP
  let frozen = false
  let nightLevel = 0

  const allZombies = () => list.concat(ambient)

  const clearWaterFx = (z) => {
    if (z.userData.waterFx) {
      scene.remove(z.userData.waterFx)
      z.userData.waterFx = null
    }
  }

  const ensureWaterFx = (z) => {
    if (z.userData.waterFx) return z.userData.waterFx
    const fx = new THREE.Group()
    fx.userData.drops = []
    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 3),
        makeMat(0x64b5f6),
      )
      drop.position.set(0, 0, 0)
      drop.visible = false
      fx.add(drop)
      fx.userData.drops.push({ mesh: drop, t: Math.random() })
    }
    // watering can
    const can = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), makeMat(0x455a64))
    body.position.y = 0.1
    can.add(body)
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), makeMat(0x607d8b))
    spout.position.set(0.08, 0.14, 0.22)
    spout.rotation.x = -0.55
    can.add(spout)
    can.position.set(0.35, 1.15, 0.35)
    fx.add(can)
    fx.userData.can = can
    scene.add(fx)
    z.userData.waterFx = fx
    return fx
  }

  const refreshUi = () => {
    onStats?.({
      kills: killsRef.n,
      wave,
      alive: list.filter((z) => z.userData.alive).length,
    })
  }

  const spawnTerentyev = () => {
    for (const z of ambient) {
      clearWaterFx(z)
      scene.remove(z)
    }
    ambient.length = 0
    for (let i = 0; i < 2; i++) {
      const z = makeZombie('blue')
      const pos = randomFarPlotSpawn(2.2)
      z.position.set(pos.x, 0, pos.z)
      z.userData.bob = Math.random() * Math.PI * 2
      z.userData.alive = true
      z.userData.emerging = false
      z.userData.hp = 999
      z.userData.flash = 0
      z.userData.climbing = false
      z.userData.watering = false
      z.userData.waterT = 0
      z.userData.bedIndex = i % TERENTYEV_BEDS.length
      z.userData.patrol = {
        x: pos.x + (Math.random() * 6 - 3),
        z: pos.z + (Math.random() * 8 - 4),
      }
      scene.add(z)
      ambient.push(z)
    }
  }

  const spawnOne = () => {
    spawnTotal++
    const useClimber =
      climbersLeft > 0 && (climbersLeft >= toSpawn || Math.random() < climbersLeft / Math.max(1, toSpawn))
    if (useClimber) climbersLeft--
    const z = makeZombie(useClimber ? 'gray' : 'green')
    // Climbers emerge inside ділянка зомбі; greens outside as usual
    const pos = useClimber ? randomZombiePlotSpawn(1.5) : randomOutsideSpawn(3, 9)
    z.position.set(pos.x, EMERGE_Y, pos.z)
    z.userData.bob = Math.random() * Math.PI * 2
    z.userData.alive = true
    z.userData.emerging = true
    z.userData.emergeT = 0
    z.userData.hp = waveHp
    z.userData.flash = 0
    z.userData.climbing = false
    z.userData.climbOut = false
    z.userData.fromZombieYard = !!useClimber
    z.userData.hasEntered = false
    scene.add(z)
    list.push(z)
  }

  const startWave = () => {
    const plan = getWavePlan(wave)
    toSpawn = plan.zombies
    climbersLeft = plan.climbers
    waveHp = plan.zombieHp
    spawnCD = 0
    if (plan.zombies <= 0) {
      // Peace / no mobs: advance day-night on a slow timer, never spawn
      phase = 'peace'
      betweenWaves = 10
      refreshUi()
      return
    }
    phase = 'spawning'
    refreshUi()
  }

  const clearAll = () => {
    for (const z of list) scene.remove(z)
    list.length = 0
  }

  const reset = () => {
    clearAll()
    spawnTerentyev()
    killsRef.n = 0
    wave = 1
    phase = 'countdown'
    betweenWaves = 1.5
    toSpawn = 0
    spawnTotal = 0
    frozen = false
    refreshUi()
  }

  const setFrozen = (v) => {
    frozen = !!v
  }

  const update = (dt, { paused, onPlayerHit } = {}) => {
    if (paused || frozen) return

    if (phase === 'countdown') {
      betweenWaves -= dt
      if (betweenWaves <= 0) startWave()
    } else if (phase === 'spawning') {
      spawnCD -= dt
      if (toSpawn > 0 && spawnCD <= 0) {
        spawnOne()
        toSpawn--
        spawnCD = SPAWN_GAP
        refreshUi()
      }
      if (toSpawn <= 0) phase = 'fighting'
    } else if (phase === 'fighting') {
      // ignore ambient (Тєрєнтьєв) when clearing a wave
      if (!list.some((z) => z.userData.alive) && list.length === 0) {
        wave++
        phase = 'countdown'
        betweenWaves = WAVE_GAP
        refreshUi()
      }
    } else if (phase === 'peace') {
      betweenWaves -= dt
      if (betweenWaves <= 0) {
        wave++
        betweenWaves = 10
        refreshUi()
        // re-check in case difficulty changed mid-run
        const plan = getWavePlan(wave)
        if (plan.zombies > 0) {
          phase = 'countdown'
          betweenWaves = 0.4
        }
      }
    }

    const p = getPlayerPos()

    // ambient Тєрєнтьєв blues — patrol by day; water beds at night
    if (!frozen && !paused) {
      const wateringNight = nightLevel > 0.45
      for (const z of ambient) {
        if (z.userData.flash > 0) {
          z.userData.flash -= dt
          if (z.userData.flash <= 0) {
            z.traverse((c) => {
              if (c.isMesh && c.userData._baseColor != null) {
                c.material.color.setHex(c.userData._baseColor)
              }
            })
          }
        }
        z.userData.bob += dt * 7

        let tx
        let tz
        if (wateringNight) {
          const bed = TERENTYEV_BEDS[z.userData.bedIndex % TERENTYEV_BEDS.length]
          tx = bed.x
          tz = bed.z
          const distBed = Math.hypot(tx - z.position.x, tz - z.position.z)
          if (distBed < 1.1) {
            z.userData.watering = true
            z.userData.waterT = (z.userData.waterT || 0) + dt
            const fx = ensureWaterFx(z)
            fx.position.set(z.position.x, 0, z.position.z)
            fx.rotation.y = z.rotation.y
            if (fx.userData.can) {
              fx.userData.can.rotation.x = -0.35 + Math.sin(z.userData.waterT * 8) * 0.08
            }
            for (const drop of fx.userData.drops) {
              drop.t += dt * 2.4
              if (drop.t > 1) drop.t -= 1
              const t = drop.t
              drop.mesh.visible = true
              drop.mesh.position.set(
                0.45 + (Math.random() - 0.5) * 0.08,
                1.25 - t * 1.15,
                0.55 + t * 0.35 + (Math.random() - 0.5) * 0.1,
              )
            }
            if (z.userData.waterT > 2.4) {
              z.userData.waterT = 0
              z.userData.bedIndex = (z.userData.bedIndex + 1) % TERENTYEV_BEDS.length
              z.userData.watering = false
              clearWaterFx(z)
            }
          } else {
            z.userData.watering = false
            z.userData.waterT = 0
            clearWaterFx(z)
          }
        } else {
          z.userData.watering = false
          z.userData.waterT = 0
          clearWaterFx(z)
          tx = z.userData.patrol?.x ?? z.position.x
          tz = z.userData.patrol?.z ?? z.position.z
          const distP = Math.hypot(tx - z.position.x, tz - z.position.z)
          if (distP < 0.8) {
            const next = randomFarPlotSpawn(2.5)
            z.userData.patrol = next
            tx = next.x
            tz = next.z
          }
        }

        if (!z.userData.watering) {
          const dx = tx - z.position.x
          const dz = tz - z.position.z
          const distAim = Math.hypot(dx, dz) || 1
          let nx = z.position.x + (dx / distAim) * TERENTYEV_SPEED * dt
          let nz = z.position.z + (dz / distAim) * TERENTYEV_SPEED * dt
          const c = clampInsideFarPlot(nx, nz, 0.55)
          z.position.x = c.x
          z.position.z = c.z
          z.position.y = Math.sin(z.userData.bob) * 0.08
          z.lookAt(tx, z.position.y, tz)
        } else {
          z.position.y = Math.sin(z.userData.bob) * 0.04
          z.lookAt(tx, z.position.y, tz)
        }
      }
    }

    const surge = getSurge()
    for (let i = list.length - 1; i >= 0; i--) {
      if (frozen || paused) break
      const z = list[i]

      if (z.userData.flash > 0) {
        z.userData.flash -= dt
        if (z.userData.flash <= 0) {
          z.traverse((c) => {
            if (c.isMesh && c.userData._baseColor != null) {
              c.material.color.setHex(c.userData._baseColor)
            }
          })
        }
      }

      if (!z.userData.alive) {
        setSurgeEyes(z, false)
        z.userData.dieT = (z.userData.dieT || 0) + dt
        const t = z.userData.dieT
        const spin = z.userData.dieSpin || 1.5
        // tumble, sink, shrink, fade
        z.rotation.x = Math.min(1.62, t * 3.2)
        z.rotation.z = Math.sin(t * 7) * 0.55 * Math.max(0, 1 - t * 0.7)
        z.rotation.y += spin * dt
        const startY = z.userData.dieStartY ?? 0
        z.position.y = startY - t * t * 2.8
        const s = Math.max(0.08, 1 - t * 0.65)
        z.scale.setScalar(s)
        const fade = Math.max(0, 1 - t * 0.85)
        z.traverse((c) => {
          if (c.isMesh && c.material?.opacity != null) c.material.opacity = fade
        })
        if (t > 1.35) {
          scene.remove(z)
          list.splice(i, 1)
          refreshUi()
        }
        continue
      }

      if (z.userData.emerging) {
        setSurgeEyes(z, false)
        z.userData.emergeT += dt
        z.position.y = Math.min(0, EMERGE_Y + z.userData.emergeT * EMERGE_SPEED)
        z.rotation.z = Math.sin(z.userData.emergeT * 8) * 0.08
        z.lookAt(p.x, z.position.y, p.z)
        if (z.position.y >= -0.01) {
          z.position.y = 0
          z.rotation.z = 0
          z.userData.emerging = false
        }
        continue
      }

      // climbing over a fence (out of zombie yard or into my plot)
      if (z.userData.climbing) {
        setSurgeEyes(z, false)
        z.userData.climbT += dt
        const dur = z.userData.climbOut ? CLIMB_OUT_DUR : CLIMB_DUR
        const peak = z.userData.climbOut ? ZOMBIE_CLIMB_H : 2.2
        const t = Math.min(1, z.userData.climbT / dur)
        const a = z.userData.climbFrom
        const b = z.userData.climbTo
        z.position.x = a.x + (b.x - a.x) * t
        z.position.z = a.z + (b.z - a.z) * t
        z.position.y = Math.sin(t * Math.PI) * peak
        z.lookAt(p.x, 0, p.z)
        if (t >= 1) {
          z.userData.climbing = false
          z.userData.climbOut = false
          z.userData.fromZombieYard = false
          z.position.y = 0
          z.position.x = b.x
          z.position.z = b.z
          if (insideAnyYard(b.x, b.z, 0)) z.userData.hasEntered = true
        }
        continue
      }

      // climbers leave the sealed zombie paddock over the tall board fence
      if (
        z.userData.climber &&
        z.userData.fromZombieYard &&
        insideZombiePlot(z.position.x, z.position.z, 0.1) &&
        nearZombieFenceInside(z.position.x, z.position.z)
      ) {
        z.userData.climbing = true
        z.userData.climbOut = true
        z.userData.climbT = 0
        z.userData.climbFrom = { x: z.position.x, z: z.position.z }
        z.userData.climbTo = climbOutOfZombieTarget(z.position.x, z.position.z, p.x, p.z)
        continue
      }

      // then scale my plot fence to reach the player
      if (
        z.userData.climber &&
        !z.userData.fromZombieYard &&
        !z.userData.hasEntered &&
        !insidePlot(z.position.x, z.position.z, 0.2) &&
        nearFenceOutside(z.position.x, z.position.z)
      ) {
        z.userData.climbing = true
        z.userData.climbOut = false
        z.userData.climbT = 0
        z.userData.climbFrom = { x: z.position.x, z: z.position.z }
        z.userData.climbTo = climbTargets(z.position.x, z.position.z)
        continue
      }

      z.userData.bob += dt * 5
      const inside = insidePlot(z.position.x, z.position.z, 0.15)
      const inAnyYard = insideAnyYard(z.position.x, z.position.z, 0.1)
      const inZombieYard = insideZombiePlot(z.position.x, z.position.z, 0.1)
      if (inside || inAnyYard) z.userData.hasEntered = true
      // after first entry, keep chasing player on any plot (don't snap back to spawn/gate)
      const canEnter = z.userData.climber || z.userData.hasEntered || inside

      // greens outside: go to front gate first, then player
      // climbers still in zombie yard: walk toward nearest exit edge facing player
      let tx = p.x
      let tz = p.z
      if (z.userData.climber && inZombieYard) {
        const exit = climbOutOfZombieTarget(z.position.x, z.position.z, p.x, p.z)
        tx = exit.x
        tz = exit.z
      } else if (!canEnter && !inside) {
        tx = 0
        tz = plotFrontZ() + 1.2
        if (Math.abs(z.position.x) < GATE_HALF - 0.2 && z.position.z > plotFrontZ() - 1) {
          tx = p.x
          tz = p.z
        }
      }

      const dx = tx - z.position.x
      const dz = tz - z.position.z
      const distAim = Math.hypot(dx, dz) || 1
      const surgeMul = tickSurge(z, surge, dt)
      let nx = z.position.x + (dx / distAim) * SPEED * surgeMul * dt
      let nz = z.position.z + (dz / distAim) * SPEED * surgeMul * dt

      if (inZombieYard && z.userData.fromZombieYard) {
        const c = clampInsideZombiePlot(nx, nz, 0.55)
        nx = c.x
        nz = c.z
      } else {
        const c = resolveZombieXZ(nx, nz, 0.55, { canEnter })
        nx = c.x
        nz = c.z
      }

      z.position.x = nx
      z.position.z = nz
      z.position.y = Math.sin(z.userData.bob) * 0.06
      z.lookAt(tx, z.position.y, tz)
      const surging = surgeMul > 1
      setSurgeEyes(z, surging)
      if (surging) z.rotateX(-0.2)

      const dist = Math.hypot(p.x - z.position.x, p.z - z.position.z) || 1

      if (!z.userData.noAttack && dist < TOUCH_R) {
        const died = onPlayerHit?.(1)
        if (died) {
          frozen = true
          break
        }
      }
    }
    separateMobs(list)
  }

  const tryShoot = (camera) => {
    if (frozen) return false
    const hit = (z) => damageZombie(z, killsRef, refreshUi, onTerentyevHit, onKill)

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    const meshes = []
    allZombies().forEach((z) => {
      if (!z.userData.alive) return
      z.traverse((c) => {
        if (c.isMesh) meshes.push(c)
      })
    })
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length) {
      const root = findZombieRoot(hits[0].object)
      if (root && root.position.distanceTo(camera.position) < 45) return hit(root)
    }

    const origin = camera.position
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    for (const z of allZombies()) {
      if (!z.userData.alive || z.userData.emerging || z.userData.climbing) continue
      const to = z.position.clone().setY(1.2).sub(origin)
      const dist = to.length()
      if (dist > 28) continue
      to.normalize()
      const dot = dir.dot(to)
      if (dot > 0.9 && dist * Math.sqrt(Math.max(0, 1 - dot * dot)) < HIT_R) return hit(z)
    }
    return false
  }

  const setNight = (n) => {
    nightLevel = Math.max(0, Math.min(1, n))
    const glow = nightLevel * 2.2
    for (const z of allZombies()) {
      for (const m of z.userData.eyeMats || []) {
        m.emissiveIntensity = glow
        m.color.setHex(glow > 0.15 ? 0xff5252 : 0xff1744)
      }
    }
    if (nightLevel < 0.35) {
      for (const z of ambient) clearWaterFx(z)
    }
  }

  spawnTerentyev()
  refreshUi()
  return {
    update,
    tryShoot,
    reset,
    setFrozen,
    setNight,
    getKills: () => killsRef.n,
    getWave: () => wave,
  }
}
