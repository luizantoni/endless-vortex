const { test } = require('node:test')
const assert = require('node:assert/strict')

test('synced airtime badge keeps the 100-second tiers and shows its vortex at each 30-second mark', () => {
  let nextEntity = 1
  const components = { AvatarAttach: new Map(), Transform: new Map(), Billboard: new Map(),
    MeshRenderer: new Map(), Material: new Map(), VisibilityComponent: new Map() }
  const makeComponent = name => ({ componentId: name, create: (id, value) => components[name].set(id, { ...value }),
    getMutable: id => components[name].get(id) })
  const ecs = {
    engine: { addEntity: () => nextEntity++ },
    AvatarAnchorPointType: { AAPT_NAME_TAG: 1 }, AvatarAttach: makeComponent('AvatarAttach'),
    BillboardMode: { BM_ALL: 0 }, Billboard: makeComponent('Billboard'),
    Transform: makeComponent('Transform'), VisibilityComponent: makeComponent('VisibilityComponent'),
    MeshRenderer: { componentId: 'MeshRenderer', setPlane: id => components.MeshRenderer.set(id, {}) },
    Material: { componentId: 'Material', Texture: { Common: value => value },
      setBasicMaterial: (id, value) => components.Material.set(id, value) }
  }
  const synced = [], parents = []
  const network = { myProfile: { networkId: 12 }, syncEntity: (id, ids) => synced.push({ id, ids }),
    parentEntity: (child, parent) => parents.push({ child, parent }) }
  const math = { Color3: { create: (...v) => v }, Color4: { create: (...v) => v, White: () => [1, 1, 1, 1] },
    Quaternion: { fromEulerDegrees: (x, y, z) => ({ x, y, z, w: 1 }) },
    Vector2: { create: (x, y) => ({ x, y }) }, Vector3: { create: (x, y, z) => ({ x, y, z }) } }
  const Module = require('node:module'), originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/ecs') return ecs
    if (request === '@dcl/sdk/math') return math
    if (request === '@dcl/sdk/network') return network
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    delete require.cache[require.resolve('../src/avatar-airtime-badge.ts')]
    const { createAvatarAirtimeBadge } = require('../src/avatar-airtime-badge.ts')
    const badge = createAvatarAirtimeBadge()
    badge.update('runner-wallet', 0, 0.05)
    const anchor = [...components.AvatarAttach.keys()][0]
    const billboard = [...components.Billboard.keys()][0]
    const [plate, ...glyphs] = [...components.MeshRenderer.keys()]
    assert.equal(components.AvatarAttach.get(anchor).avatarId, 'runner-wallet')
    assert.equal(components.AvatarAttach.get(anchor).anchorPointId, 1, 'the Explorer name-tag anchor keeps remote badges aligned')
    assert.equal(components.Billboard.get(billboard).billboardMode, 0)
    assert.equal(components.Material.get(plate).texture.src, 'assets/ui/modular/streak.png')
    assert.equal(components.Material.get(plate).alphaTexture.src,
      'assets/ui/modular/avatar-badge/plate-streak-alpha.png', 'plate uses the matching explicit alpha mask')
    assert.equal(components.Material.get(plate).alphaTest, undefined, 'unlit transparency comes from the alpha texture')
    assert.equal(components.Material.get(glyphs[0]).texture.src, 'assets/ui/modular/avatar-badge/digits/0.png')
    assert.equal(components.Material.get(glyphs[0]).alphaTexture.src,
      'assets/ui/modular/avatar-badge/digits/0-alpha.png', 'digit uses a separately cropped alpha mask')
    assert.equal(components.Material.get(glyphs[0]).alphaTest, undefined)
    const badgeOffset = [...components.Transform.values()].find(transform => transform.position?.y === 0.5)
    assert.ok(badgeOffset, 'badge billboard is lifted 50cm above the name-tag anchor')
    assert.equal(components.VisibilityComponent.get(glyphs[0]).visible, true)
    assert.equal(components.VisibilityComponent.get(glyphs[1]).visible, false, 'subseconds are omitted')
    assert.ok(components.Transform.get(glyphs[0]).position.z < 0,
      'digit plane sits in front of the plate in the client camera-facing orientation')
    assert.equal(parents[0].child, billboard)
    assert.equal(parents[0].parent, anchor)
    assert.ok(parents.slice(1).every(item => item.parent === billboard), 'plate and digits share one billboard plane')
    const syncFor = id => synced.find(item => item.id === id)?.ids || []
    assert.ok(syncFor(anchor).includes('AvatarAttach'), 'the head anchor is synchronized for other players')
    assert.ok(syncFor(billboard).includes('Billboard'), 'the camera-facing billboard is synchronized')
    assert.ok(syncFor(plate).includes('Material'), 'the plate texture and alpha mask are synchronized')
    assert.ok(glyphs.every(id => syncFor(id).includes('Material') && syncFor(id).includes('VisibilityComponent')),
      'each live digit and its visibility are synchronized to nearby clients')

    badge.update('runner-wallet', 100.99, 0.05)
    assert.equal(components.Material.get(plate).texture.src, 'assets/ui/modular/milestones/milestone-100.png')
    assert.equal(components.Material.get(plate).alphaTexture.src,
      'assets/ui/modular/avatar-badge/plate-100-alpha.png', 'each milestone frame uses its matching alpha mask')
    assert.equal(components.VisibilityComponent.get(glyphs[2]).visible, true, '100.99 displays whole seconds: 100')
    assert.equal(components.VisibilityComponent.get(glyphs[3]).visible, false, 'there are no decimal sprites')
    assert.equal(components.Material.get(glyphs[0]).texture.src, 'assets/ui/modular/avatar-badge/digits/1.png')
    assert.equal(components.Material.get(glyphs[1]).texture.src, 'assets/ui/modular/avatar-badge/digits/0.png')

    badge.update('runner-wallet', 200.99, 0.05)
    assert.equal(components.Material.get(plate).texture.src, 'assets/ui/modular/milestones/milestone-200.png')
    badge.update('runner-wallet', 0, 0.05)
    assert.equal(components.VisibilityComponent.get(glyphs[1]).visible, false,
      'the badge hides the old digits after the lava-floor timer reset')
    assert.equal(components.VisibilityComponent.get(glyphs[0]).visible, true)
    assert.equal(components.Material.get(glyphs[0]).texture.src, 'assets/ui/modular/avatar-badge/digits/0.png',
      'the reset value is zero')
    assert.equal(components.Material.get(plate).texture.src, 'assets/ui/modular/streak.png',
      'the plate returns to its starting tier on reset')
    badge.update('runner-wallet', 30, 0.05)
    const [vortex, vortexMaterial] = [...components.Material.entries()].find(([, material]) =>
      material.texture?.src === 'assets/ui/modular/vortex.png')
    assert.ok(vortex, 'the 30-second vortex is a separate synced badge layer')
    assert.equal(vortexMaterial.alphaTexture.src, 'assets/ui/modular/avatar-badge/vortex-alpha.png')
    assert.equal(components.VisibilityComponent.get(vortex).visible, true,
      'the badge vortex appears at 30 seconds')
    const vortexTransform = components.Transform.get(vortex)
    assert.equal(vortexTransform.position.x, 0)
    assert.equal(vortexTransform.position.y, 0, 'the vortex animation is centered on the timer digits')
    assert.equal(vortexTransform.position.z, -0.025, 'the ring sits in front of the plate and behind the digits')
    assert.ok(vortexTransform.scale.x >= 0.48, 'the rotating art frames the number group')
    assert.ok(syncFor(vortex).includes('Transform') && syncFor(vortex).includes('VisibilityComponent'),
      'nearby players receive the animated badge layer and its visibility changes')
    for (let i = 0; i < 50; i++) badge.update('runner-wallet', 30, 0.05)
    assert.equal(components.VisibilityComponent.get(vortex).visible, false,
      'the badge vortex animation hides after its short loop')
    badge.update('runner-wallet', 60, 0.05)
    assert.equal(components.VisibilityComponent.get(vortex).visible, true,
      'the badge vortex repeats at the next 30-second mark')
    assert.ok(synced.length >= 12, 'anchor, shared billboard, plate and digit sprites are synced')
  } finally {
    Module._load = originalLoad
  }
})
