import * as THREE from 'three'
import {
  PLOT_W,
  PLOT_D,
  PLOT_Z0,
  SIDE_PLOT_W,
  SIDE_GAP_HALF,
  SIDE_GAP_Z,
  SIDE_HOUSE,
  FATHER_HOUSE,
  TERENTYEV_HOUSE,
  TERENTYEV_BEDS,
  SPLIT_PLOT_W,
  FAR_PLOT_W,
  GATE_HALF,
  ZOMBIE_FENCE_SCALE,
  plotFrontZ,
  plotBackZ,
  sideLeftX,
  sideRightX,
  sideCenterX,
  splitLeftX,
  splitRightX,
  splitCenterX,
  zombieBackZ,
  zombieFrontZ,
  zombieCenterZ,
  zombieDepth,
  fatherCenterZ,
  fatherDepth,
  fatherFrontZ,
  fatherBackZ,
  farLeftX,
  farRightX,
  farCenterX,
  yardsRightX,
  insideAnyYard,
} from './collision.js'

const FOREST = 110

function makeMat(color, flat = true) {
  return new THREE.MeshLambertMaterial({ color, flatShading: flat })
}

function addBox(parent, w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMat(color),
  )
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addRoofQuad(house, mat, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  const thick = 0.12
  // slight downward offset for underside — approximate along Y
  const positions = new Float32Array([
    ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz,
    ax, ay - thick, az, bx, by - thick, bz, cx, cy - thick, cz, dx, dy - thick, dz,
  ])
  const idx = [
    0, 1, 2, 0, 2, 3,
    5, 4, 7, 5, 7, 6,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  house.add(mesh)
}

/**
 * Roof + attic only (above 2F). Does not define 2F height.
 * yAttic = top of 2F walls; atticRise = height of irregular attic above that.
 * y1F = top of first floor (flat roof over gas / steep rear landing).
 */
function addComplexRoof(house, W, D, y1F, yAttic, atticRise, color) {
  const overhang = 0.45
  const thirdW = W / 3
  const thirdD = D / 3
  const roofMat = makeMat(color)
  roofMat.side = THREE.DoubleSide
  const cap = 0x6a6e72
  const woodCol = 0x5a3d28

  // 1) flat roof over gas block at 1F
  const flatY = y1F + 0.08
  const gasX0 = -W / 2 - overhang * 0.3
  const gasX1 = -W / 2 + thirdW
  const gasZ0 = D / 2 - thirdD
  const gasZ1 = D / 2 + overhang
  addBox(
    house,
    gasX1 - gasX0,
    0.14,
    gasZ1 - gasZ0,
    color,
    (gasX0 + gasX1) / 2,
    flatY,
    (gasZ0 + gasZ1) / 2,
  )
  addBox(house, gasX1 - gasX0 + 0.08, 0.12, 0.08, cap, (gasX0 + gasX1) / 2, flatY + 0.1, gasZ1)
  addBox(house, 0.08, 0.12, gasZ1 - gasZ0, cap, gasX0, flatY + 0.1, (gasZ0 + gasZ1) / 2)

  // 2) main attic roof — ridge ‖ X, sits on 2F, steep rear drops to 1F behind
  const mainRidgeZ = -1.05
  const mainRidgeY = yAttic + atticRise
  const mainBackZ = -D / 2 - overhang
  const mainBackY = y1F
  const mainFrontZ = mainRidgeZ + 1.0
  const mainFrontY = yAttic + atticRise * 0.35
  const mainX0 = -W / 2 - overhang
  const mainX1 = W / 2 + overhang

  addRoofQuad(
    house, roofMat,
    mainX0, mainRidgeY, mainRidgeZ, mainX1, mainRidgeY, mainRidgeZ,
    mainX1, mainBackY, mainBackZ, mainX0, mainBackY, mainBackZ,
  )
  addRoofQuad(
    house, roofMat,
    mainX0, mainRidgeY, mainRidgeZ, mainX1, mainRidgeY, mainRidgeZ,
    mainX1, mainFrontY, mainFrontZ, mainX0, mainFrontY, mainFrontZ,
  )
  addBox(house, mainX1 - mainX0 + 0.1, 0.12, 0.2, cap, 0, mainRidgeY + 0.04, mainRidgeZ)

  // left cover: roof over 2F behind gas (wall at gasZ0) — was uncovered
  const leftRoofX1 = gasX1 + 0.15
  addRoofQuad(
    house, roofMat,
    mainX0, mainRidgeY, mainRidgeZ,
    leftRoofX1, mainRidgeY, mainRidgeZ,
    leftRoofX1, yAttic, gasZ0 + overhang * 0.25,
    mainX0, yAttic, gasZ0 + overhang * 0.25,
  )
  // small eave cap along that front edge
  addBox(
    house,
    leftRoofX1 - mainX0,
    0.1,
    0.16,
    cap,
    (mainX0 + leftRoofX1) / 2,
    yAttic + 0.05,
    gasZ0 + overhang * 0.25,
  )

  // attic side fills ONLY above 2F top (no penetration into 2F walls)
  const z2Back = mainRidgeZ - 0.15
  const atticSideMat = makeMat(woodCol)
  atticSideMat.side = THREE.DoubleSide
  const addAtticSide = (x, zFrontLimit) => {
    const over = new THREE.Shape()
    over.moveTo(z2Back, 0)
    over.lineTo(mainRidgeZ, atticRise)
    over.lineTo(mainRidgeZ + 0.95, atticRise * 0.25)
    over.lineTo(zFrontLimit, 0)
    over.closePath()
    const m = new THREE.Mesh(new THREE.ShapeGeometry(over), atticSideMat)
    m.rotation.y = -Math.PI / 2
    m.position.set(x, yAttic, 0)
    m.castShadow = true
    house.add(m)

    const behind = new THREE.Shape()
    behind.moveTo(z2Back, 0)
    behind.lineTo(mainRidgeZ, atticRise)
    behind.lineTo(-D / 2, y1F - yAttic)
    behind.lineTo(z2Back, y1F - yAttic)
    behind.closePath()
    const m2 = new THREE.Mesh(new THREE.ShapeGeometry(behind), atticSideMat)
    m2.rotation.y = -Math.PI / 2
    m2.position.set(x, yAttic, 0)
    m2.castShadow = true
    house.add(m2)
  }
  // left: attic only where 2F exists (behind gas); right: full to front
  addAtticSide(-W / 2 - 0.05, gasZ0)
  addAtticSide(W / 2 + 0.05, D / 2 - 0.1)

  // 3) cross-gable attic over front-right (ridge ‖ Z), eaves on 2F top
  const crossX0 = -W / 2 + thirdW * 0.85
  const crossX1 = W / 2 + overhang * 0.85
  const crossZ0 = mainRidgeZ + 0.25
  const crossZ1 = D / 2 + overhang
  const crossRidgeX = (crossX0 + crossX1) / 2 + (crossX1 - crossX0) * 0.06
  const crossRidgeY = yAttic + atticRise * 0.85
  const crossEaveY = yAttic

  addRoofQuad(
    house, roofMat,
    crossRidgeX, crossRidgeY, crossZ0, crossRidgeX, crossRidgeY, crossZ1,
    crossX0, crossEaveY, crossZ1, crossX0, crossEaveY, crossZ0,
  )
  addRoofQuad(
    house, roofMat,
    crossRidgeX, crossRidgeY, crossZ0, crossRidgeX, crossRidgeY, crossZ1,
    crossX1, crossEaveY, crossZ1, crossX1, crossEaveY, crossZ0,
  )
  addBox(
    house,
    0.18,
    0.12,
    crossZ1 - crossZ0 + 0.1,
    cap,
    crossRidgeX,
    crossRidgeY + 0.04,
    (crossZ0 + crossZ1) / 2,
  )

  // attic front gable only (above 2F), inset under roof
  const gInset = 0.22
  const gableShape = new THREE.Shape()
  gableShape.moveTo(crossX0 + gInset, 0.02)
  gableShape.lineTo(crossRidgeX, crossRidgeY - yAttic - 0.06)
  gableShape.lineTo(crossX1 - gInset, 0.02)
  gableShape.closePath()
  const gableGeo = new THREE.ShapeGeometry(gableShape)
  const gableMat = makeMat(woodCol)
  gableMat.side = THREE.DoubleSide
  const gableF = new THREE.Mesh(gableGeo, gableMat)
  gableF.position.set(0, yAttic, D / 2 + 0.03)
  gableF.castShadow = true
  house.add(gableF)

  return { mainRidgeZ, thirdW, thirdD }
}

function buildHouse(scene) {
  const house = new THREE.Group()
  house.position.set(0, 0, -5)

  const W = 7.2 * 1.1
  const D = 5.6 * 1.2 * 1.1
  const socleH = 1.05
  const brickH = 2.4
  const woodH = 2.4 // 2F story height (= 1F), attic is separate above
  const atticRise = 1.35 // irregular attic above 2F — not part of woodH
  const yBrick = socleH
  const y1F = yBrick + brickH // top of 1F
  const yWood = y1F // start of 2F
  const yAttic = yWood + woodH // top of 2F / attic floor

  // door on right wall (+X), left side — bottom at ground
  const doorH = 2.1
  const doorW = 1.15
  const doorZ = D / 2 - doorW / 2 - 0.35
  const doorGap = doorW + 0.12

  // high concrete socle with doorway cutout on +X
  const sW = W + 0.3
  const sD = D + 0.3
  const socleCol = 0x8a8d88
  // core under walls (stops short of +X face so door niche is clear)
  addBox(house, W - 0.2, socleH, D, socleCol, -0.1, socleH / 2, 0)
  // +X overhang split around door
  const overX = W / 2 + 0.075
  const overT = 0.15
  const zBack = (-sD / 2 + (doorZ - doorGap / 2)) / 2
  const zBackLen = doorZ - doorGap / 2 - (-sD / 2)
  const zFront = ((doorZ + doorGap / 2) + sD / 2) / 2
  const zFrontLen = sD / 2 - (doorZ + doorGap / 2)
  if (zBackLen > 0.05) {
    addBox(house, overT, socleH, zBackLen, socleCol, overX, socleH / 2, zBack)
  }
  if (zFrontLen > 0.05) {
    addBox(house, overT, socleH, zFrontLen, socleCol, overX, socleH / 2, zFront)
  }
  // other sides overhang
  addBox(house, overT, socleH, sD, socleCol, -W / 2 - 0.075, socleH / 2, 0)
  addBox(house, sW, socleH, overT, socleCol, 0, socleH / 2, D / 2 + 0.075)
  addBox(house, sW, socleH, overT, socleCol, 0, socleH / 2, -D / 2 - 0.075)

  // 1F brick with doorway gap on +X
  // main brick mass (inset from +X)
  addBox(house, W - 0.15, brickH, D, 0xc2a888, -0.075, yBrick + brickH / 2, 0)
  // +X brick panels around door
  const brickX = W / 2 - 0.075
  if (zBackLen > 0.05) {
    addBox(house, 0.15, brickH, zBackLen, 0xc2a888, brickX, yBrick + brickH / 2, zBack)
  }
  if (zFrontLen > 0.05) {
    addBox(house, 0.15, brickH, zFrontLen, 0xc2a888, brickX, yBrick + brickH / 2, zFront)
  }
  // lintel above door in brick
  const lintelH = yBrick + brickH - doorH
  if (lintelH > 0.05) {
    addBox(
      house,
      0.15,
      lintelH,
      doorGap,
      0xc2a888,
      brickX,
      doorH + lintelH / 2,
      doorZ,
    )
  }

  for (let row = 0; row < 8; row++) {
    const y = yBrick + 0.28 + row * 0.28
    if (y < doorH) continue
    addBox(house, W + 0.02, 0.04, D + 0.02, 0xb09474, 0, y, 0)
  }

  // 2F = full story walls, L-footprint around gas (no 2F over gas corner)
  const mainRidgeZ = -1.05
  const thirdW = W / 3
  const thirdD = D / 3
  const woodCol = 0x5a3d28
  const woodLine = 0x4a3220
  const wallT = 0.16
  const z2Front = D / 2 - 0.05
  const z2Back = mainRidgeZ - 0.15
  const gasZ0 = D / 2 - thirdD // front of left facade clears gas
  const x2L = -W / 2 + thirdW // inner edge next to gas
  const x2R = W / 2
  const xOuterL = -W / 2
  const y2 = yWood + woodH / 2

  // front wall — right of gas (main front)
  const frontW = x2R - x2L
  addBox(house, frontW, woodH, wallT, woodCol, (x2L + x2R) / 2, y2, z2Front)
  // front wall behind gas block (closes 2F above flat roof edge)
  const gasFrontW = x2L - xOuterL
  addBox(
    house,
    gasFrontW,
    woodH,
    wallT,
    woodCol,
    (xOuterL + x2L) / 2,
    y2,
    gasZ0,
  )
  // back wall of 2F (full 2F width including over left outer)
  addBox(house, x2R - xOuterL, woodH, wallT, woodCol, (xOuterL + x2R) / 2, y2, z2Back)

  // left OUTER wall (−X): only behind gas (along left facade)
  const leftOuterD = gasZ0 - z2Back
  if (leftOuterD > 0.1) {
    addBox(
      house,
      wallT,
      woodH,
      leftOuterD,
      woodCol,
      xOuterL - 0.02,
      y2,
      (gasZ0 + z2Back) / 2,
    )
  }
  // left RETURN wall facing gas courtyard (at x2L, front third)
  const leftReturnD = z2Front - gasZ0
  if (leftReturnD > 0.1) {
    addBox(
      house,
      wallT,
      woodH,
      leftReturnD,
      woodCol,
      x2L,
      y2,
      (z2Front + gasZ0) / 2,
    )
  }

  // right wall (+X) full 2F depth — wood above door
  addBox(
    house,
    wallT,
    woodH,
    z2Front - z2Back,
    woodCol,
    x2R + 0.02,
    y2,
    (z2Front + z2Back) / 2,
  )

  // log courses (stay on wall faces, no overlap into gas)
  for (let i = 0; i < 6; i++) {
    const y = yWood + 0.22 + i * 0.38
    addBox(house, frontW - 0.05, 0.06, 0.04, woodLine, (x2L + x2R) / 2, y, z2Front + 0.1)
    addBox(house, gasFrontW - 0.05, 0.06, 0.04, woodLine, (xOuterL + x2L) / 2, y, gasZ0 + 0.1)
    addBox(house, 0.04, 0.06, z2Front - z2Back - 0.05, woodLine, x2R + 0.12, y, (z2Front + z2Back) / 2)
    if (leftOuterD > 0.1) {
      addBox(house, 0.04, 0.06, leftOuterD - 0.05, woodLine, xOuterL - 0.12, y, (gasZ0 + z2Back) / 2)
    }
  }

  addBox(house, 0.1, doorH, doorW, 0x3b2416, W / 2 + 0.02, doorH / 2, doorZ)

  const frameW = 0xe8e6e0
  const windowMats = []
  const windowLights = []
  const addGlass = (w, h, d, x, y, z) => {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x9eb8c8,
      emissive: 0xffb300,
      emissiveIntensity: 0,
      flatShading: true,
    })
    windowMats.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.userData.isWindow = true
    mesh.castShadow = false
    mesh.receiveShadow = false
    house.add(mesh)
    return mesh
  }
  const addWindowLight = (x, y, z, ox, oy, oz) => {
    // Spot aimed outdoors — avoids black self-shadow ring on the facade/frame
    const light = new THREE.SpotLight(0xffc078, 0, 20, Math.PI / 2.6, 0.45, 1.25)
    const sx = Math.sign(ox) || 0
    const sz = Math.sign(oz) || 0
    light.position.set(x + ox * 0.15, y, z + oz * 0.15)
    light.target.position.set(x + sx * 4 + ox, y - 1.2, z + sz * 4 + oz)
    light.castShadow = true
    light.shadow.mapSize.set(512, 512)
    light.shadow.camera.near = 0.4
    light.shadow.camera.far = 22
    light.shadow.bias = -0.0008
    light.shadow.normalBias = 0.04
    house.add(light)
    house.add(light.target)
    windowLights.push(light)
    return light
  }

  // front 1F: white window, 3×2 panes, aspect 1:2 then −30% height
  {
    const ww = 1.05
    const wh = ww * 2 * 0.7
    const x = 0
    const y = yBrick + brickH * 0.55
    const z = D / 2 + 0.06
    addBox(house, ww + 0.12, wh + 0.12, 0.1, frameW, x, y, z)
    const pw = (ww - 0.06) / 2
    const ph = (wh - 0.08) / 3
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        addGlass(
          pw,
          ph,
          0.06,
          x - ww / 4 + col * (ww / 2),
          y + wh / 2 - 0.04 - ph / 2 - row * (ph + 0.03),
          z + 0.06,
        )
      }
    }
    addBox(house, 0.05, wh, 0.04, frameW, x, y, z + 0.08)
    for (let r = 1; r < 3; r++) {
      addBox(house, ww, 0.05, 0.04, frameW, x, y + wh / 2 - r * (wh / 3), z + 0.08)
    }
    addWindowLight(x, y, z, 0, 0, 1)
  }

  // T-window: top horizontal pane + two vertical below
  const addTWindow = (x, y, z, axis) => {
    const ww = 1.15
    const wh = 1.25
    const along = axis === 'x' // wall faces ±X → window extends in Z
    // lighter frames so night light doesn't read as a black border
    const frameCol = along ? 0x6a6a68 : 0x6a6a68
    if (along) {
      addBox(house, 0.1, wh + 0.1, ww + 0.1, frameCol, x, y, z)
      addGlass(0.06, wh * 0.32, ww - 0.08, x + Math.sign(x || 0.01) * 0.05, y + wh * 0.28, z)
      addGlass(0.06, wh * 0.52, ww * 0.42, x + Math.sign(x || 0.01) * 0.05, y - wh * 0.18, z - ww * 0.24)
      addGlass(0.06, wh * 0.52, ww * 0.42, x + Math.sign(x || 0.01) * 0.05, y - wh * 0.18, z + ww * 0.24)
      addBox(house, 0.04, 0.05, ww - 0.08, 0x8a8a88, x + Math.sign(x || 0.01) * 0.07, y + wh * 0.08, z)
      addBox(house, 0.04, wh * 0.52, 0.05, 0x8a8a88, x + Math.sign(x || 0.01) * 0.07, y - wh * 0.18, z)
      addWindowLight(x, y, z, Math.sign(x || 0.01) * 1, 0, 0)
    } else {
      addBox(house, ww + 0.1, wh + 0.1, 0.1, frameCol, x, y, z)
      addGlass(ww - 0.08, wh * 0.32, 0.06, x, y + wh * 0.28, z + Math.sign(z || 0.01) * 0.05)
      addGlass(ww * 0.42, wh * 0.52, 0.06, x - ww * 0.24, y - wh * 0.18, z + Math.sign(z || 0.01) * 0.05)
      addGlass(ww * 0.42, wh * 0.52, 0.06, x + ww * 0.24, y - wh * 0.18, z + Math.sign(z || 0.01) * 0.05)
      addBox(house, ww - 0.08, 0.05, 0.04, 0x8a8a88, x, y + wh * 0.08, z + Math.sign(z || 0.01) * 0.07)
      addBox(house, 0.05, wh * 0.52, 0.04, 0x8a8a88, x, y - wh * 0.18, z + Math.sign(z || 0.01) * 0.07)
      addWindowLight(x, y, z, 0, 0, Math.sign(z || 0.01) * 1)
    }
  }

  const winY = yBrick + brickH * 0.55
  // left wall (−X): two T-windows on brick only (shifted back, clear of gas block)
  addTWindow(-W / 2 - 0.06, winY, -D / 2 + 1.3, 'x')
  addTWindow(-W / 2 - 0.06, winY, -0.35, 'x')
  // back wall (−Z): two same T-windows
  addTWindow(-W / 4, winY, -D / 2 - 0.06, 'z')
  addTWindow(W / 4, winY, -D / 2 - 0.06, 'z')

  // left-front corner of 1F clad in gray gas block (front left 1/3 + left wall front 1/3)
  const gas = 0xa6abb0
  const gasLine = 0x8e949a
  const gasY = yBrick + brickH / 2
  // front face, left third
  addBox(house, thirdW, brickH, 0.12, gas, -W / 2 + thirdW / 2, gasY, D / 2 + 0.05)
  // left face, front third (wraps the corner)
  addBox(house, 0.12, brickH, thirdD, gas, -W / 2 - 0.05, gasY, D / 2 - thirdD / 2)
  // block courses
  for (let i = 0; i < 6; i++) {
    const y = yBrick + 0.2 + i * 0.38
    addBox(house, thirdW, 0.04, 0.04, gasLine, -W / 2 + thirdW / 2, y, D / 2 + 0.11)
    addBox(house, 0.04, 0.04, thirdD, gasLine, -W / 2 - 0.11, y, D / 2 - thirdD / 2)
  }
  // vertical joints on front
  for (let i = 1; i < 4; i++) {
    addBox(
      house,
      0.04,
      brickH,
      0.04,
      gasLine,
      -W / 2 + (thirdW * i) / 4,
      gasY,
      D / 2 + 0.11,
    )
  }
  // vertical joints on left
  for (let i = 1; i < 3; i++) {
    addBox(
      house,
      0.04,
      brickH,
      0.04,
      gasLine,
      -W / 2 - 0.11,
      gasY,
      D / 2 - (thirdD * i) / 3,
    )
  }

  addComplexRoof(house, W, D, y1F, yAttic, atticRise, 0x7a7e82)

  scene.add(house)
  return { house, windowMats, windowLights }
}

