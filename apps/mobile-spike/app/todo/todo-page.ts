import {
  Application,
  type Button,
  type EventData,
  Frame,
  type Label,
  type ListView,
  type NavigatedData,
  ObservableArray,
  type Page,
  type StackLayout,
  type TextField,
  type View,
} from '@nativescript/core'
import { canonicalTodoTrace, runTodoFixture } from '@orikit/spike-trace'
import {
  createInMemoryTodoStorage,
  createTodoApplication,
  draftChanged,
  editDraftChanged,
  type TodoApplication,
  type TodoMessage,
  type TodoModel,
} from '@orikit/todo'

import { applyKeyedItems, reconcileKeyedItems } from './keyed-items'
import { describeTodoNativeView, type TodoNativeRow, type TodoNativeView } from './native-view'

let application: TodoApplication | undefined
let unsubscribe: (() => void) | undefined
let currentView: TodoNativeView | undefined
let rows = new ObservableArray<TodoNativeRow>([])
let editingId: string | undefined
const renderDurations: Array<number> = []
let lifecycleAttached = false

const now = (): number => globalThis.performance?.now() ?? Date.now()

const requireApplication = (): TodoApplication => {
  if (application === undefined) {
    throw new Error('Todo application is not initialized')
  }
  return application
}

const requireView = <ViewType>(page: Page, id: string): ViewType => {
  const match = page.getViewById(id)
  if (match === undefined) {
    throw new Error(`Missing native view #${id}`)
  }
  return match as ViewType
}

const visibility = (visible: boolean): 'visible' | 'collapsed' =>
  visible ? 'visible' : 'collapsed'

const sameRow = (left: TodoNativeRow, right: TodoNativeRow): boolean =>
  left.title === right.title &&
  left.titleClass === right.titleClass &&
  left.toggleText === right.toggleText

const render = (page: Page, model: TodoModel): void => {
  const started = now()
  const description = describeTodoNativeView(model)
  currentView = description

  requireView<Label>(page, 'title').text = description.title
  requireView<Label>(page, 'summary').text = description.summary

  const draft = requireView<TextField>(page, 'draft')
  if (draft.text !== description.draft) {
    draft.text = description.draft
  }

  const feedback = requireView<StackLayout>(page, 'feedback')
  const feedbackText = requireView<Label>(page, 'feedbackText')
  const retry = requireView<Button>(page, 'retry')
  if (description.load.state === 'loading' || description.load.state === 'failed') {
    feedback.visibility = 'visible'
    feedbackText.text = description.load.text
    retry.visibility = visibility(description.load.state === 'failed')
    retry.accessibilityLabel = 'Try loading tasks again'
  } else if (description.save.state === 'failed') {
    feedback.visibility = 'visible'
    feedbackText.text = description.save.text
    retry.visibility = 'visible'
    retry.accessibilityLabel = 'Try saving changes again'
  } else {
    feedback.visibility = 'collapsed'
  }

  requireView<Label>(page, 'empty').visibility = visibility(description.empty)
  const list = requireView<ListView>(page, 'todos')
  list.visibility = visibility(!description.empty && description.load.state === 'ready')

  const reconciled = reconcileKeyedItems([...rows], description.rows, sameRow)
  applyKeyedItems(rows, reconciled)
  if (list.items !== rows) {
    list.items = rows
  }

  const editor = requireView<View>(page, 'editor')
  const editDraft = requireView<TextField>(page, 'editDraft')
  editor.visibility = visibility(description.editor.state === 'editing')
  if (description.editor.state === 'editing') {
    if (editDraft.text !== description.editor.draft) {
      editDraft.text = description.editor.draft
    }
    if (editingId !== description.editor.id) {
      editingId = description.editor.id
      setTimeout(() => editDraft.focus(), 0)
    }
  } else {
    editingId = undefined
  }

  renderDurations.push(now() - started)
}

const rowFrom = (args: EventData): TodoNativeRow | undefined =>
  (args.object as View).bindingContext as TodoNativeRow | undefined

const dispatchRow = (args: EventData, select: (row: TodoNativeRow) => TodoMessage): void => {
  const row = rowFrom(args)
  if (row !== undefined) {
    requireApplication().dispatch(select(row))
  }
}

