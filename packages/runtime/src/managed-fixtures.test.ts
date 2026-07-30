import { tagged } from '@orikit/spike-core'
import { describe, expect, it } from 'vitest'

import { timerSubscription, webSocketResource } from './managed-fixtures'

describe('managed fixtures', () => {
  it('starts and disposes a deterministic timer', () => {
    let tick: (() => void) | undefined
    const cleared: Array<unknown> = []
    const emitted: Array<unknown> = []
    let aborted = false
    let abort: (() => void) | undefined
    const timer = timerSubscription({
      id: 'heartbeat',
      intervalMilliseconds: () => 250,
      message: () => tagged('Tick'),
      clock: {
        setInterval: (next) => {
          tick = next
          return 'timer-1'
        },
        clearInterval: (handle) => cleared.push(handle),
      },
    })
    timer.start(
      {},
      {
        signal: {
          get aborted() {
            return aborted
          },
          reason: undefined,
          addEventListener: (_type, listener) => {
            abort = listener
          },
          removeEventListener: () => undefined,
          throwIfAborted: () => undefined,
        },
        dispatch: (message) => emitted.push(message),
      },
    )
    tick?.()
    aborted = true
    abort?.()
    expect(emitted).toEqual([{ _tag: 'Tick' }])
    expect(cleared).toEqual(['timer-1'])
  })

  it('connects, emits, and closes the WebSocket fixture', async () => {
    const emitted: Array<unknown> = []
    const closed: Array<string> = []
    let receive: ((value: string) => void) | undefined
    const socket = webSocketResource({
      id: 'events',
      url: () => 'ws://fixture',
      connect: (url, handlers) => {
        receive = handlers.message
        return {
          close: () => {
            closed.push(url)
          },
        }
      },
      message: (value) => tagged('Received', { value }),
    })
    const handle = await socket.acquire('ws://fixture', {
      signal: {
        aborted: false,
        reason: undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        throwIfAborted: () => undefined,
      },
      dispatch: (message) => emitted.push(message),
    })
    receive?.('hello')
    await socket.release(handle)
    expect(emitted).toEqual([{ _tag: 'Received', value: 'hello' }])
    expect(closed).toEqual(['ws://fixture'])
  })
})