function buildFence(scene) {
  const fence = new THREE.Group()
  const postMat = makeMat(0x5c4030)
  const wireMat = makeMat(0x6b6358)
  const halfW = PLOT_W / 2
  const olekL = sideLeftX()
  const olekR = sideRightX()
  const olekMid = sideCenterX()
  const splitL = splitLeftX()
  const splitR = splitRightX()
  const farL = farLeftX()
  const farR = farRightX()
  const farMid = farCenterX()
  const frontZ = plotFrontZ()
  const backZ = plotBackZ()
  const divZ = zombieBackZ()
  const postH = 1.35 * 1.5
  const step = 2.2
  const gateHalf = GATE_HALF
  const gapHalf = SIDE_GAP_HALF
  const gapZ = SIDE_GAP_Z
  const wireYs = [0.3, 0.65, 1.0, 1.35, 1.7]

  const addPost = (x, z) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, postH, 6),
      postMat,
    )
    post.position.set(x, postH / 2, z)
    post.castShadow = true
    fence.add(post)
  }

  const addMeshPanel = (x0, z0, x1, z1) => {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    if (len < 0.2) return
    const midX = (x0 + x1) / 2
    const midZ = (z0 + z1) / 2
    const ang = Math.atan2(dx, dz)

    for (const y of wireYs) {
      const wire = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.025, len),
        wireMat,
      )
      wire.position.set(midX, y, midZ)
      wire.rotation.y = ang
      fence.add(wire)
    }
    const strandH = postH - 0.25
    const n = Math.max(2, Math.floor(len / 0.35))
    for (let i = 1; i < n; i++) {
      const t = i / n
      const x = x0 + dx * t
      const z = z0 + dz * t
      const strand = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, strandH, 0.02),
        wireMat,
      )
      strand.position.set(x, strandH / 2 + 0.12, z)
      fence.add(strand)
    }
  }

  // Wire yards — zombie paddock is a separate sealed board fence
  const edges = [
    { axis: 'x', z: frontZ, from: -halfW, to: -gateHalf },
    { axis: 'x', z: frontZ, from: gateHalf, to: halfW },
    { axis: 'x', z: backZ, from: -halfW, to: halfW },
    { axis: 'z', x: -halfW, from: backZ, to: frontZ },
    { axis: 'z', x: olekL, from: backZ, to: gapZ - gapHalf },
    { axis: 'z', x: olekL, from: gapZ + gapHalf, to: frontZ },
    { axis: 'x', z: frontZ, from: olekL, to: olekMid - gateHalf },
    { axis: 'x', z: frontZ, from: olekMid + gateHalf, to: olekR },
    { axis: 'x', z: backZ, from: olekL, to: olekR },
    // oleksandra ↔ father only (stops at zombie divider)
    { axis: 'z', x: splitL, from: backZ, to: gapZ - gapHalf },
    { axis: 'z', x: splitL, from: gapZ + gapHalf, to: divZ },
    { axis: 'x', z: backZ, from: splitL, to: splitR },
    // father ↔ far only (stops at zombie divider)
    { axis: 'z', x: farL, from: backZ, to: gapZ - gapHalf },
    { axis: 'z', x: farL, from: gapZ + gapHalf, to: divZ },
    { axis: 'x', z: frontZ, from: farL, to: farMid - gateHalf },
    { axis: 'x', z: frontZ, from: farMid + gateHalf, to: farR },
    { axis: 'x', z: backZ, from: farL, to: farR },
    { axis: 'z', x: farR, from: backZ, to: frontZ },
  ]

  for (const e of edges) {
    if (e.axis === 'x') {
      for (let x = e.from; x <= e.to + 0.01; x += step) {
        const px = Math.min(x, e.to)
        addPost(px, e.z)
      }
      addMeshPanel(e.from, e.z, e.to, e.z)
    } else {
      for (let z = e.from; z <= e.to + 0.01; z += step) {
        const pz = Math.min(z, e.to)
        addPost(e.x, pz)
      }
      addMeshPanel(e.x, e.from, e.x, e.to)
    }
  }

  addPost(-gateHalf, frontZ)
  addPost(gateHalf, frontZ)
  addPost(olekMid - gateHalf, frontZ)
  addPost(olekMid + gateHalf, frontZ)
  addPost(farMid - gateHalf, frontZ)
  addPost(farMid + gateHalf, frontZ)
  addPost(olekL, gapZ - gapHalf)
  addPost(olekL, gapZ + gapHalf)
  addPost(splitL, gapZ - gapHalf)
  addPost(splitL, gapZ + gapHalf)
  addPost(farL, gapZ - gapHalf)
  addPost(farL, gapZ + gapHalf)

  buildZombieBoardFence(fence)
  scene.add(fence)
  return fence
}

