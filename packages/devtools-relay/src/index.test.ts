import { describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { startDevtoolsRelay } from './index'

const opened = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })

describe('loopback DevTools relay', () => {
  it('requires pairing and relays in both directions', async () => {
    const relay = await startDevtoolsRelay(0)
    const runtime = new WebSocket(`ws://127.0.0.1:${relay.port}/runtime?code=123456`)
    await opened(runtime)
    const inspector = new WebSocket(`ws://127.0.0.1:${relay.port}/inspector?code=123456`)
    await opened(inspector)
    const fromRuntime = new Promise<string>((resolve) =>
      inspector.once('message', (data) => resolve(data.toString())),
    )
    runtime.send('{"_tag":"RuntimeState"}')
    expect(await fromRuntime).toBe('{"_tag":"RuntimeState"}')
    const fromInspector = new Promise<string>((resolve) =>
      runtime.once('message', (data) => resolve(data.toString())),
    )
    inspector.send('{"_tag":"InspectorRequest"}')
    expect(await fromInspector).toBe('{"_tag":"InspectorRequest"}')
    inspector.close()
    runtime.close()
    await relay.close()
  })

  it('rejects an inspector with the wrong pairing code', async () => {
    const relay = await startDevtoolsRelay(0)
    const runtime = new WebSocket(`ws://127.0.0.1:${relay.port}/runtime?code=123456`)
    await opened(runtime)
    const inspector = new WebSocket(`ws://127.0.0.1:${relay.port}/inspector?code=000000`)
    inspector.on('error', () => undefined)
    const status = await new Promise<number>((resolve) =>
      inspector.once('unexpected-response', (_request, response) =>
        resolve(response.statusCode ?? 0),
      ),
    )
    expect(status).toBe(401)
    runtime.terminate()
    await relay.close()
  })
})
