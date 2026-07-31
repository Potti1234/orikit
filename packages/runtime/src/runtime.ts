import { assertCommandCompletion, codecsFor, type Tagged } from '@orikit/spike-core'

import type {
  CommandExecution,
  DispatchSource,
  ProductionRuntime,
  RuntimeAbortSignal,
  RuntimeDefect,
  RuntimeEvent,
  RuntimeLifecycle,
  RuntimeMetrics,
  RuntimeOptions,
  RuntimeSnapshot,
  RuntimeStatus,
  ScheduledCommand,
} from './types'

type QueuedMessage<Message> = Readonly<{
  message: Message
  source: DispatchSource
  sessionId: string
  branchId: string
}>

type ActiveCommand<Command> = Readonly<{
  execution: CommandExecution<Command>
  controller: RuntimeAbortController
  task: Promise<void>
}>

type RuntimeEventInput<Event> = Event extends unknown
  ? Omit<Event, 'ordinal' | 'sessionId' | 'branchId'>
  : never

let runtimeIndex = 0

const defaultIdFactory = (kind: 'session' | 'branch' | 'command', index: number): string =>
  `${kind}-${index}`

const defaultFreeze = <Value>(value: Value): Value => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) {
    defaultFreeze(nested)
  }
  return Object.freeze(value)
}

const defectFrom = (failure: unknown): RuntimeDefect => {
  if (failure instanceof Error) {
    return {
      name: failure.name,
      message: failure.message,
      ...(failure.stack === undefined ? {} : { stack: failure.stack }),
    }
  }
  return { name: 'UnknownDefect', message: String(failure) }
}

const abortError = (): Error => {
  const error = new Error('Command is no longer active')
  error.name = 'AbortError'
  return error
}

class RuntimeAbortController {
  readonly #listeners = new Map<() => void, Readonly<{ once: boolean }>>()
  #aborted = false
  #reason: unknown
  readonly signal: RuntimeAbortSignal

  constructor() {
    const thisController = this
    this.signal = {
      get aborted() {
        return thisController.#aborted
      },
      get reason() {
        return thisController.#reason
      },
      addEventListener: (_type, listener, options) => {
        if (thisController.#aborted) {
          listener()
          return
        }
        thisController.#listeners.set(listener, {
          once: options?.once ?? false,
        })
      },
      removeEventListener: (_type, listener) => {
        thisController.#listeners.delete(listener)
      },
      throwIfAborted: () => {
        if (thisController.#aborted) {
          throw thisController.#reason instanceof Error ? thisController.#reason : abortError()
        }
      },
    }
  }

  abort(reason: unknown): void {
    if (this.#aborted) {
      return
    }
    this.#aborted = true
    this.#reason = reason
    for (const [listener, { once }] of this.#listeners) {
      listener()
      if (once) {
        this.#listeners.delete(listener)
      }
    }
  }
}

const reasonForStatus = (status: RuntimeStatus): 'Crashed' | 'Disposed' | undefined => {
  if (status._tag === 'Crashed') {
    return 'Crashed'
  }
  if (status._tag === 'Disposed') {
    return 'Disposed'
  }
  return undefined
}

export const createProductionRuntime = <
  Flags,
  Model,
  Message extends Tagged,
  Command extends Tagged,
