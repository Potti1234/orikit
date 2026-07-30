import { presentTodo, type TodoMessage, type TodoModel } from '@orikit/todo'

export type TodoNativeRow = Readonly<{
  id: string
  key: string
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
  const presentation = presentTodo(model)
  return {
    title: presentation.title,
    summary: presentation.summary,
    draft: presentation.draft,
    addMessage: presentation.addMessage,
    load: { ...presentation.load, text: presentation.load.detail },
    save: { ...presentation.save, text: presentation.save.detail },
    empty: presentation.empty,
    rows: presentation.rows.map((row) => ({
      ...row,
      key: row.id,
      titleClass: row.completed ? 'todo-title completed' : 'todo-title',
      toggleText: row.completed ? '✓' : '○',
    })),
    editor: presentation.editor,
  }
}
