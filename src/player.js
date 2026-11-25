import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { resolveWorldXZ } from './collision.js'
import { renderHearts } from './hud.js'

const SPEED = 6
const EYE = 1.6
const MAX_HP = 10
const LOOK_SENS = 0.0024

/** True only for real touch-first devices (not Mac trackpad / narrow desktop). */
function preferTouchPlay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}

export function createPlayer(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement)
  const keys = { w: false, a: false, s: false, d: false }
  const stick = { x: 0, y: 0 }
  let onShoot = null
  let onPauseRequest = null
  let kick = 0
  let muzzleT = 0
  let hp = MAX_HP
  let hurtCD = 0
  let hurtFlash = 0
  let paused = false
  let dead = false
  let mobilePlaying = false
  let escArmed = true
  let useMobile = preferTouchPlay()
  const hurtEl = document.getElementById('hurt-flash')

  const gun = new THREE.Group()
  const wood = new THREE.MeshLambertMaterial({ color: 0x4e342e, flatShading: true })
  const metal = new THREE.MeshLambertMaterial({ color: 0x37474f, flatShading: true })
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.35), wood)
  stock.position.set(0.18, -0.18, -0.35)
  gun.add(stock)
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.45), metal)
  barrel.position.set(0.18, -0.12, -0.55)
  gun.add(barrel)
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe082 }),
  )
  flash.position.set(0.18, -0.12, -0.8)
  flash.visible = false
  gun.add(flash)
  camera.add(gun)

  const hint = document.getElementById('hint')
  const cross = document.getElementById('crosshair')
  const mobileUi = document.getElementById('mobile-ui')

  const showMobileUi = () => mobileUi?.classList.add('on')
  const hideMobileUi = () => mobileUi?.classList.remove('on')

  const isActive = () =>
    !paused && !dead && (useMobile ? mobilePlaying : controls.isLocked)

  const fire = () => {
    if (!isActive()) return
    // only kick / muzzle flash when a round actually fires
    if (onShoot?.() === false) return
    kick = 1
    muzzleT = 0.08
    flash.visible = true
  }

  const beginMobilePlay = () => {
    useMobile = true
    mobilePlaying = true
    hint?.classList.add('hidden')
    if (cross) cross.style.display = 'block'
    showMobileUi()
    if (controls.isLocked) controls.unlock()
  }

  const beginDesktopPlay = () => {
    useMobile = false
    mobilePlaying = false
    hideMobileUi()
    controls.lock()
  }

  const onKey = (e, down) => {
    if (e.code === 'Escape' && down) {
      if (e.repeat || !escArmed) return
      e.preventDefault()
      if (controls.isLocked) return
      escArmed = false
      setTimeout(() => {
        escArmed = true
      }, 250)
      onPauseRequest?.('toggle')
      return
    }
    const k = e.code
    if (k === 'KeyW') keys.w = down
    if (k === 'KeyA') keys.a = down
    if (k === 'KeyS') keys.s = down
    if (k === 'KeyD') keys.d = down
  }

  document.addEventListener('keydown', (e) => onKey(e, true))
  document.addEventListener('keyup', (e) => onKey(e, false))

  const startPlay = (fromTouch = false) => {
    if (paused || dead) return
    if (fromTouch || preferTouchPlay()) beginMobilePlay()
    else beginDesktopPlay()
  }

  hint?.addEventListener('click', () => startPlay(false))
  hint?.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault()
      startPlay(true)
    },
    { passive: false },
  )

  domElement.addEventListener('click', () => {
    if (paused || dead || useMobile) return
    if (!controls.isLocked) controls.lock()
    else fire()
  })

  controls.addEventListener('lock', () => {
    hint?.classList.add('hidden')
    if (cross) cross.style.display = 'block'
    if (!useMobile) hideMobileUi()
  })
  controls.addEventListener('unlock', () => {
    if (cross) cross.style.display = 'none'
    if (!paused && !dead && !useMobile) {
      onPauseRequest?.('open')
    }
    if (!paused && !dead && !useMobile) hint?.classList.remove('hidden')
    else hint?.classList.add('hidden')
    if (!useMobile || paused || dead) hideMobileUi()
  })

  // ——— joystick + fire (touch + mouse/pointer) ———
  const joyZone = document.getElementById('joy-zone')
  const joyStick = document.getElementById('joy-stick')
  const btnFire = document.getElementById('btn-fire')
  const btnPauseM = document.getElementById('btn-pause-m')
  let joyId = null
  let lookId = null
  let lookLast = null
  let joyPointerId = null
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ')

  const setStickVisual = (nx, ny) => {
    if (!joyStick) return
    joyStick.style.transform = `translate(${nx * 36}px, ${ny * 36}px)`
  }

  const updateJoy = (clientX, clientY) => {
    if (!joyZone) return
    const r = joyZone.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = (clientX - cx) / (r.width * 0.42)
    let dy = (clientY - cy) / (r.height * 0.42)
    const mag = Math.hypot(dx, dy)
    if (mag > 1) {
      dx /= mag
      dy /= mag
    }
    stick.x = dx
    stick.y = -dy
    setStickVisual(dx, dy)
  }

  const endJoy = () => {
    joyId = null
    joyPointerId = null
    stick.x = 0
    stick.y = 0
    setStickVisual(0, 0)
  }

  joyZone?.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!mobilePlaying && !paused && !dead) beginMobilePlay()
      const t = e.changedTouches[0]
      joyId = t.identifier
      updateJoy(t.clientX, t.clientY)
    },
    { passive: false },
  )
  joyZone?.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) updateJoy(t.clientX, t.clientY)
      }
    },
    { passive: false },
  )
  joyZone?.addEventListener(
    'touchend',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) endJoy()
      }
    },
    { passive: false },
  )
  joyZone?.addEventListener('touchcancel', endJoy)

  // mouse / pen for desktop preview of mobile UI
  joyZone?.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return
    e.preventDefault()
    joyPointerId = e.pointerId
    joyZone.setPointerCapture?.(e.pointerId)
    updateJoy(e.clientX, e.clientY)
  })
  joyZone?.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return
    updateJoy(e.clientX, e.clientY)
  })
  joyZone?.addEventListener('pointerup', (e) => {
    if (e.pointerId === joyPointerId) endJoy()
  })
  joyZone?.addEventListener('pointercancel', endJoy)

  const onFireDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!mobilePlaying && !paused && !dead) beginMobilePlay()
    btnFire?.classList.add('down')
    fire()
  }
  const onFireUp = (e) => {
    e.preventDefault()
    btnFire?.classList.remove('down')
  }
  btnFire?.addEventListener('touchstart', onFireDown, { passive: false })
  btnFire?.addEventListener('touchend', onFireUp, { passive: false })
  btnFire?.addEventListener('touchcancel', onFireUp)
  // mouse only fires when already in mobile UI (don't flip desktop into touch mode)
  btnFire?.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || !useMobile) return
    e.preventDefault()
    btnFire.classList.add('down')
    fire()
  })
  btnFire?.addEventListener('pointerup', onFireUp)
  btnFire?.addEventListener('click', (e) => {
    e.preventDefault()
    if (useMobile) fire()
  })

  btnPauseM?.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      onPauseRequest?.('toggle')
    },
    { passive: false },
  )
  btnPauseM?.addEventListener('click', (e) => {
    e.preventDefault()
    onPauseRequest?.('toggle')
  })

  // look drag on canvas
  const onLookStart = (clientX, clientY, id) => {
    if (paused || dead || !mobilePlaying) return false
    const el = document.elementFromPoint(clientX, clientY)
    if (
      el &&
      (el.closest('#joy-zone') ||
        el.closest('#btn-fire') ||
        el.closest('#btn-pause-m') ||
        el.closest('#menu'))
    ) {
      return false
    }
    lookId = id
    lookLast = { x: clientX, y: clientY }
    return true
  }

  domElement.addEventListener(
    'touchstart',
    (e) => {
      if (!mobilePlaying && !paused && !dead) beginMobilePlay()
      const t = e.changedTouches[0]
      onLookStart(t.clientX, t.clientY, t.identifier)
    },
    { passive: true },
  )
  domElement.addEventListener(
    'touchmove',
    (e) => {
      if (lookId == null || paused || dead || !useMobile) return
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId || !lookLast) continue
        const dx = t.clientX - lookLast.x
        const dy = t.clientY - lookLast.y
        lookLast = { x: t.clientX, y: t.clientY }
        // keep in sync with PointerLockControls (quaternion via YXZ euler)
        lookEuler.setFromQuaternion(camera.quaternion)
        lookEuler.y -= dx * LOOK_SENS * 1.35
        lookEuler.x -= dy * LOOK_SENS * 1.35
        lookEuler.x = Math.max(-1.4, Math.min(1.4, lookEuler.x))
        camera.quaternion.setFromEuler(lookEuler)
      }
    },
    { passive: true },
  )
  const endLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) {
        lookId = null
        lookLast = null
      }
    }
  }
  domElement.addEventListener('touchend', endLook)
  domElement.addEventListener('touchcancel', endLook)

  camera.position.set(0, EYE, 12)

  const updateHpUi = () => {
    renderHearts(document.getElementById('hud-hp'), hp, MAX_HP)
  }
  updateHpUi()

  function update(dt) {
    if (hurtCD > 0) hurtCD -= dt
    if (hurtFlash > 0) {
      hurtFlash = Math.max(0, hurtFlash - dt * 2.8)
      if (hurtEl) hurtEl.style.opacity = String(Math.min(1, hurtFlash))
    } else if (hurtEl && hurtEl.style.opacity !== '0') {
      hurtEl.style.opacity = '0'
    }

    if (kick > 0) {
      kick = Math.max(0, kick - dt * 8)
      gun.rotation.x = -kick * 0.35
      gun.position.z = kick * 0.08
    } else {
      gun.rotation.x = 0
      gun.position.z = 0
    }
    if (muzzleT > 0) {
      muzzleT -= dt
      if (muzzleT <= 0) flash.visible = false
    }

    if (!isActive()) return

    const before = camera.position.clone()
    const dist = SPEED * dt

    let fx = 0
    let fz = 0
    if (keys.w) fz += 1
    if (keys.s) fz -= 1
    if (keys.a) fx -= 1
    if (keys.d) fx += 1
    fx += stick.x
    fz += stick.y
    const mag = Math.hypot(fx, fz)
    if (mag > 1) {
      fx /= mag
      fz /= mag
    }
    if (mag > 0.05) {
      controls.moveForward(fz * dist)
      controls.moveRight(fx * dist)
    }

    const resolved = resolveWorldXZ(camera.position.x, camera.position.z, 0.45)
    camera.position.x = resolved.x
    camera.position.z = resolved.z
    if (
      Math.abs(camera.position.x - before.x) < 1e-6 &&
      Math.abs(camera.position.z - before.z) < 1e-6 &&
      mag > 0.05
    ) {
      camera.position.x = before.x
      camera.position.z = resolveWorldXZ(before.x, camera.position.z, 0.45).z
      camera.position.x = resolveWorldXZ(camera.position.x, before.z, 0.45).x
    }
    camera.position.y = EYE
  }

  return {
    controls,
    update,
    get isTouch() {
      return useMobile
    },
    setSpawn(v) {
      camera.position.copy(v)
      camera.position.y = EYE
    },
    setShootHandler(fn) {
      onShoot = fn
    },
    setPauseHandler(fn) {
      onPauseRequest = fn
    },
    setPaused(v) {
      paused = v
      if (v) {
        if (controls.isLocked) controls.unlock()
        mobilePlaying = false
        stick.x = 0
        stick.y = 0
        setStickVisual(0, 0)
        hideMobileUi()
      } else if (useMobile) {
        beginMobilePlay()
      }
    },
    takeDamage(n = 1) {
      if (dead || paused || hurtCD > 0) return false
      hp = Math.max(0, hp - n)
      hurtCD = 1.0
      hurtFlash = 1
      if (hurtEl) hurtEl.style.opacity = '1'
      updateHpUi()
      if (hp <= 0) {
        dead = true
        if (controls.isLocked) controls.unlock()
        mobilePlaying = false
        hideMobileUi()
        return true
      }
      return false
    },
    heal(n = 5) {
      if (dead) return false
      const before = hp
      hp = Math.min(MAX_HP, hp + n)
      updateHpUi()
      return hp > before
    },
    resetHp() {
      hp = MAX_HP
      dead = false
      hurtCD = 0
      hurtFlash = 0
      if (hurtEl) hurtEl.style.opacity = '0'
      updateHpUi()
    },
    isDead: () => dead,
    getHp: () => hp,
    MAX_HP,
  }
}
