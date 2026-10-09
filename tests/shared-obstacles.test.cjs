const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

test('obstacle contact events are broadcast once and procedural sequences match across clients', () => {
  const buses = []
  class FakeMessageBus {
    constructor() { this.sent = []; buses.push(this) }
    on(channel, callback) { this.channel = channel; this.callback = callback }
    emit(channel, payload) { this.sent.push({ channel, payload }) }
  }
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/message-bus') return { MessageBus: FakeMessageBus }
    if (request === '@dcl/sdk/network') return { myProfile: { userId: 'runner-a' } }
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    delete require.cache[require.resolve('../src/shared-obstacles.ts')]
    const { onSharedObstacleEvent, publishSharedObstacleEvent, createSharedRandom } =
      require('../src/shared-obstacles.ts')
    const seen = []
    onSharedObstacleEvent(event => seen.push(event))
    publishSharedObstacleEvent('leaf', 7, 'collapse')
    assert.equal(seen.length, 1, 'local state changes apply immediately')
    assert.equal(buses[0].sent.length, 1, 'only the small state event is sent over comms')
    const event = buses[0].sent[0].payload
    buses[0].callback(event, 'self')
    assert.equal(seen.length, 1, 'the sender echo is deduplicated')
    const remoteEvent = { ...event, id: 'runner-b:1', kind: 'orb', index: 4, action: 'pop', at: Date.now() }
    buses[0].callback(remoteEvent, 'runner-b')
    assert.equal(seen.length, 2)
    buses[0].callback(remoteEvent, 'runner-b')
    assert.equal(seen.length, 2, 'a repeated network event is applied only once')
    const a = createSharedRandom(1234), b = createSharedRandom(1234)
    assert.deepEqual(Array.from({ length: 12 }, a), Array.from({ length: 12 }, b),
      'the same seed gives every client the same randomized spawn choices')
  } finally {
    Module._load = originalLoad
    delete require.cache[require.resolve('../src/shared-obstacles.ts')]
  }
})
