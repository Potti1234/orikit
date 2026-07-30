export type RuntimeMode =
  | Readonly<{ _tag: 'Running' }>
  | Readonly<{ _tag: 'Traveling'; sequence: number }>
  | Readonly<{ _tag: 'Disposed' }>

export type HistoryEntry<Model, Message, Command> = Readonly<{
  sequence: number
  message: Message | null
  modelBefore: Model | null
  modelAfter: Model
  commands: ReadonlyArray<Command>
}>

export type RuntimeSnapshot<Model, Message, Command> = Readonly<{
  liveModel: Model
  visibleModel: Model
  mode: RuntimeMode
  history: ReadonlyArray<HistoryEntry<Model, Message, Command>>
}>

export type SpikeRuntime<Model, Message, Command> = Readonly<{
  dispatch: (input: unknown) => void
  current: () => Model
  visible: () => Model
  status: () => RuntimeMode
  history: () => ReadonlyArray<HistoryEntry<Model, Message, Command>>
  subscribe: (observer: (snapshot: RuntimeSnapshot<Model, Message, Command>) => void) => () => void
  travelTo: (sequence: number) => void
  resume: () => void
  flush: () => Promise<void>
  dispose: () => void
}>

type RuntimeOptions<Model, Message, Command> = Readonly<{
  initialModel: Model
  decodeMessage: (input: unknown) => Message
  update: (model: Model, message: Message) => readonly [Model, ReadonlyArray<Command>]
  freezeModel?: (model: Model) => Model
}>

const defaultFreeze = <Model>(model: Model): Model => {
  if (typeof model !== 'object' || model === null || Object.isFrozen(model)) {
    return model
  }
  for (const value of Object.values(model)) {
    defaultFreeze(value)
  }
  return Object.freeze(model)
}

export const createSpikeRuntime = <Model, Message, Command>(
  options: RuntimeOptions<Model, Message, Command>,
): SpikeRuntime<Model, Message, Command> => {
  const freezeModel = options.freezeModel ?? defaultFreeze
  let liveModel = freezeModel(options.initialModel)
  let visibleModel = liveModel
  let mode: RuntimeMode = { _tag: 'Running' }
  let sequence = 0
  let draining = false
  let drainScheduled = false
  let disposed = false
  const queue: Array<Message> = []
  const observers = new Set<(snapshot: RuntimeSnapshot<Model, Message, Command>) => void>()
  const flushWaiters: Array<() => void> = []
  const entries: Array<HistoryEntry<Model, Message, Command>> = [
    {
      sequence: 0,
      message: null,
      modelBefore: null,
      modelAfter: liveModel,
      commands: [],
    },
  ]

  const snapshot = (): RuntimeSnapshot<Model, Message, Command> => ({
    liveModel,
    visibleModel,
    mode,
    history: entries,
  })

  const publish = (): void => {
    const currentSnapshot = snapshot()
    for (const observer of observers) {
      try {
        observer(currentSnapshot)
      } catch {
        // An observer is presentation infrastructure. It cannot invalidate a
        // committed transition or stop other observers.
      }
    }
  }

  const settleFlushWaiters = (): void => {
    if (queue.length !== 0 || draining || drainScheduled) {
      return
    }
    for (const resolve of flushWaiters.splice(0)) {
      resolve()
    }
  }

  const drain = (): void => {
    drainScheduled = false
    if (disposed || draining) {
      settleFlushWaiters()
      return
    }

    draining = true
    try {
      while (queue.length > 0 && !disposed) {
        const message = queue.shift()
        if (message === undefined) {
          break
        }
        const modelBefore = liveModel
        const [nextModel, commands] = options.update(modelBefore, message)
        liveModel = freezeModel(nextModel)
        sequence += 1
        entries.push({
          sequence,
          message,
          modelBefore,
          modelAfter: liveModel,
          commands: [...commands],
        })
        if (mode._tag === 'Running') {
          visibleModel = liveModel
        }
        publish()
      }
    } finally {
      draining = false
      if (queue.length > 0 && !disposed) {
        scheduleDrain()
      }
      settleFlushWaiters()
    }
  }

  const scheduleDrain = (): void => {
    if (drainScheduled || draining || disposed) {
      return
    }
    drainScheduled = true
    void Promise.resolve().then(drain)
  }

  return {
    dispatch: (input) => {
      if (disposed) {
        return
      }
      const message = options.decodeMessage(input)
      queue.push(message)
      scheduleDrain()
    },
    current: () => liveModel,
    visible: () => visibleModel,
    status: () => mode,
    history: () => entries,
    subscribe: (observer) => {
      observers.add(observer)
      observer(snapshot())
      return () => {
        observers.delete(observer)
      }
    },
    travelTo: (targetSequence) => {
      if (disposed) {
        return
      }
      const selected = entries.find((entry) => entry.sequence === targetSequence)
      if (selected === undefined) {
        throw new RangeError(`Unknown history sequence ${targetSequence}`)
      }
      visibleModel = selected.modelAfter
      mode = { _tag: 'Traveling', sequence: targetSequence }
      publish()
    },
    resume: () => {
      if (disposed) {
        return
      }
      visibleModel = liveModel
      mode = { _tag: 'Running' }
      publish()
    },
    flush: () => {
      if (queue.length === 0 && !draining && !drainScheduled) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        flushWaiters.push(resolve)
      })
    },
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      queue.length = 0
      mode = { _tag: 'Disposed' }
      observers.clear()
      settleFlushWaiters()
    },
  }
}
