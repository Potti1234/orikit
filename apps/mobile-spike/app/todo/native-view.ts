import {
  addRequested,
  deleteRequested,
  editCancelled,
  editCommitted,
  editRequested,
  loadRequested,
  saveRetried,
  type TodoMessage,
  type TodoModel,
  toggleRequested,
} from '@orikit/todo'

export type TodoNativeRow = Readonly<{
  id: string
  title: string
  titleClass: string
  toggleText: string
  toggleLabel: string
  editLabel: string
  deleteLabel: string
  toggleMessage: TodoMessage
  editMessage: TodoMessage
  deleteMessage: TodoMessage
}>

export type TodoNativeView = Readonly<{
  title: string
  summary: string
  draft: string
  addMessage: TodoMessage
  load: Readonly<{
    state: 'loading' | 'ready' | 'failed'
    text: string
    retryMessage?: TodoMessage
  }>
  save: Readonly<{
    state: 'idle' | 'saving' | 'failed'
    text: string
    retryMessage?: TodoMessage
  }>
  empty: boolean
  rows: ReadonlyArray<TodoNativeRow>
  editor:
    | Readonly<{ state: 'closed' }>
    | Readonly<{
        state: 'editing'
        id: string
        draft: string
        saveMessage: TodoMessage
        cancelMessage: TodoMessage
      }>
}>

export const describeTodoNativeView = (model: TodoModel): TodoNativeView => {
  const remaining = model.todos.filter((todo) => !todo.completed).length
  const load =
    model.loadState._tag === 'Loading'
      ? ({ state: 'loading', text: 'Loading your tasks…' } as const)
      : model.loadState._tag === 'Failed'
        ? ({
            state: 'failed',
            text: `Could not load tasks. ${model.loadState.reason}`,
            retryMessage: loadRequested(),
          } as const)
        : ({ state: 'ready', text: '' } as const)
  const save =
    model.saveState._tag === 'Saving'
      ? ({ state: 'saving', text: 'Saving…' } as const)
      : model.saveState._tag === 'Failed'
        ? ({
            state: 'failed',
            text: `Changes were not saved. ${model.saveState.reason}`,
            retryMessage: saveRetried(),
          } as const)
        : ({ state: 'idle', text: 'All changes saved' } as const)

  return {
    title: 'Today',
    summary:
      model.todos.length === 0
        ? 'A calm place for what matters next.'
        : `${remaining} open · ${model.todos.length - remaining} completed`,
    draft: model.draft,
    addMessage: addRequested(),
    load,
    save,
    empty: model.loadState._tag === 'Ready' && model.todos.length === 0,
    rows: model.todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      titleClass: todo.completed ? 'todo-title completed' : 'todo-title',
      toggleText: todo.completed ? '✓' : '○',
      toggleLabel: `${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`,
      editLabel: `Edit: ${todo.title}`,
      deleteLabel: `Delete: ${todo.title}`,
      toggleMessage: toggleRequested(todo.id),
      editMessage: editRequested(todo.id),
      deleteMessage: deleteRequested(todo.id),
    })),
    editor:
      model.editor._tag === 'Closed'
        ? { state: 'closed' }
        : {
            state: 'editing',
            id: model.editor.id,
            draft: model.editor.draft,
            saveMessage: editCommitted(),
            cancelMessage: editCancelled(),
          },
  }
}
