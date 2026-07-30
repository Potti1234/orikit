import type { Tagged } from '@orikit/spike-core'

import type { ResourceDefinition, SubscriptionDefinition } from './managed-contracts'

export type IntervalClock = Readonly<{
  setInterval: (tick: () => void, milliseconds: number) => unknown
  clearInterval: (handle: unknown) => void
}>

export const timerSubscription = <Model, Message extends Tagged>(
  options: Readonly<{
    id: string
    intervalMilliseconds: (model: Model) => number
    active?: (model: Model) => boolean
    message: (model: Model) => Message
    clock?: IntervalClock
  }>,
): SubscriptionDefinition<Model, Message> => {
  const clock: IntervalClock = options.clock ?? {
    setInterval: (tick, milliseconds) => setInterval(tick, milliseconds),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  }
  return {
    id: options.id,
    key: (model) => options.intervalMilliseconds(model),
    ...(options.active === undefined ? {} : { active: options.active }),
    start: (model, context) => {
      const handle = clock.setInterval(
        () => context.dispatch(options.message(model)),
        options.intervalMilliseconds(model),
      )
      context.signal.addEventListener('abort', () => clock.clearInterval(handle), { once: true })
    },
  }
}

export type WebSocketHandle = Readonly<{ close: () => void | Promise<void> }>
export type WebSocketConnector = (
  url: string,
  handlers: Readonly<{ message: (value: string) => void; defect: (failure: unknown) => void }>,
) => WebSocketHandle | Promise<WebSocketHandle>

export const webSocketResource = <Model, Message extends Tagged>(
  options: Readonly<{
    id: string
    url: (model: Model) => false | string
    connect: WebSocketConnector
    message: (value: string) => Message
    failed?: (failure: unknown) => Message
  }>,
): ResourceDefinition<Model, Message, WebSocketHandle> => ({
  id: options.id,
  desired: options.url,
  acquire: async (key, context) =>
    options.connect(String(key), {
      message: (value) => context.dispatch(options.message(value)),
      defect: (failure) => {
        if (options.failed !== undefined) context.dispatch(options.failed(failure))
      },
    }),
  release: (handle) => handle.close(),
})
