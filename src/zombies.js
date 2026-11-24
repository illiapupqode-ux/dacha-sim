import * as THREE from 'three'
import {
  PLOT_W,
  PLOT_D,
  GATE_HALF,
  insidePlot,
  resolveZombieXZ,
  randomOutsideSpawn,
} from './collision.js'

const SPEED = 2.0
const HIT_R = 0.9
const HP = 3
const EMERGE_Y = -2.2
const EMERGE_SPEED = 2.4
const WAVE_GAP = 3.5
const SPAWN_GAP = 1.1
const TOUCH_R = 1.35
const CLIMB_DUR = 1.35

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
}

export function makeZombie(kind = 'green') {
  const p = PALETTE[kind] || PALETTE.green
  const g = new THREE.Group()
  g.userData.isZombie = true
  g.userData.kind = kind
  g.userData.climber = kind === 'gray'

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

function findZombieRoot(obj) {
  while (obj && !obj.userData?.isZombie) obj = obj.parent
  return obj
}

function damageZombie(z, killsRef, onStats) {
  if (!z?.userData?.alive || z.userData.emerging || z.userData.climbing) return false
  z.userData.hp = (z.userData.hp ?? HP) - 1
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
    killsRef.n++
    onStats?.()
    return true
  }
  return true
}

function nearFenceOutside(x, z, band = 2.2) {
  const hw = PLOT_W / 2
  const hd = PLOT_D / 2
  if (insidePlot(x, z, 0.05)) return false
  const nearX = Math.abs(x) >= hw - 0.3 && Math.abs(x) <= hw + band && Math.abs(z) <= hd + band
  const nearZ = Math.abs(z) >= hd - 0.3 && Math.abs(z) <= hd + band && Math.abs(x) <= hw + band
  return nearX || nearZ
}

function climbTargets(x, z) {
  const hw = PLOT_W / 2 - 0.6
  const hd = PLOT_D / 2 - 0.6
  // land just inside nearest edge
  if (Math.abs(x) / (PLOT_W / 2) >= Math.abs(z) / (PLOT_D / 2)) {
    return { x: Math.sign(x || 1) * hw, z: Math.max(-hd, Math.min(hd, z)) }
  }
  return { x: Math.max(-hw, Math.min(hw, x)), z: Math.sign(z || 1) * hd }
}

export function createZombieSystem(scene, getPlayerPos, onStats) {
  const list = []
  const raycaster = new THREE.Raycaster()
  const killsRef = { n: 0 }
  let wave = 1
  let toSpawn = 0
  let spawnCD = 0
  let betweenWaves = 1.2
  let phase = 'countdown'
  let spawnTotal = 0
  let frozen = false

  const waveSize = (w) => 2 + w

  const refreshUi = () => {
    onStats?.({ kills: killsRef.n, wave, alive: list.filter((z) => z.userData.alive).length })
  }

  const spawnOne = () => {
    spawnTotal++
    const gray = spawnTotal % 6 === 0
    const z = makeZombie(gray ? 'gray' : 'green')
    const pos = randomOutsideSpawn(3, 9)
    z.position.set(pos.x, EMERGE_Y, pos.z)
    z.userData.bob = Math.random() * Math.PI * 2
    z.userData.alive = true
    z.userData.emerging = true
    z.userData.emergeT = 0
    z.userData.hp = HP
    z.userData.flash = 0
    z.userData.climbing = false
    scene.add(z)
    list.push(z)
  }

  const startWave = () => {
    toSpawn = waveSize(wave)
    spawnCD = 0
    phase = 'spawning'
    refreshUi()
  }

  const clearAll = () => {
    for (const z of list) scene.remove(z)
    list.length = 0
  }

  const reset = () => {
    clearAll()
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
      if (!list.some((z) => z.userData.alive) && list.length === 0) {
        wave++
        phase = 'countdown'
        betweenWaves = WAVE_GAP
        refreshUi()
      }
    }

    const p = getPlayerPos()
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
        z.userData.dieT = (z.userData.dieT || 0) + dt
        z.rotation.x = Math.min(1.5, z.userData.dieT * 3.5)
        z.position.y -= dt * 1.2
        if (z.userData.dieT > 1.1) {
          scene.remove(z)
          list.splice(i, 1)
          refreshUi()
        }
        continue
      }

      if (z.userData.emerging) {
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

      // gray climbers scale the fence
      if (z.userData.climbing) {
        z.userData.climbT += dt
        const t = Math.min(1, z.userData.climbT / CLIMB_DUR)
        const a = z.userData.climbFrom
        const b = z.userData.climbTo
        z.position.x = a.x + (b.x - a.x) * t
        z.position.z = a.z + (b.z - a.z) * t
        z.position.y = Math.sin(t * Math.PI) * 2.2
        z.lookAt(p.x, 0, p.z)
        if (t >= 1) {
          z.userData.climbing = false
          z.position.y = 0
          z.position.x = b.x
          z.position.z = b.z
        }
        continue
      }

      if (
        z.userData.climber &&
        !insidePlot(z.position.x, z.position.z, 0.2) &&
        nearFenceOutside(z.position.x, z.position.z)
      ) {
        z.userData.climbing = true
        z.userData.climbT = 0
        z.userData.climbFrom = { x: z.position.x, z: z.position.z }
        z.userData.climbTo = climbTargets(z.position.x, z.position.z)
        continue
      }

      z.userData.bob += dt * 5
      const inside = insidePlot(z.position.x, z.position.z, 0.15)
      const canEnter = z.userData.climber || inside

      // greens outside: go to front gate first, then player
      let tx = p.x
      let tz = p.z
      if (!canEnter && !inside) {
        tx = 0
        tz = PLOT_D / 2 + 1.2
        // already aligned with gate — push inward
        if (Math.abs(z.position.x) < GATE_HALF - 0.2 && z.position.z > PLOT_D / 2 - 1) {
          tx = p.x
          tz = p.z
        }
      }

      const dx = tx - z.position.x
      const dz = tz - z.position.z
      const distAim = Math.hypot(dx, dz) || 1
      let nx = z.position.x + (dx / distAim) * SPEED * dt
      let nz = z.position.z + (dz / distAim) * SPEED * dt

      const c = resolveZombieXZ(nx, nz, 0.55, { canEnter })
      nx = c.x
      nz = c.z

      z.position.x = nx
      z.position.z = nz
      z.position.y = Math.sin(z.userData.bob) * 0.06
      z.lookAt(tx, z.position.y, tz)

      const dist = Math.hypot(p.x - z.position.x, p.z - z.position.z) || 1

      if (dist < TOUCH_R) {
        const died = onPlayerHit?.(1)
        if (died) {
          frozen = true
          break
        }
      }
    }
  }

  const tryShoot = (camera) => {
    if (frozen) return false
    const hit = (z) => damageZombie(z, killsRef, refreshUi)

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    const meshes = []
    list.forEach((z) => {
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
    for (const z of list) {
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
    const glow = Math.max(0, Math.min(1, n)) * 2.2
    for (const z of list) {
      for (const m of z.userData.eyeMats || []) {
        m.emissiveIntensity = glow
        m.color.setHex(glow > 0.15 ? 0xff5252 : 0xff1744)
      }
    }
  }

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