>(
  options: RuntimeOptions<Flags, Model, Message, Command>,
): ProductionRuntime<Model, Message, Command> => {
  const codecs = codecsFor(options.program)
  const flags = codecs.decodeFlags(options.flags)
  const [initializedModel, initializedCommands] =
    options.liveProgram === undefined
      ? (() => {
          const [model, commands] = options.program.init(flags)
          return [
            model,
            commands.map(
              (description): ScheduledCommand<Command, Message> => ({
                description,
                execute: (context) => options.interpret(description, context),
              }),
            ),
          ] as const
        })()
      : options.liveProgram.init(flags)
  const freezeModel = options.freezeModel ?? defaultFreeze
  const now = options.now ?? Date.now
  const idFactory = options.idFactory ?? defaultIdFactory
  const eventLimit = Math.max(1, options.eventLimit ?? 1_000)
  const instanceIndex = ++runtimeIndex
  const sessionId = idFactory('session', instanceIndex)
  let branchIndex = 1
  let commandIndex = 0
  let branchId = idFactory('branch', branchIndex)
  let model = freezeModel(codecs.decodeModel(initializedModel))
  let sequence = 0
  let ordinal = 0
  let status: RuntimeStatus = { _tag: 'Running' }
  let draining = false
  let drainScheduled = false
  let disposed = false
  const queue: Array<QueuedMessage<Message>> = []
  const activeCommands = new Map<string, ActiveCommand<Command>>()
  const observers = new Set<(snapshot: RuntimeSnapshot<Model, Command>) => void>()
  const flushWaiters: Array<() => void> = []
  const runtimeEvents: Array<RuntimeEvent<Message, Command>> = []
  const mutableMetrics = {
    dispatchedMessages: 0,
    committedMessages: 0,
    quarantinedMessages: 0,
    commandsStarted: 0,
    commandsCompleted: 0,
    commandsCancelled: 0,
    quarantinedCompletions: 0,
    observerDefects: 0,
    droppedEvents: 0,
    maximumQueueDepth: 0,
    totalUpdateMilliseconds: 0,
    maximumUpdateMilliseconds: 0,
  }

  const metrics = (): RuntimeMetrics => ({ ...mutableMetrics })

  const record = (
    event: RuntimeEventInput<RuntimeEvent<Message, Command>>,
    eventBranchId = branchId,
  ): void => {
    runtimeEvents.push({
      ...event,
      ordinal: ++ordinal,
      sessionId,
      branchId: eventBranchId,
    } as RuntimeEvent<Message, Command>)
    if (runtimeEvents.length > eventLimit) {
      runtimeEvents.splice(0, runtimeEvents.length - eventLimit)
      mutableMetrics.droppedEvents += 1
    }
  }

  const snapshot = (): RuntimeSnapshot<Model, Command> => ({
    model,
    sequence,
    sessionId,
    branchId,
    status,
    activeCommands: [...activeCommands.values()].map(({ execution }) => execution),
  })

  const publish = (): void => {
    const value = snapshot()
    for (const observer of observers) {
      try {
        observer(value)
      } catch (failure) {
        mutableMetrics.observerDefects += 1
        record({ _tag: 'ObserverFailed', defect: defectFrom(failure) })
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

  const cancelActive = (reason: 'BranchChanged' | 'RuntimeCrashed' | 'Disposed'): void => {
    for (const [commandId, active] of activeCommands) {
      activeCommands.delete(commandId)
      active.controller.abort(reason)
      mutableMetrics.commandsCancelled += 1
      record(
        {
          _tag: 'CommandCancelled',
          commandId,
          execution: { ...active.execution, status: 'Cancelled' },
          reason,
        },
        active.execution.branchId,
      )
    }
  }

  const crash = (
    phase: Extract<RuntimeStatus, { _tag: 'Crashed' }>['phase'],
    failure: unknown,
    commandId?: string,
  ): void => {
    if (status._tag !== 'Running') {
      return
    }
    const crashed: Extract<RuntimeStatus, { _tag: 'Crashed' }> = {
      _tag: 'Crashed',
      phase,
      defect: defectFrom(failure),
      ...(commandId === undefined ? {} : { commandId }),
    }
    status = crashed
    cancelActive('RuntimeCrashed')
    for (const queued of queue.splice(0)) {
      mutableMetrics.quarantinedMessages += 1
      record(
        {
          _tag: 'DispatchQuarantined',
          reason: 'Crashed',
          message: queued.message,
        },
        queued.branchId,
      )
    }
    record({ _tag: 'RuntimeCrashed', status: crashed })
    publish()
    settleFlushWaiters()
  }

  const quarantineCompletion = (
    execution: CommandExecution<Command>,
    outcome: 'Resolved' | 'Rejected',
  ): void => {
    const currentStatusReason = reasonForStatus(status)
    const reason =
      currentStatusReason ??
      (execution.sessionId !== sessionId
        ? 'SessionChanged'
        : execution.branchId !== branchId
          ? 'BranchChanged'
          : 'CommandInactive')
    mutableMetrics.quarantinedCompletions += 1
    record(
      {
        _tag: 'QuarantinedCompletion',
        commandId: execution.commandId,
        execution,
        reason,
        outcome,
      },
      execution.branchId,
    )
  }

  const enqueue = (
    message: Message,
    source: DispatchSource,
    messageSessionId = sessionId,
    messageBranchId = branchId,
  ): void => {
    queue.push({
      message,
      source,
      sessionId: messageSessionId,
      branchId: messageBranchId,
    })
    mutableMetrics.dispatchedMessages += 1
    mutableMetrics.maximumQueueDepth = Math.max(mutableMetrics.maximumQueueDepth, queue.length)
    scheduleDrain()
  }

  const scheduleCommand = (
    scheduled: ScheduledCommand<Command, Message>,
    causedBySequence: number,
  ): void => {
    if (status._tag !== 'Running') {
      return
    }
    const command = codecs.decodeCommand(scheduled.description)
    const commandId = idFactory('command', ++commandIndex)
    const execution: CommandExecution<Command> = {
      commandId,
      sessionId,
      branchId,
      causedBySequence,
      command,
      status: 'Queued',
    }
    const controller = new RuntimeAbortController()
    record({ _tag: 'CommandQueued', execution })

    const runningExecution: CommandExecution<Command> = {
      ...execution,
      status: 'Running',
    }
    const task = Promise.resolve()
      .then(() => {
        const current = activeCommands.get(commandId)
        if (current === undefined) {
          throw abortError()
        }
        mutableMetrics.commandsStarted += 1
        record({ _tag: 'CommandStarted', execution: runningExecution }, execution.branchId)
        return scheduled.execute({
          commandId,
          sessionId,
          branchId: execution.branchId,
          causedBySequence,
          signal: controller.signal,
        })
      })
      .then(
        (completionInput) => {
          const current = activeCommands.get(commandId)
          if (
            current === undefined ||
            disposed ||
            status._tag !== 'Running' ||
            execution.sessionId !== sessionId ||
            execution.branchId !== branchId
          ) {
            quarantineCompletion(execution, 'Resolved')
            return
          }
          try {
            const completion = codecs.decodeMessage(completionInput)
            assertCommandCompletion(options.program.commandContract, command, completion)
            activeCommands.delete(commandId)
            mutableMetrics.commandsCompleted += 1
            record(
              {
                _tag: 'CommandCompleted',
                commandId,
                execution: { ...execution, status: 'Completed' },
                completion,
              },
              execution.branchId,
            )
            enqueue(
              completion,
              { _tag: 'Command', commandId },
              execution.sessionId,
              execution.branchId,
            )
          } catch (failure) {
            activeCommands.delete(commandId)
            record(
              {
                _tag: 'CommandFailed',
                commandId,
                execution: { ...execution, status: 'Failed' },
                defect: defectFrom(failure),
              },
              execution.branchId,
            )
            crash('Command', failure, commandId)
          }
        },
        (failure) => {
          const current = activeCommands.get(commandId)
          if (
            current === undefined ||
            disposed ||
            status._tag !== 'Running' ||
            execution.branchId !== branchId
          ) {
            quarantineCompletion(execution, 'Rejected')
            return
          }
          activeCommands.delete(commandId)
          record(
            {
              _tag: 'CommandFailed',
              commandId,
              execution: { ...execution, status: 'Failed' },
              defect: defectFrom(failure),
            },
            execution.branchId,
          )
          crash('Command', failure, commandId)
        },
      )
      .finally(settleFlushWaiters)

    activeCommands.set(commandId, {
      execution: runningExecution,
      controller,
      task,
    })
  }

  const drain = (): void => {
    drainScheduled = false
    if (disposed || draining || status._tag !== 'Running') {
      settleFlushWaiters()
      return
    }
    draining = true
    try {
      while (queue.length > 0 && !disposed && status._tag === 'Running') {
        const queued = queue.shift()
        if (queued === undefined) {
          break
        }
        if (queued.sessionId !== sessionId || queued.branchId !== branchId) {
          mutableMetrics.quarantinedMessages += 1
          record(
            {
              _tag: 'DispatchQuarantined',
              reason: queued.sessionId !== sessionId ? 'SessionChanged' : 'BranchChanged',
              message: queued.message,
            },
            queued.branchId,
          )
          continue
        }
        const started = now()
        try {
          const [nextModelInput, scheduledCommands] =
            options.liveProgram === undefined
              ? (() => {
                  const [nextModel, commands] = options.program.update(model, queued.message)
                  return [
                    nextModel,
                    commands.map(
                      (description): ScheduledCommand<Command, Message> => ({
                        description,
                        execute: (context) => options.interpret(description, context),
                      }),
                    ),
                  ] as const
                })()
              : options.liveProgram.update(model, queued.message)
          const nextModel = freezeModel(codecs.decodeModel(nextModelInput))
          const commands = scheduledCommands.map(({ description }) =>
            codecs.decodeCommand(description),
          )
          const duration = Math.max(0, now() - started)
          model = nextModel
          sequence += 1
          mutableMetrics.committedMessages += 1
          mutableMetrics.totalUpdateMilliseconds += duration
          mutableMetrics.maximumUpdateMilliseconds = Math.max(
            mutableMetrics.maximumUpdateMilliseconds,
            duration,
          )
          record({
            _tag: 'TransitionCommitted',
            sequence,
            source: queued.source,
            message: queued.message,
            commands,
            updateDurationMilliseconds: duration,
          })
          publish()
          scheduledCommands.forEach((command) => {
            scheduleCommand(command, sequence)
          })
        } catch (failure) {
          crash('Update', failure)
        }
      }
    } finally {
      draining = false
      if (queue.length > 0 && !disposed && status._tag === 'Running') {
        scheduleDrain()
      }
      settleFlushWaiters()
    }
  }

  function scheduleDrain(): void {
    if (drainScheduled || draining || disposed || status._tag !== 'Running') {
      return
    }
    drainScheduled = true
    void Promise.resolve().then(drain)
  }

  const runtime: ProductionRuntime<Model, Message, Command> = {
    dispatch: (input, source = { _tag: 'UI' }) => {
      if (disposed || status._tag !== 'Running') {
        return
      }
      try {
        enqueue(codecs.decodeMessage(input), source)
      } catch (failure) {
        crash('DecodeMessage', failure)
      }
    },
    current: () => model,
    snapshot,
    status: () => status,
    events: () => [...runtimeEvents],
    metrics,
    subscribe: (observer) => {
      if (disposed) {
        return () => undefined
      }
      observers.add(observer)
      try {
        observer(snapshot())
      } catch (failure) {
        mutableMetrics.observerDefects += 1
        record({ _tag: 'ObserverFailed', defect: defectFrom(failure) })
      }
      return () => {
        observers.delete(observer)
      }
    },
    reportLifecycle: (lifecycle: RuntimeLifecycle) => {
      if (disposed) {
        return
      }
      record({ _tag: 'LifecycleReported', lifecycle })
    },
    replaceBranch: (modelInput = model) => {
      if (disposed || status._tag !== 'Running') {
        return branchId
      }
      try {
        const nextModel = freezeModel(codecs.decodeModel(modelInput))
        const previousBranchId = branchId
        cancelActive('BranchChanged')
        branchId = idFactory('branch', ++branchIndex)
        model = nextModel
        record({ _tag: 'BranchReplaced', previousBranchId })
        publish()
      } catch (failure) {
        crash('ValidateTransition', failure)
      }
      return branchId
    },
    flush: () => {
      if (queue.length === 0 && !draining && !drainScheduled) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        flushWaiters.push(resolve)
      })
    },
    settle: async () => {
      for (;;) {
        await runtime.flush()
        if (status._tag !== 'Running') {
          return
        }
        const tasks = [...activeCommands.values()].map(({ task }) => task)
        if (tasks.length === 0) {
          await runtime.flush()
          if (activeCommands.size === 0 && queue.length === 0) {
            return
          }
        } else {
          await Promise.allSettled(tasks)
        }
      }
    },
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      queue.length = 0
      cancelActive('Disposed')
      status = { _tag: 'Disposed' }
      record({ _tag: 'RuntimeDisposed' })
      observers.clear()
      settleFlushWaiters()
    },
  }

  initializedCommands.forEach((command) => {
    scheduleCommand(command, 0)
  })

  return runtime
}