/** Sealed dark horizontal-board fence around ділянка зомбі (+30% height). */
function buildZombieBoardFence(parent) {
  const x0 = splitLeftX()
  const x1 = splitRightX()
  const z0 = zombieBackZ()
  const z1 = zombieFrontZ()
  const baseH = 1.35 * 1.5
  const postH = baseH * ZOMBIE_FENCE_SCALE
  const step = 2.0
  const postMat = makeMat(0x1a1410)
  const boardMat = makeMat(0x2a221c)
  const boardDark = makeMat(0x16120e)

  const addPost = (x, z) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, postH, 0.14),
      postMat,
    )
    post.position.set(x, postH / 2, z)
    post.castShadow = true
    parent.add(post)
  }

  const addBoardRun = (x0a, z0a, x1a, z1a) => {
    const dx = x1a - x0a
    const dz = z1a - z0a
    const len = Math.hypot(dx, dz)
    if (len < 0.15) return
    const midX = (x0a + x1a) / 2
    const midZ = (z0a + z1a) / 2
    const ang = Math.atan2(dx, dz)
    const boardH = 0.16
    const gap = 0.05
    const n = Math.max(4, Math.floor((postH - 0.2) / (boardH + gap)))
    for (let i = 0; i < n; i++) {
      const y = 0.18 + i * (boardH + gap) + boardH / 2
      if (y + boardH / 2 > postH - 0.08) break
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, boardH, len + 0.04),
        i % 2 ? boardDark : boardMat,
      )
      board.position.set(midX, y, midZ)
      board.rotation.y = ang
      board.castShadow = true
      board.receiveShadow = true
      parent.add(board)
    }
  }

  const edges = [
    { axis: 'x', z: z1, from: x0, to: x1 },
    { axis: 'x', z: z0, from: x0, to: x1 },
    { axis: 'z', x: x0, from: z0, to: z1 },
    { axis: 'z', x: x1, from: z0, to: z1 },
  ]

  for (const e of edges) {
    if (e.axis === 'x') {
      for (let x = e.from; x <= e.to + 0.01; x += step) addPost(Math.min(x, e.to), e.z)
      addBoardRun(e.from, e.z, e.to, e.z)
    } else {
      for (let z = e.from; z <= e.to + 0.01; z += step) addPost(e.x, Math.min(z, e.to))
      addBoardRun(e.x, e.from, e.x, e.to)
    }
  }
}

