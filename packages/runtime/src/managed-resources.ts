import type { Tagged } from '@orikit/spike-core'

import type {
  ManagedContext,
  ManagedResourceEvent,
  ManagedResourceState,
  ManagedRuntime,
  ManagedRuntimeOptions,
  ResourceDefinition,
  SubscriptionDefinition,
} from './managed-contracts'
import type { DispatchSource, ProductionRuntime, RuntimeAbortSignal, RuntimeDefect } from './types'

type Active<Model, Message> = {
  definition: SubscriptionDefinition<Model, Message> | ResourceDefinition<Model, Message, unknown>
  kind: 'Subscription' | 'Resource'
  key: unknown
  keyFingerprint: string
  generation: number
  controller: ManagedAbortController
  status: ManagedResourceState['status']
  restartAttempt: number
  handle?: unknown
  task?: Promise<void>
}

const defectFrom = (failure: unknown): RuntimeDefect =>
  failure instanceof Error
    ? {
        name: failure.name,
        message: failure.message,
        ...(failure.stack === undefined ? {} : { stack: failure.stack }),
      }
    : { name: 'UnknownDefect', message: String(failure) }

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? String(value)
}

class ManagedAbortController {
  readonly #listeners = new Set<() => void>()
  #aborted = false
  #reason: unknown
  readonly signal: RuntimeAbortSignal

