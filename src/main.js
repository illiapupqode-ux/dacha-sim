import * as THREE from 'three'
import { buildWorld } from './world.js'
import { createPlayer } from './player.js'
import { createZombieSystem } from './zombies.js'
import { createNightCycle } from './night.js'
import { createHealthPickup } from './pickup.js'
import { createAmmoSystem } from './ammo.js'
import { getDifficulty, getDifficultyId, setDifficulty, getCoef } from './difficulty.js'
import { createAudio } from './audio.js'
import { renderBullets } from './hud.js'
import { MAX_AMMO } from './ammo.js'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 36)
scene.add(camera)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const { spawn, ambient, sun, windowMats, windowLights } = buildWorld(scene)
const player = createPlayer(camera, renderer.domElement)
player.setSpawn(spawn)
camera.lookAt(0, 3, -5)

const menu = document.getElementById('menu')
const menuTitle = document.getElementById('menu-title')
const menuSub = document.getElementById('menu-sub')
const menuStats = document.getElementById('menu-stats')
const hint = document.getElementById('hint')

let paused = false
let gameOver = false

let ammo = null
const updateHud = () => {
  if (!ammo) return
  renderBullets(document.getElementById('hud-ammo'), ammo.getAmmo(), MAX_AMMO)
}

let toastTimer = 0
function showToast(text, ms = 2200) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), ms)
}

ammo = createAmmoSystem(scene, () => camera.position, {
  onChange: () => updateHud(),
})

const audio = createAudio()
const unlockAudio = () => {
  audio.resume()
  if (audio.isMusicEnabled()) audio.startMusic()
}
window.addEventListener('pointerdown', unlockAudio, { once: true })
window.addEventListener('keydown', unlockAudio, { once: true })

function syncAudioButtons() {
  const m = document.getElementById('btn-music')
  const s = document.getElementById('btn-sfx')
  if (m) {
    const on = audio.isMusicEnabled()
    m.textContent = on ? 'Music: On' : 'Music: Off'
    m.classList.toggle('off', !on)
  }
  if (s) {
    const on = audio.isSfxEnabled()
    s.textContent = on ? 'Effects: On' : 'Effects: Off'
    s.classList.toggle('off', !on)
  }
}
syncAudioButtons()

document.getElementById('btn-music')?.addEventListener('click', () => {
  audio.setMusicEnabled(!audio.isMusicEnabled())
  syncAudioButtons()
})
document.getElementById('btn-sfx')?.addEventListener('click', () => {
  audio.setSfxEnabled(!audio.isSfxEnabled())
  syncAudioButtons()
})

const zombies = createZombieSystem(scene, () => camera.position, updateHud, {
  onTerentyevHit: () => showToast("You cant kill Terentevs!"),
  onKill: () => {
    ammo.onKill()
    audio.playMobDeath()
  },
})
const night = createNightCycle({
  scene,
  ambient,
  sun,
  windowMats,
  windowLights,
  getWave: () => zombies.getWave(),
  startAtNight: false,
})
const healthPickup = createHealthPickup(scene, () => camera.position, {
  heal: (n) => player.heal(n),
  getNight: () => night.getNight(),
  getWave: () => zombies.getWave(),
})
updateHud()

function syncDiffButtons() {
  const id = getDifficultyId()
  document.querySelectorAll('#diff-row [data-diff]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-diff') === id)
  })
}

document.getElementById('diff-row')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-diff]')
  if (!btn) return
  setDifficulty(btn.getAttribute('data-diff'))
  syncDiffButtons()
  if (menuStats) {
    const d = getDifficulty()
    menuStats.textContent = `Kills: ${zombies.getKills()} · Wave: ${zombies.getWave()} · ${d.label} ×${getCoef()}`
  }
})
syncDiffButtons()

player.setShootHandler(() => {
  if (paused || gameOver) return false
  if (!ammo.tryFire()) {
    showToast('Empty!', 900)
    return false
  }
  audio.playShoot()
  zombies.tryShoot(camera)
  return true
})

function openMenu(kind = 'pause') {
  paused = true
  gameOver = kind === 'dead'
  zombies.setFrozen(true)
  player.setPaused(true)
  audio.setPaused(true)
  menuTitle.textContent = kind === 'dead' ? 'You died' : 'Paused'
  menuSub.textContent =
    kind === 'dead' ? 'Zombies got you' : 'Spawn & mobs frozen — ESC / Resume'
  const d = getDifficulty()
  menuStats.textContent = `Kills: ${zombies.getKills()} · Wave: ${zombies.getWave()} · ${d.label} ×${getCoef()}`
  syncDiffButtons()
  syncAudioButtons()
  menu?.classList.add('open')
  hint?.classList.add('hidden')
  document.getElementById('btn-resume').style.display = kind === 'dead' ? 'none' : 'block'
}

function closeMenu() {
  if (gameOver) return
  paused = false
  zombies.setFrozen(false)
  player.setPaused(false)
  audio.setPaused(false)
  menu?.classList.remove('open')
  if (!player.isTouch) player.controls.lock()
}

function restart() {
  gameOver = false
  paused = false
  zombies.setFrozen(false)
  player.resetHp()
  player.setSpawn(spawn)
  zombies.reset()
  night.reset()
  healthPickup.reset()
  ammo.reset()
  player.setPaused(false)
  audio.setPaused(false)
  if (audio.isMusicEnabled()) audio.startMusic()
  menu?.classList.remove('open')
  document.getElementById('btn-resume').style.display = 'block'
  if (!player.isTouch) player.controls.lock()
}

player.setPauseHandler((action = 'toggle') => {
  if (gameOver) return
  if (action === 'open') {
    if (!paused) openMenu('pause')
    return
  }
  if (paused) closeMenu()
  else openMenu('pause')
})

document.getElementById('btn-resume')?.addEventListener('click', () => closeMenu())
document.getElementById('btn-restart')?.addEventListener('click', () => restart())

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const clock = new THREE.Clock()

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05)
  player.update(dt)

  zombies.update(dt, {
    paused: paused || gameOver,
    onPlayerHit: () => {
      if (player.takeDamage(1)) {
        zombies.setFrozen(true)
        openMenu('dead')
        return true
      }
      return false
    },
  })

  const n = night.update(paused || gameOver ? 0 : dt)
  zombies.setNight(n)
  healthPickup.update(dt, { paused: paused || gameOver })
  ammo.update(dt, { paused: paused || gameOver })

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

tick()