function buildBoardPile(scene) {
  const pile = new THREE.Group()
  // right of house, further from door toward the bare tree
  pile.position.set(7.4, 0, -7.2)
  pile.rotation.y = Math.PI / 2 + 0.1

  // same wood tones as 2F cladding
  const plankMat = [0x5a3d28, 0x4a3220, 0x6b4830, 0x503628]
  let y = 0.035
  for (let layer = 0; layer < 5; layer++) {
    const n = 6
    for (let i = 0; i < n; i++) {
      const w = 2.6 + (i % 3) * 0.45
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.065, 0.3),
        makeMat(plankMat[(layer + i) % plankMat.length]),
      )
      plank.position.set(
        (i - (n - 1) / 2) * 0.2,
        y,
        (layer % 2) * 0.14 - 0.12,
      )
      plank.rotation.y = (layer + i) * 0.02 - 0.05
      plank.rotation.z = (i - 2.5) * 0.012
      plank.castShadow = true
      pile.add(plank)
      y += 0.068
    }
  }

  scene.add(pile)
  return pile
}

function makeEvergreen() {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5),
    makeMat(0x5c4030),
  )
  trunk.position.y = 0.8
  trunk.castShadow = true
  tree.add(trunk)

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 6),
    makeMat(0x3d6b3a),
  )
  crown.position.y = 2.4
  crown.castShadow = true
  tree.add(crown)

  const crown2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.6, 6),
    makeMat(0x2f5a32),
  )
  crown2.position.y = 3.5
  crown2.castShadow = true
  tree.add(crown2)

  return tree
}

function makeBareTree() {
  const tree = new THREE.Group()
  const bark = makeMat(0x4a3a2e)

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 5.5, 6),
    bark,
  )
  trunk.position.y = 2.75
  trunk.castShadow = true
  tree.add(trunk)

  // Branch along local +Y; tip is at (0, len/2, 0) in branch space
  const addBranch = (parent, len, rx, ry, rz, r = 0.07, at = null) => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.55, r, len, 4),
      bark,
    )
    if (at) b.position.copy(at)
    else b.position.set(0, 0, 0)
    b.rotation.set(rx, ry, rz)
    b.translateY(len / 2)
    b.castShadow = true
    b.userData.len = len
    parent.add(b)
    return b
  }

  const tip = (b) => new THREE.Vector3(0, b.userData.len / 2, 0)

  // main limbs from trunk surface
  const L1 = addBranch(tree, 2.4, 0.9, 0.2, -1.1, 0.1, new THREE.Vector3(0.18, 4.2, 0.05))
  const L2 = addBranch(tree, 2.8, 1.0, -0.4, 1.0, 0.09, new THREE.Vector3(-0.18, 4.6, 0.08))
  const L3 = addBranch(tree, 2.0, 0.7, 0.5, -0.5, 0.08, new THREE.Vector3(0.08, 5.2, -0.1))
  const L4 = addBranch(tree, 1.8, 1.2, 0.1, 0.9, 0.08, new THREE.Vector3(-0.12, 3.6, 0.12))
  const L5 = addBranch(tree, 1.6, 0.5, -0.8, 0.3, 0.06, new THREE.Vector3(0.1, 5.5, 0.02))
  const L6 = addBranch(tree, 2.2, 0.85, 0.6, -0.7, 0.07, new THREE.Vector3(-0.15, 4.9, -0.12))
  const L7 = addBranch(tree, 1.5, 1.1, -0.3, -0.8, 0.06, new THREE.Vector3(0.2, 3.9, 0.05))
  const L8 = addBranch(tree, 1.3, 0.3, 0.2, 0.15, 0.05, new THREE.Vector3(0, 5.75, 0))

  // twigs parented to limb tips (no floating segments)
  addBranch(L1, 0.9, 0.7, 0.4, -0.5, 0.035, tip(L1))
  addBranch(L2, 1.0, 0.6, -0.5, 0.5, 0.035, tip(L2))
  addBranch(L3, 0.8, 0.5, 0.3, 0.35, 0.03, tip(L3))
  addBranch(L6, 0.85, 0.8, 0.2, 0.4, 0.03, tip(L6))
  addBranch(L5, 0.7, 0.4, -0.3, 0.2, 0.028, tip(L5))
  addBranch(L4, 0.75, 0.9, 0.15, -0.35, 0.03, tip(L4))
  addBranch(L8, 0.55, 0.35, 0.25, -0.2, 0.025, tip(L8))
  addBranch(L7, 0.65, 0.7, -0.25, 0.3, 0.028, tip(L7))

  return tree
}

function buildForest(scene) {
  const forest = new THREE.Group()
  const rng = (n) => {
    let x = Math.sin(n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  const place = (x, z, i) => {
    if (insideAnyYard(x, z, -2.5)) return
    const tree = makeEvergreen()
    const s = 0.85 + rng(i + 90) * 0.85
    tree.scale.setScalar(s)
    tree.position.set(x, 0, z)
    tree.rotation.y = rng(i + 7) * Math.PI
    forest.add(tree)
  }

  const rightEdge = yardsRightX()
  // dense belt just outside all yards
  let n = 0
  const nearGap = 3.2
  for (let x = -PLOT_W / 2 - 14; x <= rightEdge + 14; x += nearGap) {
    for (const z of [plotBackZ() - 4, plotBackZ() - 8, plotFrontZ() + 4, plotFrontZ() + 8]) {
      place(x + (rng(n) - 0.5) * 2, z + (rng(n + 1) - 0.5) * 2, n++)
    }
  }
  for (let z = plotBackZ() - 14; z <= plotFrontZ() + 14; z += nearGap) {
    for (const x of [
      -PLOT_W / 2 - 4,
      -PLOT_W / 2 - 8,
      rightEdge + 4,
      rightEdge + 8,
    ]) {
      place(x + (rng(n) - 0.5) * 2, z + (rng(n + 1) - 0.5) * 2, n++)
    }
  }

  // dense outer rings — scene ends in forest, not empty sky edge
  const half = FOREST / 2 - 2
  const outerStep = 3.2
  for (let ring = 0; ring < 5; ring++) {
    const r = half - ring * 3.4
    for (let x = -r; x <= r; x += outerStep) {
      place(x + (rng(n) - 0.5), -r + (rng(n + 3) - 0.5), n++)
      place(x + (rng(n) - 0.5), r + (rng(n + 4) - 0.5), n++)
    }
    for (let z = -r + outerStep; z <= r - outerStep; z += outerStep) {
      place(-r + (rng(n) - 0.5), z + (rng(n + 5) - 0.5), n++)
      place(r + (rng(n) - 0.5), z + (rng(n + 6) - 0.5), n++)
    }
  }

  // fill mid ring
  for (let i = 0; i < 90; i++) {
    const angle = rng(i) * Math.PI * 2
    const dist = 20 + rng(i + 40) * 16
    place(Math.cos(angle) * dist, Math.sin(angle) * dist, i + 200)
  }

  scene.add(forest)
  return forest
}

function buildBareTreeNearPlot(scene) {
  const tree = makeBareTree()
  // further back, near the rear-right plot corner
  // further back into the extended rear yard
  tree.position.set(8.4, 0, -16.5)
  tree.scale.setScalar(1.25)
  scene.add(tree)
  return tree
}

function buildGround(scene) {
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(FOREST, FOREST),
    makeMat(0x4a5c38, false),
  )
  dirt.rotation.x = -Math.PI / 2
  dirt.position.y = -0.02
  dirt.receiveShadow = true
  scene.add(dirt)

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT_W, PLOT_D),
    makeMat(0x5f8a45, false),
  )
  grass.rotation.x = -Math.PI / 2
  grass.position.set(0, 0.002, PLOT_Z0)
  grass.receiveShadow = true
  scene.add(grass)

  const grassMat = makeMat(0x5f8a45, false)
  const rimMat = makeMat(0x6a5a3e, false)
  const addYardPad = (w, d, cx, cz, yGrass = 0.002) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassMat)
    g.rotation.x = -Math.PI / 2
    g.position.set(cx, yGrass, cz)
    g.receiveShadow = true
    scene.add(g)
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6), rimMat)
    r.rotation.x = -Math.PI / 2
    r.position.set(cx, -0.005, cz)
    r.receiveShadow = true
    scene.add(r)
  }

  // oleksandra + zombie + father + far (my grass already above)
  addYardPad(SIDE_PLOT_W, PLOT_D, sideCenterX(), PLOT_Z0)
  addYardPad(SPLIT_PLOT_W, zombieDepth(), splitCenterX(), zombieCenterZ())
  addYardPad(SPLIT_PLOT_W, fatherDepth(), splitCenterX(), fatherCenterZ())
  addYardPad(FAR_PLOT_W, PLOT_D, farCenterX(), PLOT_Z0)

  // darker soil strip under my fence
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT_W + 0.6, PLOT_D + 0.6),
    rimMat,
  )
  rim.rotation.x = -Math.PI / 2
  rim.position.set(0, -0.005, PLOT_Z0)
  rim.receiveShadow = true
  scene.add(rim)

  // path from gate toward house, then to right-wall door
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 12),
    makeMat(0x8a7a55, false),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.01, 6)
  path.receiveShadow = true
  scene.add(path)
  const pathToDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 1.8),
    makeMat(0x8a7a55, false),
  )
  pathToDoor.rotation.x = -Math.PI / 2
  pathToDoor.position.set(3.2, 0.012, -2.2)
  pathToDoor.receiveShadow = true
  scene.add(pathToDoor)

  return { dirt, grass, path }
}

