import {
  Button,
  Color,
  type EventData,
  GridLayout,
  type ItemEventData,
  Label,
  ListView,
  ObservableArray,
  type View,
} from '@nativescript/core'
import {
  applyKeyedValues,
  type NativeElementAdapter,
  reconcileKeyedValues,
} from '@orikit/renderer-nativescript'
import type { TodoMessage, TodoPresentationRow } from '@orikit/todo'

type TodoListNode = Readonly<{ props?: Readonly<Record<string, unknown>> }>
type KeyedTodoRow = TodoPresentationRow & Readonly<{ key: string }>
type TodoRowView = GridLayout &
  Readonly<{
    toggleButton: Button
    titleLabel: Label
    editButton: Button
    deleteButton: Button
  }>

const rowsOf = (node: TodoListNode): ReadonlyArray<KeyedTodoRow> =>
  ((node.props?.rows as ReadonlyArray<TodoPresentationRow> | undefined) ?? []).map((row) => ({
    ...row,
    key: row.id,
  }))

const sameRow = (left: TodoPresentationRow, right: TodoPresentationRow): boolean =>
  left.title === right.title &&
  left.completed === right.completed &&
  left.toggleLabel === right.toggleLabel

const rowFrom = (view: View): TodoPresentationRow | undefined =>
  view.bindingContext as TodoPresentationRow | undefined

const createRowView = (dispatch: (message: TodoMessage) => void): TodoRowView => {
  const root = new GridLayout() as TodoRowView
  root.columns = '48,*,auto,auto'
  root.className = 'todo-row'
  const toggleButton = new Button()
  const titleLabel = new Label()
  const editButton = new Button()
  const deleteButton = new Button()
  GridLayout.setColumn(toggleButton, 0)
  GridLayout.setColumn(titleLabel, 1)
  GridLayout.setColumn(editButton, 2)
  GridLayout.setColumn(deleteButton, 3)
  toggleButton.className = 'toggle-button'
  titleLabel.textWrap = true
  titleLabel.verticalAlignment = 'middle'
  editButton.className = 'row-action'
  editButton.text = 'Edit'
  deleteButton.className = 'row-action destructive'
  deleteButton.text = 'Delete'
  toggleButton.on(Button.tapEvent, () => {
    const row = rowFrom(root)
    if (row !== undefined) dispatch(row.toggleMessage)
  })
  editButton.on(Button.tapEvent, () => {
    const row = rowFrom(root)
    if (row !== undefined) dispatch(row.editMessage)
  })
  deleteButton.on(Button.tapEvent, () => {
    const row = rowFrom(root)
    if (row !== undefined) dispatch(row.deleteMessage)
  })
  root.addChild(toggleButton)
  root.addChild(titleLabel)
  root.addChild(editButton)
  root.addChild(deleteButton)
  Object.assign(root, { toggleButton, titleLabel, editButton, deleteButton })
  return root
}

const patchRowView = (view: TodoRowView, row: TodoPresentationRow): void => {
  view.bindingContext = row
  view.toggleButton.text = row.completed ? '✓' : '○'
  view.toggleButton.accessibilityLabel = row.toggleLabel
  view.titleLabel.text = row.title
  view.titleLabel.className = row.completed ? 'todo-title completed' : 'todo-title'
  view.editButton.accessibilityLabel = row.editLabel
  view.deleteButton.accessibilityLabel = row.deleteLabel
}

export const createTodoListAdapter = (
  dispatch: (message: TodoMessage) => void,
): NativeElementAdapter<TodoListNode, View> => {
  const valuesByList = new WeakMap<ListView, ObservableArray<KeyedTodoRow>>()
  const listenerByList = new WeakMap<ListView, (args: EventData) => void>()
  const updateValues = (list: ListView, rows: ReadonlyArray<KeyedTodoRow>): void => {
    const values = valuesByList.get(list)
    if (values === undefined) throw new Error('Todo ListView is not registered')
    applyKeyedValues(values, reconcileKeyedValues([...values], rows, sameRow))
    if (list.items !== values) list.items = values
    list.refresh()
  }
  return {
    create: (node) => {
      const list = new ListView()
      list.className = 'todo-list'
      list.separatorColor = new Color('#E5E5EA')
      const values = new ObservableArray<KeyedTodoRow>([])
      const listener = (event: EventData): void => {
        const args = event as ItemEventData
        const row = values.getItem(args.index)
        const view = (args.view as TodoRowView | undefined) ?? createRowView(dispatch)
        patchRowView(view, row)
        args.view = view
      }
      valuesByList.set(list, values)
      listenerByList.set(list, listener)
      list.on(ListView.itemLoadingEvent, listener)
      updateValues(list, rowsOf(node))
      return list
    },
    update: (view, _previous, next) => updateValues(view as ListView, rowsOf(next)),
    dispose: (view) => {
      const list = view as ListView
      const listener = listenerByList.get(list)
      if (listener !== undefined) list.off(ListView.itemLoadingEvent, listener)
      list.items = []
      listenerByList.delete(list)
      valuesByList.delete(list)
    },
  }
}
