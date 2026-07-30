import {
  createDevtoolsHistory,
  type DevtoolsHistory,
  type DevtoolsSnapshot,
} from '@orikit/devtools-runtime'
import {
  createProductionRuntime,
  type ProductionRuntime,
  type RuntimeEvent,
  type RuntimeLifecycle,
  type RuntimeMetrics,
  type RuntimeSnapshot,
  type RuntimeStatus,
} from '@orikit/runtime'

import { type TodoCommand, type TodoMessage, type TodoModel, todoProgram } from './program'
import {
  createInMemoryTodoStorage,
  type InMemoryTodoStorage,
  interpretTodoCommand,
  type TodoStorage,
} from './storage'

type Runtime = ProductionRuntime<TodoModel, TodoMessage, TodoCommand>

const cancelled = (): Error => {
  const error = new Error('Todo command was cancelled')
  error.name = 'AbortError'
  return error
}

export type TodoApplication = Readonly<{
  dispatch: (message: TodoMessage) => void
  current: () => TodoModel
  snapshot: () => RuntimeSnapshot<TodoModel, TodoCommand>
  subscribe: (observer: (model: TodoModel) => void) => () => void
  subscribeInspection: (observer: (snapshot: DevtoolsSnapshot<TodoModel>) => void) => () => void
  devtools: () => DevtoolsHistory<TodoModel> | undefined
  status: () => RuntimeStatus
  events: () => ReadonlyArray<RuntimeEvent<TodoMessage, TodoCommand>>
  metrics: () => RuntimeMetrics
  reportLifecycle: (lifecycle: RuntimeLifecycle) => void
  settle: () => Promise<void>
  dispose: () => void
}>

export type TodoApplicationOptions = Readonly<{
  storage?: TodoStorage
  devtools?: Readonly<{ enabled: boolean; sensitivePaths?: ReadonlyArray<string> }>
}>

export const createTodoApplication = (options: TodoApplicationOptions = {}): TodoApplication => {
  const storage = options.storage ?? createInMemoryTodoStorage()
  const runtime: Runtime = createProductionRuntime({
    program: todoProgram,
    flags: {},
    interpret: async (command, { signal }) => {
      if (signal.aborted) {
        throw cancelled()
      }
      const completion = await interpretTodoCommand(command, storage)
      if (signal.aborted) {
        throw cancelled()
      }
      return completion
    },
  })
  const devtools =
    options.devtools?.enabled === true
      ? createDevtoolsHistory({
          program: todoProgram,
          runtime,
          sensitivePaths: options.devtools.sensitivePaths ?? ['draft', 'value', 'editor.draft'],
        })
      : undefined

  return {
    dispatch: (message) => {
      if (devtools?.snapshot().mode._tag !== 'Traveling') runtime.dispatch(message)
    },
    current: () => devtools?.snapshot().visibleModel ?? runtime.current(),
    snapshot: runtime.snapshot,
    subscribe: (observer) =>
      devtools === undefined
        ? runtime.subscribe(({ model }) => observer(model))
        : devtools.subscribe(({ visibleModel }) => observer(visibleModel)),
    subscribeInspection: (observer) =>
      devtools === undefined
        ? runtime.subscribe(({ model, sequence }) =>
            observer({
              liveModel: model,
              visibleModel: model,
              liveSequence: sequence,
              mode: { _tag: 'Live' },
            }),
          )
        : devtools.subscribe(observer),
    devtools: () => devtools,
    status: runtime.status,
    events: runtime.events,
    metrics: runtime.metrics,
    reportLifecycle: runtime.reportLifecycle,
    settle: runtime.settle,
    dispose: () => {
      devtools?.dispose()
      runtime.dispose()
    },
  }
}

export const createTestTodoApplication = (
  initialTodos: Parameters<typeof createInMemoryTodoStorage>[0] = [],
): Readonly<{
  application: TodoApplication
  storage: InMemoryTodoStorage
}> => {
  const storage = createInMemoryTodoStorage(initialTodos)
  return {
    application: createTodoApplication({ storage }),
    storage,
  }
}
