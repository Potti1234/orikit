import type { Program, Tagged } from '@orikit/spike-core'

export type RuntimeLifecycle =
  | 'Launched'
  | 'BecameActive'
  | 'BecameInactive'
  | 'EnteredBackground'
  | 'ReturnedForeground'
  | 'LowMemory'
  | 'Terminating'

export type DispatchSource =
  | Readonly<{ _tag: 'UI' }>
  | Readonly<{ _tag: 'Command'; commandId: string }>
  | Readonly<{ _tag: 'Devtools' }>
  | Readonly<{ _tag: 'Lifecycle' }>
  | Readonly<{ _tag: 'Runtime' }>
  | Readonly<{ _tag: 'Subscription'; subscriptionId: string; generation: number }>
  | Readonly<{ _tag: 'Resource'; resourceId: string; generation: number }>

export type RuntimeDefect = Readonly<{
  name: string
  message: string
  stack?: string
}>

export type RuntimeStatus =
  | Readonly<{ _tag: 'Running' }>
  | Readonly<{
      _tag: 'Crashed'
      phase: 'DecodeMessage' | 'Update' | 'ValidateTransition' | 'Command'
      defect: RuntimeDefect
      commandId?: string
    }>
  | Readonly<{ _tag: 'Disposed' }>

export type CommandExecution<Command> = Readonly<{
  commandId: string
  sessionId: string
  branchId: string
  causedBySequence: number
  command: Command
  status: 'Queued' | 'Running' | 'Completed' | 'Cancelled' | 'Failed'
}>

type EventBase = Readonly<{
  ordinal: number
  sessionId: string
  branchId: string
}>

export type RuntimeEvent<Message, Command> =
  | (EventBase &
      Readonly<{
        _tag: 'TransitionCommitted'
        sequence: number
        source: DispatchSource
        message: Message
        commands: ReadonlyArray<Command>
        updateDurationMilliseconds: number
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'DispatchQuarantined'
        reason: 'SessionChanged' | 'BranchChanged' | 'Crashed' | 'Disposed'
        message: Message
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'CommandQueued' | 'CommandStarted'
        execution: CommandExecution<Command>
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'CommandCompleted'
        commandId: string
        execution: CommandExecution<Command>
        completion: Message
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'CommandCancelled'
        commandId: string
        execution: CommandExecution<Command>
        reason: 'BranchChanged' | 'RuntimeCrashed' | 'Disposed'
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'CommandFailed'
        commandId: string
        execution: CommandExecution<Command>
        defect: RuntimeDefect
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'QuarantinedCompletion'
        commandId: string
        execution: CommandExecution<Command>
        reason: 'CommandInactive' | 'SessionChanged' | 'BranchChanged' | 'Crashed' | 'Disposed'
        outcome: 'Resolved' | 'Rejected'
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'LifecycleReported'
        lifecycle: RuntimeLifecycle
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'BranchReplaced'
        previousBranchId: string
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'ObserverFailed'
        defect: RuntimeDefect
      }>)
  | (EventBase &
      Readonly<{
        _tag: 'RuntimeCrashed'
        status: Extract<RuntimeStatus, { _tag: 'Crashed' }>
      }>)
  | (EventBase & Readonly<{ _tag: 'RuntimeDisposed' }>)

export type RuntimeMetrics = Readonly<{
  dispatchedMessages: number
  committedMessages: number
  quarantinedMessages: number
  commandsStarted: number
  commandsCompleted: number
  commandsCancelled: number
  quarantinedCompletions: number
  observerDefects: number
  droppedEvents: number
  maximumQueueDepth: number
  totalUpdateMilliseconds: number
  maximumUpdateMilliseconds: number
}>

export type RuntimeSnapshot<Model, Command> = Readonly<{
  model: Model
  sequence: number
  sessionId: string
  branchId: string
  status: RuntimeStatus
  activeCommands: ReadonlyArray<CommandExecution<Command>>
}>

export type RuntimeAbortSignal = Readonly<{
  aborted: boolean
  reason: unknown
  addEventListener: (
    type: 'abort',
    listener: () => void,
    options?: Readonly<{ once?: boolean }>,
  ) => void
  removeEventListener: (type: 'abort', listener: () => void) => void
  throwIfAborted: () => void
}>

export type CommandContext = Readonly<{
  commandId: string
  sessionId: string
  branchId: string
  causedBySequence: number
  signal: RuntimeAbortSignal
}>

export type CommandInterpreter<Command, Message> = (
  command: Command,
  context: CommandContext,
) => Promise<Message>

export type ScheduledCommand<Command, Message> = Readonly<{
  description: Command
  execute: (context: CommandContext) => Promise<Message>
}>

export type LiveRuntimeProgram<Flags, Model, Message, Command> = Readonly<{
  init: (flags: Flags) => readonly [Model, ReadonlyArray<ScheduledCommand<Command, Message>>]
  update: (
    model: Model,
    message: Message,
  ) => readonly [Model, ReadonlyArray<ScheduledCommand<Command, Message>>]
}>

export type IdKind = 'session' | 'branch' | 'command'

type RuntimeOptionsBase<Flags, Model, Message extends Tagged, Command extends Tagged> = Readonly<{
  program: Program<Flags, Model, Message, Command>
  flags: unknown
  eventLimit?: number
  freezeModel?: (model: Model) => Model
  now?: () => number
  idFactory?: (kind: IdKind, index: number) => string
}>

export type RuntimeOptions<
  Flags,
  Model,
  Message extends Tagged,
  Command extends Tagged,
> = RuntimeOptionsBase<Flags, Model, Message, Command> &
  (
    | Readonly<{
        liveProgram: LiveRuntimeProgram<Flags, Model, Message, Command>
        interpret?: CommandInterpreter<Command, Message>
      }>
    | Readonly<{
        liveProgram?: undefined
        interpret: CommandInterpreter<Command, Message>
      }>
  )

export type ProductionRuntime<Model, Message, Command> = Readonly<{
  dispatch: (input: unknown, source?: DispatchSource) => void
  current: () => Model
  snapshot: () => RuntimeSnapshot<Model, Command>
  status: () => RuntimeStatus
  events: () => ReadonlyArray<RuntimeEvent<Message, Command>>
  metrics: () => RuntimeMetrics
  subscribe: (observer: (snapshot: RuntimeSnapshot<Model, Command>) => void) => () => void
  reportLifecycle: (lifecycle: RuntimeLifecycle) => void
  replaceBranch: (model?: unknown) => string
  flush: () => Promise<void>
  settle: () => Promise<void>
  dispose: () => void
}>