function buildMotorcycle(scene) {
  const bike = new THREE.Group()
  bike.position.set(-PLOT_W / 2 + 2.4, 0, plotFrontZ() - 3.0)
  bike.rotation.y = 0.55

  const red = makeMat(0xb71c1c)
  const redDark = makeMat(0x7f1010)
  const dark = makeMat(0x1a1a1a)
  const rubber = makeMat(0x111111)
  const chrome = makeMat(0xb0bec5)
  const leather = makeMat(0x3e2723)
  const amber = makeMat(0xffb300)

  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z)
    mesh.rotation.set(rx, ry, rz)
    mesh.castShadow = true
    bike.add(mesh)
    return mesh
  }

  // frame rails
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.35), chrome), 0.16, 0.48, -0.05)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.35), chrome), -0.16, 0.48, -0.05)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), chrome), 0, 0.42, 0.15, 0.35, 0, 0)

  // engine block
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.5), dark), 0, 0.45, 0.05)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.22), chrome), 0.22, 0.48, 0.05)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 6), chrome), 0.28, 0.35, -0.05, 0, 0, Math.PI / 2)

  // fuel tank
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.62), red), 0, 0.82, 0.12)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.5), redDark), 0, 0.98, 0.1)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), chrome), 0, 1.06, 0.2)

  // seat + tail
  add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.5), leather), 0, 0.78, -0.38)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.28), red), 0, 0.7, -0.72)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.08), makeMat(0xff1744)), 0, 0.72, -0.88)

  // front fender + fork
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), chrome), 0.14, 0.55, 0.62, 0.25, 0, 0)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), chrome), -0.14, 0.55, 0.62, 0.25, 0, 0)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.28), red), 0, 0.55, 0.78)

  // rear fender
  add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.35), redDark), 0, 0.58, -0.7)

  // wheels + discs + spokes hint
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12)
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10)
  ;[
    [0.72, 0.12],
    [-0.62, -0.08],
  ].forEach(([z, lean], i) => {
    add(new THREE.Mesh(wheelGeo, rubber), 0, 0.34, z, 0, 0, Math.PI / 2)
    add(new THREE.Mesh(rimGeo, chrome), 0, 0.34, z, 0, 0, Math.PI / 2)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 6), dark), 0, 0.34, z, 0, 0, Math.PI / 2)
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.03), chrome)
      add(spoke, 0, 0.34, z, 0, 0, (s * Math.PI) / 4 + lean)
    }
    if (i === 0) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), chrome), 0, 0.34, z + 0.02)
    }
  })

  // handlebars + grips + mirrors
  add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.05), chrome), 0, 1.02, 0.58)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), dark), 0.42, 1.02, 0.58)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), dark), -0.42, 1.02, 0.58)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), chrome), 0.38, 1.12, 0.55)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), chrome), 0.38, 1.22, 0.55)

  // headlight + dash
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), amber), 0, 0.78, 0.88, Math.PI / 2, 0, 0)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.12), dark), 0, 0.92, 0.7)

  // exhaust
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), chrome), 0.3, 0.28, -0.15, Math.PI / 2, 0.15, 0)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 6), dark), 0.32, 0.26, -0.55, Math.PI / 2, 0, 0)

  // kickstand
  add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), dark), 0.25, 0.2, -0.1, 0, 0, 0.5)

  scene.add(bike)
  return bike
}

/**
 * Tiny one-story green wooden cottage on stilts — middle of the side yard.
 * Door on the back (−Z); windows on the other three sides; night glow via mats/lights.
 */
function buildSideCottage(scene) {
  const cottage = new THREE.Group()
  cottage.position.set(SIDE_HOUSE.x, 0, SIDE_HOUSE.z)

  const W = SIDE_HOUSE.halfW * 2
  const D = SIDE_HOUSE.halfD * 2
  const stiltH = 0.55
  const wallH = 2.05
  const floorY = stiltH
  const roofRise = 0.75
  const green = 0x3f6e3a
  const greenDark = 0x2f522c
  const wood = 0x5a3d28
  const woodDark = 0x3b2416
  const frame = 0xe8e6e0

  // stilts instead of socle
  const inset = 0.22
  const postPositions = [
    [-W / 2 + inset, -D / 2 + inset],
    [W / 2 - inset, -D / 2 + inset],
    [-W / 2 + inset, D / 2 - inset],
    [W / 2 - inset, D / 2 - inset],
    [0, -D / 2 + inset],
    [0, D / 2 - inset],
  ]
  for (const [px, pz] of postPositions) {
    addBox(cottage, 0.12, stiltH, 0.12, wood, px, stiltH / 2, pz)
  }

  // floor deck
  addBox(cottage, W + 0.08, 0.1, D + 0.08, woodDark, 0, floorY, 0)

  // walls
  addBox(cottage, W, wallH, D, green, 0, floorY + wallH / 2, 0)
  // board courses
  for (let i = 0; i < 5; i++) {
    const y = floorY + 0.22 + i * 0.38
    addBox(cottage, W + 0.02, 0.05, 0.04, greenDark, 0, y, D / 2 + 0.03)
    addBox(cottage, W + 0.02, 0.05, 0.04, greenDark, 0, y, -D / 2 - 0.03)
    addBox(cottage, 0.04, 0.05, D + 0.02, greenDark, W / 2 + 0.03, y, 0)
    addBox(cottage, 0.04, 0.05, D + 0.02, greenDark, -W / 2 - 0.03, y, 0)
  }

  // door on back (−Z)
  const doorW = 0.72
  const doorH = 1.55
  addBox(cottage, doorW, doorH, 0.08, woodDark, 0, floorY + doorH / 2, -D / 2 - 0.04)
  addBox(cottage, 0.06, 0.06, 0.04, 0xc9a227, doorW * 0.28, floorY + doorH * 0.5, -D / 2 - 0.09)
  // short steps up to the stilts
  addBox(cottage, doorW + 0.25, 0.12, 0.35, wood, 0, 0.06, -D / 2 - 0.45)
  addBox(cottage, doorW + 0.15, 0.12, 0.32, wood, 0, 0.18, -D / 2 - 0.28)
  addBox(cottage, doorW + 0.08, 0.12, 0.28, wood, 0, 0.3, -D / 2 - 0.14)

  // simple gable roof
  const roofMat = makeMat(0x6a5a3e)
  roofMat.side = THREE.DoubleSide
  const overhang = 0.28
  const ridgeY = floorY + wallH + roofRise
  const eaveY = floorY + wallH + 0.05
  const xL = -W / 2 - overhang
  const xR = W / 2 + overhang
  const zF = D / 2 + overhang
  const zB = -D / 2 - overhang
  addRoofQuad(
    cottage,
    roofMat,
    xL, eaveY, zF,
    0, ridgeY, zF,
    0, ridgeY, zB,
    xL, eaveY, zB,
  )
  addRoofQuad(
    cottage,
    roofMat,
    0, ridgeY, zF,
    xR, eaveY, zF,
    xR, eaveY, zB,
    0, ridgeY, zB,
  )
  // sheathe attic gables (front + back)
  const gableShape = new THREE.Shape()
  gableShape.moveTo(-W / 2 + 0.02, 0.02)
  gableShape.lineTo(0, roofRise - 0.04)
  gableShape.lineTo(W / 2 - 0.02, 0.02)
  gableShape.closePath()
  const gableGeo = new THREE.ShapeGeometry(gableShape)
  const gableMat = makeMat(green)
  gableMat.side = THREE.DoubleSide
  const gableF = new THREE.Mesh(gableGeo, gableMat)
  gableF.position.set(0, floorY + wallH, D / 2 + 0.02)
  gableF.castShadow = true
  gableF.receiveShadow = true
  cottage.add(gableF)
  const gableB = new THREE.Mesh(gableGeo, gableMat)
  gableB.position.set(0, floorY + wallH, -D / 2 - 0.02)
  gableB.rotation.y = Math.PI
  gableB.castShadow = true
  gableB.receiveShadow = true
  cottage.add(gableB)
  // board lines on gables
  for (const gz of [D / 2 + 0.04, -D / 2 - 0.04]) {
    addBox(cottage, W * 0.55, 0.04, 0.03, greenDark, 0, floorY + wallH + roofRise * 0.28, gz)
    addBox(cottage, W * 0.28, 0.04, 0.03, greenDark, 0, floorY + wallH + roofRise * 0.52, gz)
  }

  const windowMats = []
  const windowLights = []
  const addGlass = (w, h, d, x, y, z) => {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x9eb8c8,
      emissive: 0xffb300,
      emissiveIntensity: 0,
      flatShading: true,
    })
    windowMats.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.userData.isWindow = true
    mesh.castShadow = false
    mesh.receiveShadow = false
    cottage.add(mesh)
    return mesh
  }
  const addWindowLight = (x, y, z, ox, oy, oz) => {
    const light = new THREE.SpotLight(0xffc078, 0, 12, Math.PI / 2.6, 0.45, 1.35)
    const sx = Math.sign(ox) || 0
    const sz = Math.sign(oz) || 0
    light.position.set(x + ox * 0.12, y, z + oz * 0.12)
    light.target.position.set(x + sx * 3 + ox, y - 0.8, z + sz * 3 + oz)
    light.castShadow = true
    light.shadow.mapSize.set(256, 256)
    light.shadow.camera.near = 0.3
    light.shadow.camera.far = 14
    light.shadow.bias = -0.0008
    light.shadow.normalBias = 0.04
    cottage.add(light)
    cottage.add(light.target)
    windowLights.push(light)
    return light
  }

  const winY = floorY + wallH * 0.55
  const ww = 0.55
  const wh = 0.7

  // front (+Z)
  addBox(cottage, ww + 0.1, wh + 0.1, 0.08, frame, 0, winY, D / 2 + 0.04)
  addGlass(ww * 0.42, wh * 0.42, 0.05, -ww * 0.22, winY + wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.42, wh * 0.42, 0.05, ww * 0.22, winY + wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.42, wh * 0.42, 0.05, -ww * 0.22, winY - wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.42, wh * 0.42, 0.05, ww * 0.22, winY - wh * 0.18, D / 2 + 0.08)
  addBox(cottage, 0.04, wh, 0.04, frame, 0, winY, D / 2 + 0.09)
  addBox(cottage, ww, 0.04, 0.04, frame, 0, winY, D / 2 + 0.09)
  addWindowLight(0, winY, D / 2, 0, 0, 1)

  // right (+X)
  addBox(cottage, 0.08, wh + 0.1, ww + 0.1, frame, W / 2 + 0.04, winY, 0.15)
  addGlass(0.05, wh * 0.42, ww * 0.42, W / 2 + 0.08, winY + wh * 0.18, 0.15 - ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, W / 2 + 0.08, winY + wh * 0.18, 0.15 + ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, W / 2 + 0.08, winY - wh * 0.18, 0.15 - ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, W / 2 + 0.08, winY - wh * 0.18, 0.15 + ww * 0.22)
  addBox(cottage, 0.04, wh, 0.04, frame, W / 2 + 0.09, winY, 0.15)
  addBox(cottage, 0.04, 0.04, ww, frame, W / 2 + 0.09, winY, 0.15)
  addWindowLight(W / 2, winY, 0.15, 1, 0, 0)

  // left (−X)
  addBox(cottage, 0.08, wh + 0.1, ww + 0.1, frame, -W / 2 - 0.04, winY, 0.15)
  addGlass(0.05, wh * 0.42, ww * 0.42, -W / 2 - 0.08, winY + wh * 0.18, 0.15 - ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, -W / 2 - 0.08, winY + wh * 0.18, 0.15 + ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, -W / 2 - 0.08, winY - wh * 0.18, 0.15 - ww * 0.22)
  addGlass(0.05, wh * 0.42, ww * 0.42, -W / 2 - 0.08, winY - wh * 0.18, 0.15 + ww * 0.22)
  addBox(cottage, 0.04, wh, 0.04, frame, -W / 2 - 0.09, winY, 0.15)
  addBox(cottage, 0.04, 0.04, ww, frame, -W / 2 - 0.09, winY, 0.15)
  addWindowLight(-W / 2, winY, 0.15, -1, 0, 0)

  scene.add(cottage)
  return { cottage, windowMats, windowLights }
}