  constructor() {
    const owner = this
    this.signal = {
      get aborted() {
        return owner.#aborted
      },
      get reason() {
        return owner.#reason
      },
      addEventListener: (_type, listener) => {
        if (owner.#aborted) listener()
        else owner.#listeners.add(listener)
      },
      removeEventListener: (_type, listener) => owner.#listeners.delete(listener),
      throwIfAborted: () => {
        if (owner.#aborted) throw owner.#reason
      },
    }
  }

  abort(reason: unknown): void {
    if (this.#aborted) return
    this.#aborted = true
    this.#reason = reason
    for (const listener of this.#listeners) listener()
    this.#listeners.clear()
  }
}

export const withManagedResources = <Model, Message extends Tagged, Command>(
  base: ProductionRuntime<Model, Message, Command>,
  options: ManagedRuntimeOptions<Model, Message>,
): ManagedRuntime<Model, Message, Command> => {
  type Entry = Active<Model, Message>
  const definitions = [
    ...(options.subscriptions ?? []).map((definition) => ({
      definition,
      kind: 'Subscription' as const,
    })),
    ...(options.resources ?? []).map((definition) => ({ definition, kind: 'Resource' as const })),
  ]
  const ids = new Set<string>()
  for (const { definition } of definitions) {
    if (ids.has(definition.id)) throw new Error(`Duplicate managed resource id ${definition.id}`)
    ids.add(definition.id)
  }
  const active = new Map<string, Entry>()
  const events: Array<ManagedResourceEvent> = []
  const pending = new Set<Promise<void>>()
  const eventLimit = Math.max(1, options.eventLimit ?? 1_000)
  const delay =
    options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  let ordinal = 0
  let generation = 0
  let disposed = false
  let reconciling = false

  const record = (event: Omit<ManagedResourceEvent, 'ordinal'>): void => {
    events.push({ ...event, ordinal: ++ordinal })
    if (events.length > eventLimit) events.splice(0, events.length - eventLimit)
  }
  const track = (task: Promise<void>): Promise<void> => {
    pending.add(task)
    void task.finally(() => pending.delete(task))
    return task
  }
  const stop = (
    entry: Entry,
    reason: NonNullable<ManagedResourceEvent['reason']>,
    sequence: number,
  ): Promise<void> => {
    active.delete(entry.definition.id)
    entry.status = 'Stopping'
    entry.controller.abort(reason)
    record({
      kind: entry.kind,
      id: entry.definition.id,
      key: entry.key,
      generation: entry.generation,
      causedBySequence: sequence,
      action: 'Stopped',
      reason,
    })
    return track(
      Promise.resolve(
        entry.kind === 'Resource' && entry.handle !== undefined
          ? (entry.definition as ResourceDefinition<unknown, Tagged, unknown>).release(entry.handle)
          : undefined,
      ).catch(() => undefined),
    )
  }
  const start = (
    kind: Entry['kind'],
    definition: Entry['definition'],
    key: unknown,
    keyFingerprint: string,
    model: Model,
    sequence: number,
    restartAttempt = 0,
  ): void => {
    if (disposed) return
    const controller = new ManagedAbortController()
    const entry: Entry = {
      definition,
      kind,
      key,
      keyFingerprint,
      generation: ++generation,
      controller,
      status: 'Starting',
      restartAttempt,
    }
    active.set(definition.id, entry)
    record({
      kind,
      id: definition.id,
      key,
      generation: entry.generation,
      causedBySequence: sequence,
      action: 'Started',
    })
    const source: DispatchSource =
      kind === 'Subscription'
        ? { _tag: 'Subscription', subscriptionId: definition.id, generation: entry.generation }
        : { _tag: 'Resource', resourceId: definition.id, generation: entry.generation }
    const context: ManagedContext<Tagged> = {
      signal: controller.signal,
      dispatch: (message) => {
        if (active.get(definition.id) !== entry || controller.signal.aborted || disposed) return
        record({
          kind,
          id: definition.id,
          key,
          generation: entry.generation,
          causedBySequence: base.snapshot().sequence,
          action: 'Emitted',
        })
        base.dispatch(message, source)
      },
    }
    const operation =
      kind === 'Subscription'
        ? Promise.resolve(
            (definition as SubscriptionDefinition<Model, Message>).start(
              model,
              context as ManagedContext<Message>,
            ),
          )
        : Promise.resolve(
            (definition as ResourceDefinition<Model, Message, unknown>).acquire(
              key,
              context as ManagedContext<Message>,
            ),
          ).then((handle) => {
            if (active.get(definition.id) === entry && !controller.signal.aborted)
              entry.handle = handle
            else return (definition as ResourceDefinition<Model, Message, unknown>).release(handle)
          })
    entry.task = track(
      operation.then(
        () => {
          if (active.get(definition.id) === entry && !controller.signal.aborted)
            entry.status = 'Active'
        },
        async (failure) => {
          if (active.get(definition.id) !== entry || controller.signal.aborted || disposed) return
          entry.status = 'Failed'
          const defect = defectFrom(failure)
          record({
            kind,
            id: definition.id,
            key,
            generation: entry.generation,
            causedBySequence: base.snapshot().sequence,
            action: 'Failed',
            reason: 'Defect',
            defect,
          })
          const policy = definition.restart
          if (policy === undefined || restartAttempt >= policy.maxAttempts) return
          active.delete(definition.id)
          record({
            kind,
            id: definition.id,
            key,
            generation: entry.generation,
            causedBySequence: base.snapshot().sequence,
            action: 'RestartScheduled',
            reason: 'Defect',
            defect,
          })
          await delay(policy.delayMilliseconds ?? 0)
          const wanted = desired(definition, kind, base.current())
          if (!disposed && wanted.enabled && canonical(wanted.key) === keyFingerprint)
            start(
              kind,
              definition,
              key,
              keyFingerprint,
              base.current(),
              base.snapshot().sequence,
              restartAttempt + 1,
            )
        },
      ),
    )
  }
  const desired = (
    definition: Entry['definition'],
    kind: Entry['kind'],
    model: Model,
  ): Readonly<{ enabled: boolean; key?: unknown }> => {
    if (kind === 'Subscription') {
      const subscription = definition as SubscriptionDefinition<Model, Message>
      return (subscription.active?.(model) ?? true)
        ? { enabled: true, key: subscription.key(model) }
        : { enabled: false }
    }
    const key = (definition as ResourceDefinition<Model, Message, unknown>).desired(model)
    return key === false ? { enabled: false } : { enabled: true, key }
  }

  const reconcile = (model: Model, sequence: number, branchChanged = false): void => {
    if (disposed || reconciling) return
    reconciling = true
    try {
      for (const { definition, kind } of definitions) {
        const wanted = desired(definition, kind, model)
        const current = active.get(definition.id)
        if (!wanted.enabled) {
          if (current !== undefined) void stop(current, 'Inactive', sequence)
          continue
        }
        const fingerprint = canonical(wanted.key)
        if (current !== undefined && current.keyFingerprint === fingerprint && !branchChanged) {
          record({
            kind,
            id: definition.id,
            key: wanted.key,
            generation: current.generation,
            causedBySequence: sequence,
            action: 'Preserved',
          })
          continue
        }
        if (current !== undefined)
          void stop(current, branchChanged ? 'BranchChanged' : 'KeyChanged', sequence)
        start(kind, definition, wanted.key, fingerprint, model, sequence)
      }
    } finally {
      reconciling = false
    }
  }

  const unsubscribe = base.subscribe((snapshot) => reconcile(snapshot.model, snapshot.sequence))
  const managed: ManagedRuntime<Model, Message, Command> = {
    ...base,
    replaceBranch: (model) => {
      const branch = base.replaceBranch(model)
      reconcile(base.current(), base.snapshot().sequence, true)
      return branch
    },
    managedResources: () =>
      [...active.values()].map((entry) => ({
        kind: entry.kind,
        id: entry.definition.id,
        key: entry.key,
        generation: entry.generation,
        status: entry.status,
        restartAttempt: entry.restartAttempt,
      })),
    managedResourceEvents: () => [...events],
    settleManagedResources: async () => {
      while (pending.size > 0) await Promise.allSettled([...pending])
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      unsubscribe()
      const sequence = base.snapshot().sequence
      for (const entry of [...active.values()]) void stop(entry, 'Disposed', sequence)
      base.dispose()
    },
  }
  return managed
}
