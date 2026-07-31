import {
  Application,
  type EventData,
  Frame,
  type NavigatedData,
  type Page,
  type StackLayout,
  type View,
} from '@nativescript/core'
import { createNativeRenderer, type NativeRenderer } from '@orikit/renderer-nativescript'
import { createNativeScriptHost } from '@orikit/renderer-nativescript/host'
import { canonicalTodoTrace, runTodoFixture } from '@orikit/spike-trace'
import {
  createInMemoryTodoStorage,
  createTodoApplication,
  type TodoApplication,
  type TodoMessage,
} from '@orikit/todo'
import { connectTodoDevtools, type TodoDevtoolsClient } from '../todo/devtools-client'
import { androidMotionSubscription } from '../todo/motion-subscription'
import { androidTodoTheme, describeTodoNativeTree } from '../todo/native-tree'
import { motionSummaryAdapter } from './motion-summary-adapter'
import { createTodoListAdapter } from './todo-list-adapter'

let application: TodoApplication | undefined
let renderer: NativeRenderer<TodoMessage, View> | undefined
let unsubscribe: (() => void) | undefined
let devtoolsClient: TodoDevtoolsClient | undefined
let lifecycleAttached = false

const onSuspend = (): void => application?.reportLifecycle('EnteredBackground')
const onResume = (): void => application?.reportLifecycle('ReturnedForeground')
const onLowMemory = (): void => application?.reportLifecycle('LowMemory')

const attachLifecycle = (): void => {
  if (lifecycleAttached) return
  lifecycleAttached = true
  Application.on(Application.suspendEvent, onSuspend)
  Application.on(Application.resumeEvent, onResume)
  Application.on(Application.lowMemoryEvent, onLowMemory)
}

const detachLifecycle = (): void => {
  if (!lifecycleAttached) return
  lifecycleAttached = false
  Application.off(Application.suspendEvent, onSuspend)
  Application.off(Application.resumeEvent, onResume)
  Application.off(Application.lowMemoryEvent, onLowMemory)
}

const logEvidence = async (todoApplication: TodoApplication): Promise<void> => {
  await todoApplication.settle()
  const trace = canonicalTodoTrace()
  const parts = trace.match(/.{1,600}/g) ?? []
  for (const [index, part] of parts.entries())
    console.log(`ORIKIT_TODO_TRACE_ANDROID:${index + 1}/${parts.length}:${part}`)
  const fixture = runTodoFixture()
  const snapshot = todoApplication.snapshot()
  console.log(
    `ORIKIT_TODO_READY:${JSON.stringify({
      finalModelFingerprint: fixture.finalModelFingerprint,
      nativeList: 'ListView',
      nativeTextInput: 'TextField',
      runtimeStatus: todoApplication.status()._tag,
      sessionId: snapshot.sessionId,
      branchId: snapshot.branchId,
      sequence: snapshot.sequence,
      renderer: renderer?.inspect(),
      runtimeMetrics: todoApplication.metrics(),
      managedResources: todoApplication.managedResources(),
    })}`,
  )
}

export function onNavigatingTo(args: NavigatedData): void {
  onUnloaded()
  const page = args.object as Page
  const container = page.getViewById<StackLayout>('todoRendererHost')
  if (container === undefined) throw new Error('Missing Todo renderer host container')
  application = createTodoApplication({
    storage: createInMemoryTodoStorage([
      { id: 'todo-1', title: 'Try the shared Todo program', completed: false },
    ]),
    devtools: { enabled: true },
    subscriptions: [androidMotionSubscription()],
  })
  const todoApplication = application
  renderer = createNativeRenderer<TodoMessage, View>({
    host: createNativeScriptHost(),
    dispatch: (message) => todoApplication.dispatch(message),
    customAdapters: {
      TodoList: createTodoListAdapter((message) => todoApplication.dispatch(message)),
      MotionSummary: motionSummaryAdapter,
    },
  })
  application.reportLifecycle('Launched')
  application.reportLifecycle('BecameActive')
  attachLifecycle()
  devtoolsClient = connectTodoDevtools(application, (status) =>
    console.log(`ORIKIT_DEVTOOLS_STATUS:${status}`),
  )
  unsubscribe = application.subscribeInspection(({ visibleModel }) => {
    const root = renderer?.render(describeTodoNativeTree(visibleModel, androidTodoTheme))
    if (root !== undefined && container.getChildIndex(root) < 0) container.addChild(root)
  })
  void logEvidence(application)
}

export function onOpenPortableKernel(_args: EventData): void {
  Frame.topmost().navigate('home/home-page')
}

export function onUnloaded(): void {
  application?.reportLifecycle('Terminating')
  detachLifecycle()
  unsubscribe?.()
  devtoolsClient?.dispose()
  renderer?.dispose()
  application?.dispose()
  unsubscribe = undefined
  devtoolsClient = undefined
  renderer = undefined
  application = undefined
}
