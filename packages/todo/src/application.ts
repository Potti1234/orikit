import {
  createDevtoolsHistory,
  type DevtoolsHistory,
  type DevtoolsSnapshot,
} from '@orikit/devtools-runtime'
import {
  type ManagedResourceEvent,
  type ManagedResourceState,
  type ManagedRuntime,
  type ResourceDefinition,
  type RuntimeEvent,
  type RuntimeLifecycle,
  type RuntimeMetrics,
  type RuntimeSnapshot,
  type RuntimeStatus,
  type SubscriptionDefinition,
  withManagedResources,
} from '@orikit/runtime'
import {
  createFoldKitProductionRuntime,
  type FoldKitCommandDescription,
} from '@orikit/foldkit-runtime-adapter'

import { createTodoProgramAdapter, type TodoMessage, type TodoModel, todoProgram } from './program'
import { createInMemoryTodoStorage, type InMemoryTodoStorage, type TodoStorage } from './storage'

type Runtime = ManagedRuntime<TodoModel, TodoMessage, FoldKitCommandDescription>

export type TodoApplication = Readonly<{
  dispatch: (message: TodoMessage) => void
  current: () => TodoModel
  snapshot: () => RuntimeSnapshot<TodoModel, FoldKitCommandDescription>
  subscribe: (observer: (model: TodoModel) => void) => () => void
  subscribeInspection: (observer: (snapshot: DevtoolsSnapshot<TodoModel>) => void) => () => void
  devtools: () => DevtoolsHistory<TodoModel> | undefined
  status: () => RuntimeStatus
  events: () => ReadonlyArray<RuntimeEvent<TodoMessage, FoldKitCommandDescription>>
  metrics: () => RuntimeMetrics
  managedResources: () => ReadonlyArray<ManagedResourceState>
  managedResourceEvents: () => ReadonlyArray<ManagedResourceEvent>
  reportLifecycle: (lifecycle: RuntimeLifecycle) => void
  settle: () => Promise<void>
  dispose: () => void
}>

export type TodoApplicationOptions = Readonly<{
  storage?: TodoStorage
  devtools?: Readonly<{ enabled: boolean; sensitivePaths?: ReadonlyArray<string> }>
  subscriptions?: ReadonlyArray<SubscriptionDefinition<TodoModel, TodoMessage>>
  resources?: ReadonlyArray<ResourceDefinition<TodoModel, TodoMessage, unknown>>
}>

export const createTodoApplication = (options: TodoApplicationOptions = {}): TodoApplication => {
  const storage = options.storage ?? createInMemoryTodoStorage()
  const runtime: Runtime = withManagedResources(
    createFoldKitProductionRuntime(createTodoProgramAdapter(storage), {
      flags: {},
    }),
    {
      ...(options.subscriptions === undefined ? {} : { subscriptions: options.subscriptions }),
      ...(options.resources === undefined ? {} : { resources: options.resources }),
    },
  )
  const devtools =
    options.devtools?.enabled === true
      ? createDevtoolsHistory({
          program: todoProgram,
          runtime,
          sensitivePaths: options.devtools.sensitivePaths ?? [
            'draft',
            'value',
            'editor.draft',
            'key',
          ],
          managedResources: runtime.managedResources,
          managedResourceEvents: runtime.managedResourceEvents,
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
    managedResources: runtime.managedResources,
    managedResourceEvents: runtime.managedResourceEvents,
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