/**
 * Father's one-story white house on stilts — along fence with Oleksandra.
 * Length 1.5× my house; door on +X; steep gable.
 */
function buildFatherHouse(scene) {
  const house = new THREE.Group()
  house.position.set(FATHER_HOUSE.x, 0, FATHER_HOUSE.z)

  const W = FATHER_HOUSE.halfW * 2
  const D = FATHER_HOUSE.halfD * 2
  const stiltH = 0.62
  const wallH = 2.35
  const floorY = stiltH
  const roofRise = 1.85
  const roofRiseTall = roofRise * 1.05
  const white = 0xf2f0ea
  const whiteTrim = 0xd8d4cc
  const lightBlue = 0x5b9fd4
  const blueTrim = 0x3d7eb0
  const wood = 0x5a3d28
  const woodDark = 0x3b2416
  const frame = 0x6a6860
  // door sits near +Z; far half (−Z) is light blue + taller roof
  const midZ = 0
  const halfD = D / 2

  // stilts along the long footprint
  const inset = 0.28
  const postXs = [-W / 2 + inset, 0, W / 2 - inset]
  const postZs = []
  const zStep = 2.4
  for (let z = -D / 2 + inset; z <= D / 2 - inset + 0.01; z += zStep) {
    postZs.push(Math.min(z, D / 2 - inset))
  }
  if (postZs[postZs.length - 1] < D / 2 - inset - 0.05) postZs.push(D / 2 - inset)
  for (const px of postXs) {
    for (const pz of postZs) {
      addBox(house, 0.14, stiltH, 0.14, wood, px, stiltH / 2, pz)
    }
  }

  addBox(house, W + 0.1, 0.12, D + 0.1, woodDark, 0, floorY, 0)
  // door half (white) + far half (light blue)
  addBox(house, W, wallH, halfD, white, 0, floorY + wallH / 2, halfD / 2)
  addBox(house, W, wallH, halfD, lightBlue, 0, floorY + wallH / 2, -halfD / 2)

  // trim courses per half
  for (let i = 0; i < 4; i++) {
    const y = floorY + 0.35 + i * 0.5
    addBox(house, W + 0.02, 0.04, 0.04, whiteTrim, 0, y, D / 2 + 0.03)
    addBox(house, W + 0.02, 0.04, 0.04, blueTrim, 0, y, -D / 2 - 0.03)
    addBox(house, 0.04, 0.04, halfD + 0.02, whiteTrim, W / 2 + 0.03, y, halfD / 2)
    addBox(house, 0.04, 0.04, halfD + 0.02, whiteTrim, -W / 2 - 0.03, y, halfD / 2)
    addBox(house, 0.04, 0.04, halfD + 0.02, blueTrim, W / 2 + 0.03, y, -halfD / 2)
    addBox(house, 0.04, 0.04, halfD + 0.02, blueTrim, -W / 2 - 0.03, y, -halfD / 2)
  }

  // door on +X (into father plot), opposite Oleksandra
  const doorW = 0.95
  const doorH = 1.85
  const doorZ = FATHER_HOUSE.doorLocalZ
  addBox(house, 0.08, doorH, doorW, woodDark, W / 2 + 0.04, floorY + doorH / 2, doorZ)
  addBox(house, 0.04, 0.06, 0.06, 0xc9a227, W / 2 + 0.1, floorY + doorH * 0.52, doorZ + doorW * 0.28)
  addBox(house, 0.4, 0.12, doorW + 0.3, wood, W / 2 + 0.55, 0.06, doorZ)
  addBox(house, 0.36, 0.12, doorW + 0.2, wood, W / 2 + 0.38, 0.2, doorZ)
  addBox(house, 0.3, 0.12, doorW + 0.12, wood, W / 2 + 0.22, 0.34, doorZ)

  // gable roof: far (−Z) half 5% taller
  const roofMat = makeMat(0x6a5a3e)
  roofMat.side = THREE.DoubleSide
  const overhang = 0.28
  const ridgeY = floorY + wallH + roofRise
  const ridgeYTall = floorY + wallH + roofRiseTall
  const eaveY = floorY + wallH + 0.06
  const xL = -W / 2 - overhang
  const xR = W / 2 + overhang
  const zF = D / 2 + overhang
  const zB = -D / 2 - overhang
  // white / door half
  addRoofQuad(house, roofMat, xL, eaveY, zF, 0, ridgeY, zF, 0, ridgeY, midZ, xL, eaveY, midZ)
  addRoofQuad(house, roofMat, 0, ridgeY, zF, xR, eaveY, zF, xR, eaveY, midZ, 0, ridgeY, midZ)
  // light-blue half — +5% roof
  addRoofQuad(house, roofMat, xL, eaveY, midZ, 0, ridgeYTall, midZ, 0, ridgeYTall, zB, xL, eaveY, zB)
  addRoofQuad(house, roofMat, 0, ridgeYTall, midZ, xR, eaveY, midZ, xR, eaveY, zB, 0, ridgeYTall, zB)

  const makeGable = (rise, color, z, flip) => {
    const shape = new THREE.Shape()
    shape.moveTo(-W / 2 + 0.02, 0.02)
    shape.lineTo(0, rise - 0.05)
    shape.lineTo(W / 2 - 0.02, 0.02)
    shape.closePath()
    const geo = new THREE.ShapeGeometry(shape)
    const mat = makeMat(color)
    mat.side = THREE.DoubleSide
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, floorY + wallH, z)
    if (flip) mesh.rotation.y = Math.PI
    mesh.castShadow = true
    house.add(mesh)
  }
  makeGable(roofRise, white, D / 2 + 0.02, false)
  makeGable(roofRiseTall, lightBlue, -D / 2 - 0.02, true)

  const windowMats = []
  const windowLights = []
  const addGlass = (w, h, d, x, y, z) => {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x9eb8c8,
      emissive: 0xffb300,
      emissiveIntensity: 0,
      flatShading: true,
    })
    windowMats.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.userData.isWindow = true
    mesh.castShadow = false
    mesh.receiveShadow = false
    house.add(mesh)
    return mesh
  }
  const addWindowLight = (x, y, z, ox, oy, oz) => {
    const light = new THREE.SpotLight(0xffc078, 0, 14, Math.PI / 2.6, 0.45, 1.3)
    const sx = Math.sign(ox) || 0
    const sz = Math.sign(oz) || 0
    light.position.set(x + ox * 0.12, y, z + oz * 0.12)
    light.target.position.set(x + sx * 3.5 + ox, y - 0.9, z + sz * 3.5 + oz)
    light.castShadow = true
    light.shadow.mapSize.set(256, 256)
    house.add(light)
    house.add(light.target)
    windowLights.push(light)
  }

  const winY = floorY + wallH * 0.55
  const ww = 0.7
  const wh = 0.85
  const placeWinZ = (localZ, faceX) => {
    const x = faceX < 0 ? -W / 2 - 0.04 : W / 2 + 0.04
    addBox(house, 0.08, wh + 0.1, ww + 0.1, frame, x, winY, localZ)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + Math.sign(faceX) * 0.05, winY + wh * 0.18, localZ - ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + Math.sign(faceX) * 0.05, winY + wh * 0.18, localZ + ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + Math.sign(faceX) * 0.05, winY - wh * 0.18, localZ - ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + Math.sign(faceX) * 0.05, winY - wh * 0.18, localZ + ww * 0.2)
    addWindowLight(x, winY, localZ, Math.sign(faceX), 0, 0)
  }

  // door side (+X): window near door + one on far half
  placeWinZ(doorZ - 1.7, 1)
  placeWinZ(-D * 0.28, 1)
  // Oleksandra side (−X)
  placeWinZ(-D * 0.28, -1)
  placeWinZ(D * 0.12, -1)
  // end windows (±Z)
  addBox(house, ww + 0.1, wh + 0.1, 0.08, frame, 0, winY, D / 2 + 0.04)
  addGlass(ww * 0.4, wh * 0.4, 0.05, -ww * 0.2, winY + wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, ww * 0.2, winY + wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, -ww * 0.2, winY - wh * 0.18, D / 2 + 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, ww * 0.2, winY - wh * 0.18, D / 2 + 0.08)
  addWindowLight(0, winY, D / 2, 0, 0, 1)

  addBox(house, ww + 0.1, wh + 0.1, 0.08, frame, 0, winY, -D / 2 - 0.04)
  addGlass(ww * 0.4, wh * 0.4, 0.05, -ww * 0.2, winY + wh * 0.18, -D / 2 - 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, ww * 0.2, winY + wh * 0.18, -D / 2 - 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, -ww * 0.2, winY - wh * 0.18, -D / 2 - 0.08)
  addGlass(ww * 0.4, wh * 0.4, 0.05, ww * 0.2, winY - wh * 0.18, -D / 2 - 0.08)
  addWindowLight(0, winY, -D / 2, 0, 0, -1)

  scene.add(house)
  return { house, windowMats, windowLights }
}

