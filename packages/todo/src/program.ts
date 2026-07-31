import { defineFoldKitProgramAdapter } from '@orikit/foldkit-runtime-adapter'
import { Context, Effect, Schema } from 'effect'
import { Command, Message, type Update } from 'foldkit/portable'

export const Todo = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean,
})
export type Todo = typeof Todo.Type

const Idle = Schema.TaggedStruct('Idle', {})
const Loading = Schema.TaggedStruct('Loading', {})
const Ready = Schema.TaggedStruct('Ready', {})
const Saving = Schema.TaggedStruct('Saving', {})
const Failed = Schema.TaggedStruct('Failed', { reason: Schema.String })

const EditorClosed = Schema.TaggedStruct('Closed', {})
const EditorEditing = Schema.TaggedStruct('Editing', {
  id: Schema.String,
  draft: Schema.String,
})

export const TodoModel = Schema.Struct({
  draft: Schema.String,
  nextId: Schema.Natural,
  todos: Schema.Array(Todo),
  loadState: Schema.Union([Loading, Ready, Failed]),
  saveState: Schema.Union([Idle, Saving, Failed]),
  editor: Schema.Union([EditorClosed, EditorEditing]),
  motionSamples: Schema.Natural,
  lastMotion: Schema.Number,
})
export type TodoModel = typeof TodoModel.Type

export const TodoFlags = Schema.Struct({})
export type TodoFlags = typeof TodoFlags.Type

export const DraftChanged = Message.m('DraftChanged', { value: Schema.String })
export const AddRequested = Message.m('AddRequested')
export const EditRequested = Message.m('EditRequested', { id: Schema.String })
export const EditDraftChanged = Message.m('EditDraftChanged', { value: Schema.String })
export const EditCommitted = Message.m('EditCommitted')
export const EditCancelled = Message.m('EditCancelled')
export const ToggleRequested = Message.m('ToggleRequested', { id: Schema.String })
export const DeleteRequested = Message.m('DeleteRequested', { id: Schema.String })
export const LoadRequested = Message.m('LoadRequested')
export const SaveRetried = Message.m('SaveRetried')
export const MotionObserved = Message.m('MotionObserved', { magnitude: Schema.Number })
export const TodosLoaded = Message.m('TodosLoaded', { todos: Schema.Array(Todo) })
export type TodosLoaded = typeof TodosLoaded.Type
export const TodosLoadFailed = Message.m('TodosLoadFailed', { reason: Schema.String })
export type TodosLoadFailed = typeof TodosLoadFailed.Type
export const TodosSaved = Message.m('TodosSaved')
export type TodosSaved = typeof TodosSaved.Type
export const TodosSaveFailed = Message.m('TodosSaveFailed', { reason: Schema.String })
export type TodosSaveFailed = typeof TodosSaveFailed.Type

export const TodoMessage = Schema.Union([
  DraftChanged,
  AddRequested,
  EditRequested,
  EditDraftChanged,
  EditCommitted,
  EditCancelled,
  ToggleRequested,
  DeleteRequested,
  LoadRequested,
  SaveRetried,
  MotionObserved,
  TodosLoaded,
  TodosLoadFailed,
  TodosSaved,
  TodosSaveFailed,
])
export type TodoMessage = typeof TodoMessage.Type

export const draftChanged = (value: string): TodoMessage => DraftChanged({ value })
export const addRequested = (): TodoMessage => AddRequested()
export const editRequested = (id: string): TodoMessage => EditRequested({ id })
export const editDraftChanged = (value: string): TodoMessage => EditDraftChanged({ value })
export const editCommitted = (): TodoMessage => EditCommitted()
export const editCancelled = (): TodoMessage => EditCancelled()
export const toggleRequested = (id: string): TodoMessage => ToggleRequested({ id })
export const deleteRequested = (id: string): TodoMessage => DeleteRequested({ id })
export const loadRequested = (): TodoMessage => LoadRequested()
export const saveRetried = (): TodoMessage => SaveRetried()
export const motionObserved = (magnitude: number): TodoMessage => MotionObserved({ magnitude })
export const todosLoaded = (todos: ReadonlyArray<Todo>): TodosLoaded => TodosLoaded({ todos })
export const todosLoadFailed = (reason: string): TodosLoadFailed => TodosLoadFailed({ reason })
export const todosSaved = (): TodosSaved => TodosSaved()
export const todosSaveFailed = (reason: string): TodosSaveFailed => TodosSaveFailed({ reason })