const logEvidence = async (todoApplication: TodoApplication): Promise<void> => {
  await todoApplication.settle()
  const trace = canonicalTodoTrace()
  const parts = trace.match(/.{1,600}/g) ?? []
  for (const [index, part] of parts.entries()) {
    console.log(`ORIKIT_TODO_TRACE_ANDROID:${index + 1}/${parts.length}:${part}`)
  }
  const fixture = runTodoFixture()
  const runtimeSnapshot = todoApplication.snapshot()
  console.log(
    `ORIKIT_TODO_READY:${JSON.stringify({
      finalModelFingerprint: fixture.finalModelFingerprint,
      nativeList: 'ListView',
      nativeTextInput: 'TextField',
      todos: todoApplication.current().todos.length,
      runtimeStatus: todoApplication.status()._tag,
      sessionId: runtimeSnapshot.sessionId,
      branchId: runtimeSnapshot.branchId,
      sequence: runtimeSnapshot.sequence,
      runtimeMetrics: todoApplication.metrics(),
    })}`,
  )
}

const onApplicationSuspend = (): void => {
  application?.reportLifecycle('EnteredBackground')
}

const onApplicationResume = (): void => {
  application?.reportLifecycle('ReturnedForeground')
}

const onApplicationLowMemory = (): void => {
  application?.reportLifecycle('LowMemory')
}

const attachLifecycle = (): void => {
  if (lifecycleAttached) {
    return
  }
  lifecycleAttached = true
  Application.on(Application.suspendEvent, onApplicationSuspend)
  Application.on(Application.resumeEvent, onApplicationResume)
  Application.on(Application.lowMemoryEvent, onApplicationLowMemory)
}

const detachLifecycle = (): void => {
  if (!lifecycleAttached) {
    return
  }
  lifecycleAttached = false
  Application.off(Application.suspendEvent, onApplicationSuspend)
  Application.off(Application.resumeEvent, onApplicationResume)
  Application.off(Application.lowMemoryEvent, onApplicationLowMemory)
}

export function onNavigatingTo(args: NavigatedData): void {
  onUnloaded()
  const page = args.object as Page
  rows = new ObservableArray<TodoNativeRow>([])
  const storage = createInMemoryTodoStorage([
    { id: 'todo-1', title: 'Try the shared Todo program', completed: false },
  ])
  application = createTodoApplication({ storage })
  application.reportLifecycle('Launched')
  application.reportLifecycle('BecameActive')
  attachLifecycle()
  unsubscribe = application.subscribe((model) => render(page, model))
  void logEvidence(application)
}

export function onDraftChanged(args: EventData): void {
  const value = (args.object as TextField).text ?? ''
  if (application !== undefined && application.current().draft !== value) {
    application.dispatch(draftChanged(value))
  }
}

export function onAdd(_args: EventData): void {
  const view = currentView
  if (view !== undefined) {
    requireApplication().dispatch(view.addMessage)
  }
}

export function onToggle(args: EventData): void {
  dispatchRow(args, (row) => row.toggleMessage)
}

export function onEdit(args: EventData): void {
  dispatchRow(args, (row) => row.editMessage)
}

export function onDelete(args: EventData): void {
  dispatchRow(args, (row) => row.deleteMessage)
}

export function onEditDraftChanged(args: EventData): void {
  const value = (args.object as TextField).text ?? ''
  const model = application?.current()
  if (model?.editor._tag === 'Editing' && model.editor.draft !== value) {
    application?.dispatch(editDraftChanged(value))
  }
}

export function onCommitEdit(_args: EventData): void {
  const editor = currentView?.editor
  if (editor?.state === 'editing') {
    requireApplication().dispatch(editor.saveMessage)
  }
}

export function onCancelEdit(_args: EventData): void {
  const editor = currentView?.editor
  if (editor?.state === 'editing') {
    requireApplication().dispatch(editor.cancelMessage)
  }
}

export function onRetry(_args: EventData): void {
  const message = currentView?.load.retryMessage ?? currentView?.save.retryMessage
  if (message !== undefined) {
    requireApplication().dispatch(message)
  }
}

export function onOpenLocation(_args: EventData): void {
  Frame.topmost().navigate('location/location-page')
}

export function onUnloaded(): void {
  application?.reportLifecycle('Terminating')
  detachLifecycle()
  if (renderDurations.length > 0) {
    console.log(
      `ORIKIT_TODO_RENDER_METRICS:${JSON.stringify({
        samples: renderDurations.length,
        maxMilliseconds: Math.max(...renderDurations),
      })}`,
    )
  }
  unsubscribe?.()
  application?.dispose()
  unsubscribe = undefined
  application = undefined
  currentView = undefined
  editingId = undefined
  rows = new ObservableArray<TodoNativeRow>([])
  renderDurations.length = 0
}