/** Apple tree — short trunk, round leafy crown, red apples. */
function makeAppleTree(seed = 1) {
  const tree = new THREE.Group()
  const bark = makeMat(0x6b4e32)
  const leaf = makeMat(0x4a8f3c)
  const leaf2 = makeMat(0x3d7a32)
  const apple = makeMat(0xd32f2f)
  const apple2 = makeMat(0xc62828)

  const trunkH = 1.55 + (seed % 3) * 0.12
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.16, trunkH, 6),
    bark,
  )
  trunk.position.y = trunkH / 2
  trunk.castShadow = true
  tree.add(trunk)

  // main crown blobs
  const crownY = trunkH + 0.55
  const blobs = [
    [0, crownY, 0, 1.15],
    [-0.55, crownY - 0.1, 0.25, 0.75],
    [0.5, crownY + 0.05, -0.2, 0.7],
    [0.15, crownY + 0.45, 0.35, 0.65],
    [-0.25, crownY + 0.35, -0.4, 0.6],
  ]
  blobs.forEach(([x, y, z, r], i) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 6, 5),
      i % 2 ? leaf : leaf2,
    )
    mesh.position.set(x, y, z)
    mesh.scale.set(1.05, 0.85, 1.0)
    mesh.castShadow = true
    tree.add(mesh)
  })

  // apples
  const fruit = [
    [0.55, crownY - 0.25, 0.2],
    [-0.45, crownY - 0.15, -0.15],
    [0.2, crownY + 0.15, 0.55],
    [-0.15, crownY - 0.35, 0.4],
    [0.35, crownY + 0.2, -0.45],
    [-0.55, crownY + 0.05, 0.35],
    [0.05, crownY - 0.45, -0.3],
  ]
  fruit.forEach(([x, y, z], i) => {
    if ((seed + i) % 4 === 0) return
    const a = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 5, 4),
      i % 2 ? apple : apple2,
    )
    a.position.set(x, y, z)
    a.castShadow = true
    tree.add(a)
  })

  return tree
}

/** Scattered apple trees across father's plot (no underlay soil). */
function buildFatherGarden(scene) {
  const orchard = new THREE.Group()
  const x0 = splitLeftX() + 2.2
  const x1 = splitRightX() - 2.0
  const z0 = fatherBackZ() + 2.5
  const z1 = fatherFrontZ() - 2.0

  const spots = [
    [0.18, 0.12], [0.42, 0.2], [0.68, 0.14],
    [0.28, 0.38], [0.55, 0.42], [0.78, 0.35],
    [0.15, 0.58], [0.48, 0.62], [0.72, 0.55],
    [0.32, 0.78], [0.6, 0.82], [0.82, 0.72],
  ]

  spots.forEach(([u, v], i) => {
    const x = x0 + u * (x1 - x0)
    const z = z0 + v * (z1 - z0)
    // keep clear of father's house footprint
    if (
      Math.abs(x - FATHER_HOUSE.x) < FATHER_HOUSE.halfW + 1.6 &&
      Math.abs(z - FATHER_HOUSE.z) < FATHER_HOUSE.halfD + 1.4
    ) {
      return
    }
    const tree = makeAppleTree(i + 2)
    tree.scale.setScalar(0.9 + (i % 3) * 0.08)
    tree.position.set(x, 0, z)
    tree.rotation.y = i * 1.1
    orchard.add(tree)
  })

  scene.add(orchard)
  return orchard
}

/** Vegetable beds on Тєрєнтьєв plot (behind the house). */
function buildTerentyevGarden(scene) {
  const garden = new THREE.Group()
  const soil = 0x5c4030
  const soilDark = 0x3e2a1e
  const leaf = 0x3d7a3a
  const leaf2 = 0x2e5c2c
  const flower = [0xe85d75, 0xf0c05a, 0xc77dff]

  const bedSizes = [
    { w: 2.8, d: 1.1 },
    { w: 2.6, d: 1.1 },
    { w: 2.8, d: 1.1 },
    { w: 2.6, d: 1.1 },
    { w: 5.2, d: 1.0 },
  ]

  TERENTYEV_BEDS.forEach((bed, bi) => {
    const { w, d } = bedSizes[bi] || { w: 2.6, d: 1.1 }
    addBox(garden, w, 0.12, d, soil, bed.x, 0.04, bed.z)
    addBox(garden, w + 0.12, 0.08, 0.08, soilDark, bed.x, 0.08, bed.z - d / 2)
    addBox(garden, w + 0.12, 0.08, 0.08, soilDark, bed.x, 0.08, bed.z + d / 2)
    const cols = Math.max(3, Math.floor(w / 0.45))
    for (let i = 0; i < cols; i++) {
      const px = bed.x - w / 2 + 0.3 + (i / Math.max(1, cols - 1)) * (w - 0.6)
      const h = 0.25 + (i % 3) * 0.08
      addBox(garden, 0.12, h, 0.12, i % 2 ? leaf : leaf2, px, 0.1 + h / 2, bed.z)
      if (i % 2 === 0) {
        addBox(garden, 0.1, 0.08, 0.1, flower[i % flower.length], px, 0.12 + h, bed.z)
      }
    }
  })

  const cx = TERENTYEV_HOUSE.x
  const cz = TERENTYEV_HOUSE.z - TERENTYEV_HOUSE.halfD - 3.2
  addBox(garden, 1.0, 0.04, 5.8, 0x8a7a55, cx, 0.02, cz + 0.1)
  addBox(garden, 5.6, 0.04, 0.7, 0x8a7a55, cx, 0.02, cz - 1.05)

  scene.add(garden)
  return garden
}

/** Stone statue: woman with an oar — father's garden. */
function buildWomanWithOarStatue(scene) {
  const statue = new THREE.Group()
  const cx = FATHER_HOUSE.x + FATHER_HOUSE.halfW + 4.2
  const cz = Math.min(FATHER_HOUSE.z + FATHER_HOUSE.halfD + 2.8, fatherFrontZ() - 2.5)
  statue.position.set(cx, 0, cz)
  statue.rotation.y = -0.55

  const stone = 0x9a9ea6
  const stoneDark = 0x6e737c
  const stoneLight = 0xb8bcc4

  // pedestal
  addBox(statue, 1.1, 0.22, 1.1, stoneDark, 0, 0.11, 0)
  addBox(statue, 0.85, 0.55, 0.85, stone, 0, 0.48, 0)

  // legs / skirt
  addBox(statue, 0.42, 0.85, 0.32, stone, 0, 1.15, 0)
  addBox(statue, 0.55, 0.55, 0.38, stoneLight, 0, 1.55, 0.02)

  // torso
  addBox(statue, 0.48, 0.7, 0.28, stone, 0, 2.15, 0)
  // head
  addBox(statue, 0.28, 0.34, 0.28, stoneLight, 0, 2.7, 0.02)
  // hair bun
  addBox(statue, 0.22, 0.16, 0.22, stoneDark, 0, 2.9, -0.06)

  // arms — left holds oar upright
  addBox(statue, 0.14, 0.14, 0.55, stone, -0.38, 2.2, 0.15, 0.4, 0, 0)
  addBox(statue, 0.14, 0.14, 0.5, stone, 0.4, 2.15, 0.05, -0.2, 0, 0)

  // oar
  const oar = new THREE.Group()
  oar.position.set(-0.42, 1.6, 0.35)
  oar.rotation.z = 0.15
  oar.rotation.x = -0.2
  addBox(oar, 0.07, 2.4, 0.07, stoneDark, 0, 1.1, 0)
  addBox(oar, 0.08, 0.55, 0.28, stone, 0, 2.35, 0)
  addBox(oar, 0.06, 0.12, 0.4, stoneLight, 0, 2.55, 0)
  statue.add(oar)

  scene.add(statue)
  return statue
}