export type TodoStorage = Readonly<{
  load: () => Promise<ReadonlyArray<Todo>>
  save: (todos: ReadonlyArray<Todo>) => Promise<void>
}>

export class TodoStorageService extends Context.Service<TodoStorageService, TodoStorage>()(
  '@orikit/TodoStorage',
) {}

const messageFrom = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure)

export const LoadTodos = Command.define('LoadTodos', {
  messages: [TodosLoaded, TodosLoadFailed],
  execute: Effect.gen(function* () {
    const storage = yield* TodoStorageService
    return yield* Effect.promise(async () => {
      try {
        return todosLoaded(await storage.load())
      } catch (failure) {
        return todosLoadFailed(messageFrom(failure))
      }
    })
  }),
})
export type LoadTodos = ReturnType<typeof LoadTodos>

export const SaveTodos = Command.define('SaveTodos', {
  args: { todos: Schema.Array(Todo) },
  messages: [TodosSaved, TodosSaveFailed],
  execute: ({ todos }) =>
    Effect.gen(function* () {
      const storage = yield* TodoStorageService
      return yield* Effect.promise(async () => {
        try {
          await storage.save(todos)
          return todosSaved()
        } catch (failure) {
          return todosSaveFailed(messageFrom(failure))
        }
      })
    }),
})
export type SaveTodos = ReturnType<typeof SaveTodos>

export type TodoCommand = LoadTodos | SaveTodos

export const loadTodos = LoadTodos
export const saveTodos = (todos: ReadonlyArray<Todo>): SaveTodos => SaveTodos({ todos })

export const initialTodoModel = (): TodoModel => ({
  draft: '',
  nextId: 1,
  todos: [],
  loadState: { _tag: 'Loading' },
  saveState: { _tag: 'Idle' },
  editor: { _tag: 'Closed' },
  motionSamples: 0,
  lastMotion: 0,
})

export type TodoUpdate = readonly [TodoModel, ReadonlyArray<TodoCommand>]

const unchanged = (model: TodoModel): TodoUpdate => [model, []]

const persist = (model: TodoModel, todos: ReadonlyArray<Todo>): TodoUpdate => [
  {
    ...model,
    todos,
    saveState: { _tag: 'Saving' },
  },
  [saveTodos(todos)],
]

