import {
  defineCommandContract,
  defineProgram,
  type Transition,
  tagged,
  transition,
} from '@orikit/spike-core'
import { Schema } from 'effect'

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
})
export type TodoModel = typeof TodoModel.Type

export const TodoFlags = Schema.Struct({})
export type TodoFlags = typeof TodoFlags.Type

const DraftChanged = Schema.TaggedStruct('DraftChanged', { value: Schema.String })
const AddRequested = Schema.TaggedStruct('AddRequested', {})
const EditRequested = Schema.TaggedStruct('EditRequested', { id: Schema.String })
const EditDraftChanged = Schema.TaggedStruct('EditDraftChanged', { value: Schema.String })
const EditCommitted = Schema.TaggedStruct('EditCommitted', {})
const EditCancelled = Schema.TaggedStruct('EditCancelled', {})
const ToggleRequested = Schema.TaggedStruct('ToggleRequested', { id: Schema.String })
const DeleteRequested = Schema.TaggedStruct('DeleteRequested', { id: Schema.String })
const LoadRequested = Schema.TaggedStruct('LoadRequested', {})
const SaveRetried = Schema.TaggedStruct('SaveRetried', {})
export const TodosLoaded = Schema.TaggedStruct('TodosLoaded', {
  todos: Schema.Array(Todo),
})
export type TodosLoaded = typeof TodosLoaded.Type
export const TodosLoadFailed = Schema.TaggedStruct('TodosLoadFailed', {
  reason: Schema.String,
})
export type TodosLoadFailed = typeof TodosLoadFailed.Type
export const TodosSaved = Schema.TaggedStruct('TodosSaved', {})
export type TodosSaved = typeof TodosSaved.Type
export const TodosSaveFailed = Schema.TaggedStruct('TodosSaveFailed', {
  reason: Schema.String,
})
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
  TodosLoaded,
  TodosLoadFailed,
  TodosSaved,
  TodosSaveFailed,
])
export type TodoMessage = typeof TodoMessage.Type

export const LoadTodos = Schema.TaggedStruct('LoadTodos', {})
export type LoadTodos = typeof LoadTodos.Type
export const SaveTodos = Schema.TaggedStruct('SaveTodos', { todos: Schema.Array(Todo) })
export type SaveTodos = typeof SaveTodos.Type

export const TodoCommand = Schema.Union([LoadTodos, SaveTodos])
export type TodoCommand = typeof TodoCommand.Type

export const loadTodos = (): LoadTodos => tagged('LoadTodos')
export const saveTodos = (todos: ReadonlyArray<Todo>): SaveTodos => tagged('SaveTodos', { todos })
export const draftChanged = (value: string): TodoMessage => tagged('DraftChanged', { value })
export const addRequested = (): TodoMessage => tagged('AddRequested')
export const editRequested = (id: string): TodoMessage => tagged('EditRequested', { id })
export const editDraftChanged = (value: string): TodoMessage =>
  tagged('EditDraftChanged', { value })
export const editCommitted = (): TodoMessage => tagged('EditCommitted')
export const editCancelled = (): TodoMessage => tagged('EditCancelled')
export const toggleRequested = (id: string): TodoMessage => tagged('ToggleRequested', { id })
export const deleteRequested = (id: string): TodoMessage => tagged('DeleteRequested', { id })
export const loadRequested = (): TodoMessage => tagged('LoadRequested')
export const saveRetried = (): TodoMessage => tagged('SaveRetried')
export const todosLoaded = (todos: ReadonlyArray<Todo>): TodosLoaded =>
  tagged('TodosLoaded', { todos })
export const todosLoadFailed = (reason: string): TodosLoadFailed =>
  tagged('TodosLoadFailed', { reason })
export const todosSaved = (): TodosSaved => tagged('TodosSaved')
export const todosSaveFailed = (reason: string): TodosSaveFailed =>
  tagged('TodosSaveFailed', { reason })

export const initialTodoModel = (): TodoModel => ({
  draft: '',
  nextId: 1,
  todos: [],
  loadState: { _tag: 'Loading' },
  saveState: { _tag: 'Idle' },
  editor: { _tag: 'Closed' },
})

const unchanged = (model: TodoModel): Transition<TodoModel, TodoCommand> => transition(model)

const persist = (
  model: TodoModel,
  todos: ReadonlyArray<Todo>,
): Transition<TodoModel, TodoCommand> =>
  transition(
    {
      ...model,
      todos,
      saveState: { _tag: 'Saving' },
    },
    saveTodos(todos),
  )

export const updateTodo = (
  model: TodoModel,
  message: TodoMessage,
): Transition<TodoModel, TodoCommand> => {
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
      return transition({ ...model, loadState: { _tag: 'Loading' } }, loadTodos())
    case 'SaveRetried':
      return transition({ ...model, saveState: { _tag: 'Saving' } }, saveTodos(model.todos))
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

export const todoProgram = defineProgram<TodoFlags, TodoModel, TodoMessage, TodoCommand>({
  identity: {
    name: 'todo',
    schemaVersion: 2,
    buildVersion: '0.0.0-phase3',
  },
  Flags: TodoFlags,
  Model: TodoModel,
  Message: TodoMessage,
  Command: TodoCommand,
  commandContract: defineCommandContract<TodoCommand, TodoMessage>({
    LoadTodos: ['TodosLoaded', 'TodosLoadFailed'],
    SaveTodos: ['TodosSaved', 'TodosSaveFailed'],
  }),
  init: () => transition(initialTodoModel(), loadTodos()),
  update: updateTodo,
})