/**
 * Terentyev one-story house on the street side of his plot:
 * low brick socle, brick walls, wooden attic.
 */
function buildTerentyevHouse(scene) {
  const house = new THREE.Group()
  house.position.set(TERENTYEV_HOUSE.x, 0, TERENTYEV_HOUSE.z)

  const W = TERENTYEV_HOUSE.halfW * 2
  const D = TERENTYEV_HOUSE.halfD * 2
  const socleH = 0.42
  const wallH = 2.45
  const atticH = 1.15
  const yWall = socleH
  const yAttic = socleH + wallH
  const brick = 0xb45a3c
  const brickDark = 0x8e422c
  const mortar = 0xc4a090
  const wood = 0x6b4a32
  const woodLine = 0x4a3220
  const socle = 0x8a8d88
  const roofCol = 0x5a5048
  const frame = 0xe8e6e0

  // low socle
  addBox(house, W + 0.25, socleH, D + 0.25, socle, 0, socleH / 2, 0)

  // brick body
  addBox(house, W, wallH, D, brick, 0, yWall + wallH / 2, 0)
  for (let i = 0; i < 6; i++) {
    const y = yWall + 0.28 + i * 0.38
    addBox(house, W + 0.02, 0.035, 0.04, mortar, 0, y, D / 2 + 0.03)
    addBox(house, W + 0.02, 0.035, 0.04, mortar, 0, y, -D / 2 - 0.03)
    addBox(house, 0.04, 0.035, D + 0.02, mortar, W / 2 + 0.03, y, 0)
    addBox(house, 0.04, 0.035, D + 0.02, mortar, -W / 2 - 0.03, y, 0)
  }
  for (let i = 1; i < 5; i++) {
    addBox(house, 0.04, wallH, 0.04, brickDark, -W / 2 + (W * i) / 5, yWall + wallH / 2, D / 2 + 0.04)
  }

  // door on street (+Z)
  const doorW = 1.0
  const doorH = 2.05
  addBox(house, doorW, doorH, 0.1, woodLine, 0.15, socleH + doorH / 2, D / 2 + 0.05)
  addBox(house, 0.06, 0.06, 0.05, 0xc9a227, doorW * 0.28, socleH + doorH * 0.5, D / 2 + 0.12)
  addBox(house, doorW + 0.35, 0.1, 0.55, socle, 0.15, 0.05, D / 2 + 0.55)

  // wooden attic mass + gable roof
  addBox(house, W - 0.1, atticH * 0.55, D - 0.1, wood, 0, yAttic + atticH * 0.28, 0)
  for (let i = 0; i < 3; i++) {
    const y = yAttic + 0.18 + i * 0.22
    addBox(house, W - 0.05, 0.04, 0.04, woodLine, 0, y, D / 2 - 0.02)
    addBox(house, W - 0.05, 0.04, 0.04, woodLine, 0, y, -D / 2 + 0.02)
  }

  const roofMat = makeMat(roofCol)
  roofMat.side = THREE.DoubleSide
  const overhang = 0.32
  const roofRise = 1.05
  const ridgeY = yAttic + atticH * 0.45 + roofRise
  const eaveY = yAttic + atticH * 0.45
  const xL = -W / 2 - overhang
  const xR = W / 2 + overhang
  const zF = D / 2 + overhang
  const zB = -D / 2 - overhang
  addRoofQuad(house, roofMat, xL, eaveY, zF, 0, ridgeY, zF, 0, ridgeY, zB, xL, eaveY, zB)
  addRoofQuad(house, roofMat, 0, ridgeY, zF, xR, eaveY, zF, xR, eaveY, zB, 0, ridgeY, zB)

  const gableShape = new THREE.Shape()
  gableShape.moveTo(-W / 2 + 0.04, 0.02)
  gableShape.lineTo(0, roofRise - 0.06)
  gableShape.lineTo(W / 2 - 0.04, 0.02)
  gableShape.closePath()
  const gableGeo = new THREE.ShapeGeometry(gableShape)
  const gableMat = makeMat(wood)
  gableMat.side = THREE.DoubleSide
  for (const [z, flip] of [
    [D / 2 + 0.02, false],
    [-D / 2 - 0.02, true],
  ]) {
    const g = new THREE.Mesh(gableGeo, gableMat)
    g.position.set(0, eaveY, z)
    if (flip) g.rotation.y = Math.PI
    g.castShadow = true
    house.add(g)
  }

  const windowMats = []
  const windowLights = []
  const addGlass = (w, h, d, x, y, z) => {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x9eb8c8,
      emissive: 0xffb300,
      emissiveIntensity: 0,
      flatShading: true,
    })
    windowMats.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.userData.isWindow = true
    house.add(mesh)
    return mesh
  }
  const addWindowLight = (x, y, z, ox, oy, oz) => {
    const light = new THREE.SpotLight(0xffc078, 0, 14, Math.PI / 2.6, 0.45, 1.3)
    const sx = Math.sign(ox) || 0
    const sz = Math.sign(oz) || 0
    light.position.set(x + ox * 0.12, y, z + oz * 0.12)
    light.target.position.set(x + sx * 3.5 + ox, y - 0.9, z + sz * 3.5 + oz)
    house.add(light)
    house.add(light.target)
    windowLights.push(light)
  }

  const winY = yWall + wallH * 0.55
  const placeFront = (lx) => {
    const ww = 0.7
    const wh = 0.9
    addBox(house, ww + 0.1, wh + 0.1, 0.08, frame, lx, winY, D / 2 + 0.04)
    addGlass(ww * 0.4, wh * 0.4, 0.05, lx - ww * 0.2, winY + wh * 0.18, D / 2 + 0.08)
    addGlass(ww * 0.4, wh * 0.4, 0.05, lx + ww * 0.2, winY + wh * 0.18, D / 2 + 0.08)
    addGlass(ww * 0.4, wh * 0.4, 0.05, lx - ww * 0.2, winY - wh * 0.18, D / 2 + 0.08)
    addGlass(ww * 0.4, wh * 0.4, 0.05, lx + ww * 0.2, winY - wh * 0.18, D / 2 + 0.08)
    addWindowLight(lx, winY, D / 2, 0, 0, 1)
  }
  placeFront(-1.55)
  placeFront(1.65)

  const placeSide = (xSign, lz) => {
    const ww = 0.65
    const wh = 0.85
    const x = (xSign < 0 ? -1 : 1) * (W / 2 + 0.04)
    addBox(house, 0.08, wh + 0.1, ww + 0.1, frame, x, winY, lz)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + xSign * 0.05, winY + wh * 0.18, lz - ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + xSign * 0.05, winY + wh * 0.18, lz + ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + xSign * 0.05, winY - wh * 0.18, lz - ww * 0.2)
    addGlass(0.05, wh * 0.4, ww * 0.4, x + xSign * 0.05, winY - wh * 0.18, lz + ww * 0.2)
    addWindowLight(x, winY, lz, xSign, 0, 0)
  }
  placeSide(-1, -0.4)
  placeSide(1, -0.4)
  placeSide(-1, 0.9)
  placeSide(1, 0.9)

  // small attic window
  const aw = 0.55
  const ah = 0.45
  const ay = eaveY + roofRise * 0.35
  addBox(house, aw + 0.08, ah + 0.08, 0.06, woodLine, 0, ay, D / 2 + 0.03)
  addGlass(aw * 0.85, ah * 0.85, 0.04, 0, ay, D / 2 + 0.07)
  addWindowLight(0, ay, D / 2, 0, 0, 1)

  scene.add(house)
  return { house, windowMats, windowLights }
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x87aec8)
  scene.fog = new THREE.Fog(0x87aec8, 8, 28)

  const ambient = new THREE.AmbientLight(0xc8d6c0, 0.55)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.05)
  sun.position.set(18, 28, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  sun.shadow.camera.left = -40
  sun.shadow.camera.right = 55
  sun.shadow.camera.top = 40
  sun.shadow.camera.bottom = -40
  scene.add(sun)

  buildGround(scene)
  const main = buildHouse(scene)
  const side = buildSideCottage(scene)
  const father = buildFatherHouse(scene)
  buildFatherGarden(scene)
  buildWomanWithOarStatue(scene)
  const terentyev = buildTerentyevHouse(scene)
  buildTerentyevGarden(scene)
  buildFence(scene)
  buildBoardPile(scene)
  buildBareTreeNearPlot(scene)
  buildMotorcycle(scene)
  buildForest(scene)

  return {
    spawn: new THREE.Vector3(0, 1.6, plotFrontZ() - 1),
    ambient,
    sun,
    windowMats: [
      ...main.windowMats,
      ...side.windowMats,
      ...father.windowMats,
      ...terentyev.windowMats,
    ],
    windowLights: [
      ...main.windowLights,
      ...side.windowLights,
      ...father.windowLights,
      ...terentyev.windowLights,
    ],
  }
}