export const updateTodo = (model: TodoModel, message: TodoMessage): TodoUpdate => {
  switch (message._tag) {
    case 'DraftChanged':
      return unchanged({ ...model, draft: message.value })
    case 'AddRequested': {
      const title = model.draft.trim()
      if (title.length === 0) {
        return unchanged(model)
      }
      let nextId = model.nextId
      while (model.todos.some((todo) => todo.id === `todo-${nextId}`)) {
        nextId += 1
      }
      const todos = [...model.todos, { id: `todo-${nextId}`, title, completed: false }]
      return persist({ ...model, draft: '', nextId: nextId + 1 }, todos)
    }
    case 'EditRequested': {
      const todo = model.todos.find((candidate) => candidate.id === message.id)
      return todo === undefined
        ? unchanged(model)
        : unchanged({
            ...model,
            editor: { _tag: 'Editing', id: todo.id, draft: todo.title },
          })
    }
    case 'EditDraftChanged':
      return model.editor._tag === 'Closed'
        ? unchanged(model)
        : unchanged({
            ...model,
            editor: { ...model.editor, draft: message.value },
          })
    case 'EditCommitted': {
      if (model.editor._tag === 'Closed') {
        return unchanged(model)
      }
      const title = model.editor.draft.trim()
      if (title.length === 0) {
        return unchanged(model)
      }
      const editorId = model.editor.id
      const todos = model.todos.map((todo) => (todo.id === editorId ? { ...todo, title } : todo))
      return persist({ ...model, editor: { _tag: 'Closed' } }, todos)
    }
    case 'EditCancelled':
      return unchanged({ ...model, editor: { _tag: 'Closed' } })
    case 'ToggleRequested': {
      if (!model.todos.some((todo) => todo.id === message.id)) {
        return unchanged(model)
      }
      const todos = model.todos.map((todo) =>
        todo.id === message.id ? { ...todo, completed: !todo.completed } : todo,
      )
      return persist(model, todos)
    }
    case 'DeleteRequested': {
      const todos = model.todos.filter((todo) => todo.id !== message.id)
      if (todos.length === model.todos.length) {
        return unchanged(model)
      }
      const editor =
        model.editor._tag === 'Editing' && model.editor.id === message.id
          ? ({ _tag: 'Closed' } as const)
          : model.editor
      return persist({ ...model, editor }, todos)
    }
    case 'LoadRequested':
      return [{ ...model, loadState: { _tag: 'Loading' } }, [loadTodos()]]
    case 'SaveRetried':
      return [{ ...model, saveState: { _tag: 'Saving' } }, [saveTodos(model.todos)]]
    case 'MotionObserved':
      return unchanged({
        ...model,
        motionSamples: model.motionSamples + 1,
        lastMotion: message.magnitude,
      })
    case 'TodosLoaded':
      return unchanged({
        ...model,
        todos: message.todos,
        loadState: { _tag: 'Ready' },
      })
    case 'TodosLoadFailed':
      return unchanged({
        ...model,
        loadState: { _tag: 'Failed', reason: message.reason },
      })
    case 'TodosSaved':
      return unchanged({ ...model, saveState: { _tag: 'Idle' } })
    case 'TodosSaveFailed':
      return unchanged({
        ...model,
        saveState: { _tag: 'Failed', reason: message.reason },
      })
  }
}

const provideLoadStorage = (
  command: LoadTodos,
  storage: TodoStorage,
): Command.Command<TodoMessage> => ({
  ...command,
  effect: Effect.provideService(command.effect, TodoStorageService, storage).pipe(
    Effect.map((message): TodoMessage => message),
  ),
})

const provideSaveStorage = (
  command: SaveTodos,
  storage: TodoStorage,
): Command.Command<TodoMessage> => ({
  ...command,
  effect: Effect.provideService(command.effect, TodoStorageService, storage).pipe(
    Effect.map((message): TodoMessage => message),
  ),
})

export const provideTodoStorage = (
  result: TodoUpdate,
  storage: TodoStorage,
): Update.Return<TodoModel, TodoMessage> => [
  result[0],
  result[1].map((command) =>
    command.name === 'LoadTodos'
      ? provideLoadStorage(command, storage)
      : provideSaveStorage(command, storage),
  ),
]

export const initTodo = (): TodoUpdate => [initialTodoModel(), [loadTodos()]]

export const createTodoProgramAdapter = (storage: TodoStorage) =>
  defineFoldKitProgramAdapter<TodoFlags, TodoModel, TodoMessage>({
    identity: {
      name: 'todo',
      schemaVersion: 3,
      buildVersion: '0.0.0-foldkit-portable',
    },
    Flags: TodoFlags,
    Model: TodoModel,
    Message: TodoMessage,
    commands: {
      LoadTodos: {
        completions: ['TodosLoaded', 'TodosLoadFailed'],
      },
      SaveTodos: {
        completions: ['TodosSaved', 'TodosSaveFailed'],
      },
    },
    init: () => provideTodoStorage(initTodo(), storage),
    update: (model, message) => provideTodoStorage(updateTodo(model, message), storage),
  })

const storyStorage: TodoStorage = {
  load: async () => {
    throw new Error('Story and replay must not execute Todo storage')
  },
  save: async () => {
    throw new Error('Story and replay must not execute Todo storage')
  },
}

export const todoProgramAdapter = createTodoProgramAdapter(storyStorage)
export const todoProgram = todoProgramAdapter.program
export const describeTodoCommand = todoProgramAdapter.describe
