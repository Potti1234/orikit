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
} from './program'

export type TodoPresentationRow = Readonly<{
  id: string
  title: string
  completed: boolean
  toggleLabel: string
  editLabel: string
  deleteLabel: string
  toggleMessage: TodoMessage
  editMessage: TodoMessage
  deleteMessage: TodoMessage
}>

export type TodoPresentation = Readonly<{
  title: string
  openCount: number
  completedCount: number
  summary: string
  draft: string
  canAdd: boolean
  addMessage: TodoMessage
  load: Readonly<{
    state: 'loading' | 'ready' | 'failed'
    headline: string
    detail: string
    retryMessage?: TodoMessage
  }>
  save: Readonly<{
    state: 'idle' | 'saving' | 'failed'
    detail: string
    retryMessage?: TodoMessage
  }>
  empty: boolean
  rows: ReadonlyArray<TodoPresentationRow>
  editor:
    | Readonly<{ state: 'closed' }>
    | Readonly<{
        state: 'editing'
        id: string
        draft: string
        canSave: boolean
        saveMessage: TodoMessage
        cancelMessage: TodoMessage
      }>
}>

export const presentTodo = (model: TodoModel): TodoPresentation => {
  const openCount = model.todos.filter((todo) => !todo.completed).length
  const completedCount = model.todos.length - openCount
  const load =
    model.loadState._tag === 'Loading'
      ? ({
          state: 'loading',
          headline: 'Loading reminders',
          detail: 'Loading your tasks…',
        } as const)
      : model.loadState._tag === 'Failed'
        ? ({
            state: 'failed',
            headline: 'Could not load reminders',
            detail: model.loadState.reason,
            retryMessage: loadRequested(),
          } as const)
        : ({ state: 'ready', headline: '', detail: '' } as const)
  const save =
    model.saveState._tag === 'Saving'
      ? ({ state: 'saving', detail: 'Saving…' } as const)
      : model.saveState._tag === 'Failed'
        ? ({
            state: 'failed',
            detail: `Changes were not saved. ${model.saveState.reason}`,
            retryMessage: saveRetried(),
          } as const)
        : ({ state: 'idle', detail: 'All changes saved' } as const)

  return {
    title: 'Today',
    openCount,
    completedCount,
    summary:
      model.todos.length === 0
        ? 'A calm place for what matters next.'
        : `${openCount} open · ${completedCount} completed`,
    draft: model.draft,
    canAdd: model.draft.trim().length > 0,
    addMessage: addRequested(),
    load,
    save,
    empty: model.loadState._tag === 'Ready' && model.todos.length === 0,
    rows: model.todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
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
            canSave: model.editor.draft.trim().length > 0,
            saveMessage: editCommitted(),
            cancelMessage: editCancelled(),
          },
  }
}
