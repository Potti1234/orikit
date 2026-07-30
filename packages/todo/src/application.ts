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
  status: () => RuntimeStatus
  events: () => ReadonlyArray<RuntimeEvent<TodoMessage, TodoCommand>>
  metrics: () => RuntimeMetrics
  reportLifecycle: (lifecycle: RuntimeLifecycle) => void
  settle: () => Promise<void>
  dispose: () => void
}>

export type TodoApplicationOptions = Readonly<{
  storage?: TodoStorage
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

  return {
    dispatch: (message) => runtime.dispatch(message),
    current: runtime.current,
    snapshot: runtime.snapshot,
    subscribe: (observer) => runtime.subscribe(({ model }) => observer(model)),
    status: runtime.status,
    events: runtime.events,
    metrics: runtime.metrics,
    reportLifecycle: runtime.reportLifecycle,
    settle: runtime.settle,
    dispose: runtime.dispose,
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
