import * as THREE from 'three'

// rectangular plot: width (X) × depth (Z)
const PLOT_W = 20
const PLOT_D = 32
const FOREST = 80

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

  const W = 7.2
  const D = 5.6 * 1.2
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
  const halfD = PLOT_D / 2
  const postH = 1.35 * 1.5
  const step = 2.2
  const gateHalf = 1.8
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

  // posts along perimeter
  const edges = [
    // front (+Z) with gate gap
    { axis: 'x', z: halfD, from: -halfW, to: -gateHalf },
    { axis: 'x', z: halfD, from: gateHalf, to: halfW },
    // back (−Z)
    { axis: 'x', z: -halfD, from: -halfW, to: halfW },
    // left (−X)
    { axis: 'z', x: -halfW, from: -halfD, to: halfD },
    // right (+X)
    { axis: 'z', x: halfW, from: -halfD, to: halfD },
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
  // gate posts
  addPost(-gateHalf, halfD)
  addPost(gateHalf, halfD)

  scene.add(fence)
  return fence
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

function insidePlot(x, z, margin = 2) {
  return (
    Math.abs(x) < PLOT_W / 2 + margin &&
    Math.abs(z) < PLOT_D / 2 + margin
  )
}

function buildForest(scene) {
  const forest = new THREE.Group()
  const rng = (n) => {
    let x = Math.sin(n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  const place = (x, z, i) => {
    if (insidePlot(x, z, 2.5)) return
    const tree = makeEvergreen()
    const s = 0.85 + rng(i + 90) * 0.85
    tree.scale.setScalar(s)
    tree.position.set(x, 0, z)
    tree.rotation.y = rng(i + 7) * Math.PI
    forest.add(tree)
  }

  // dense belt just outside the plot
  let n = 0
  const nearGap = 3.2
  for (let x = -PLOT_W / 2 - 14; x <= PLOT_W / 2 + 14; x += nearGap) {
    for (const z of [-PLOT_D / 2 - 4, -PLOT_D / 2 - 8, PLOT_D / 2 + 4, PLOT_D / 2 + 8]) {
      place(x + (rng(n) - 0.5) * 2, z + (rng(n + 1) - 0.5) * 2, n++)
    }
  }
  for (let z = -PLOT_D / 2 - 14; z <= PLOT_D / 2 + 14; z += nearGap) {
    for (const x of [-PLOT_W / 2 - 4, -PLOT_W / 2 - 8, PLOT_W / 2 + 4, PLOT_W / 2 + 8]) {
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
  tree.position.set(8.4, 0, -12.5)
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
  grass.receiveShadow = true
  scene.add(grass)

  // darker soil strip under fence — reads as rectangular lot edge
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT_W + 0.6, PLOT_D + 0.6),
    makeMat(0x6a5a3e, false),
  )
  rim.rotation.x = -Math.PI / 2
  rim.position.y = -0.005
  rim.receiveShadow = true
  scene.add(rim)
  grass.position.y = 0.002

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
  bike.position.set(-PLOT_W / 2 + 2.4, 0, PLOT_D / 2 - 3.0)
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

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x87aec8)
  scene.fog = new THREE.Fog(0x87aec8, 22, 55)

  const ambient = new THREE.AmbientLight(0xc8d6c0, 0.55)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.05)
  sun.position.set(18, 28, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  sun.shadow.camera.left = -35
  sun.shadow.camera.right = 35
  sun.shadow.camera.top = 35
  sun.shadow.camera.bottom = -35
  scene.add(sun)

  buildGround(scene)
  const { windowMats, windowLights } = buildHouse(scene)
  buildFence(scene)
  buildBoardPile(scene)
  buildBareTreeNearPlot(scene)
  buildMotorcycle(scene)
  buildForest(scene)

  return {
    spawn: new THREE.Vector3(0, 1.6, PLOT_D / 2 - 1),
    ambient,
    sun,
    windowMats,
    windowLights,
  }
}
