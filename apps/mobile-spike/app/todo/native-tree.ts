import { customNativeElement, type NativeNode, nativeElement } from '@orikit/renderer-nativescript'
import {
  draftChanged,
  editDraftChanged,
  presentTodo,
  type TodoMessage,
  type TodoModel,
} from '@orikit/todo'

export type NativeMobilePlatform = 'Android' | 'IOS'

export type TodoNativeTheme = Readonly<{
  platform: NativeMobilePlatform
  pagePadding: number
  sectionSpacing: number
  controlHeight: number
  cornerRadius: number
  navigation: 'ActionBar' | 'NavigationBar'
  motionAdapter: Readonly<{
    adapter: 'MotionSummary'
    implementation: 'Kotlin' | 'Swift'
    proposedNativeClass: string
  }>
}>

export const androidTodoTheme: TodoNativeTheme = {
  platform: 'Android',
  pagePadding: 20,
  sectionSpacing: 16,
  controlHeight: 48,
  cornerRadius: 10,
  navigation: 'ActionBar',
  motionAdapter: {
    adapter: 'MotionSummary',
    implementation: 'Kotlin',
    proposedNativeClass: 'dev.orikit.device.MotionSummaryView',
  },
}

export const iosTodoTheme: TodoNativeTheme = {
  platform: 'IOS',
  pagePadding: 20,
  sectionSpacing: 14,
  controlHeight: 44,
  cornerRadius: 12,
  navigation: 'NavigationBar',
  motionAdapter: {
    adapter: 'MotionSummary',
    implementation: 'Swift',
    proposedNativeClass: 'OriKitMotionSummaryView',
  },
}

export const describeTodoNativeTree = (
  model: TodoModel,
  theme: TodoNativeTheme,
): NativeNode<TodoMessage> => {
  const view = presentTodo(model)
  const editor =
    view.editor.state === 'closed'
      ? []
      : [
          nativeElement<TodoMessage>('Stack', {
            key: 'editor',
            props: { spacing: theme.sectionSpacing / 2 },
            children: [
              nativeElement('TextField', {
                props: { text: view.editor.draft, minimumHeight: theme.controlHeight },
                events: {
                  textChange: (event) =>
                    editDraftChanged(
                      String(
                        (event as Readonly<{ object?: Readonly<{ text?: unknown }> }>).object
                          ?.text ?? '',
                      ),
                    ),
                },
                accessibility: { name: 'Edit task title' },
              }),
              nativeElement('Button', {
                props: { text: 'Save', disabled: !view.editor.canSave },
                events: { tap: view.editor.saveMessage },
                accessibility: { name: 'Save edited task', disabled: !view.editor.canSave },
              }),
              nativeElement('Button', {
                props: { text: 'Cancel' },
                events: { tap: view.editor.cancelMessage },
                accessibility: { name: 'Cancel editing task' },
              }),
            ],
          }),
        ]

  return nativeElement('Page', {
    props: {
      title: view.title,
      navigation: theme.navigation,
      padding: theme.pagePadding,
      spacing: theme.sectionSpacing,
      platform: theme.platform,
    },
    accessibility: { name: 'Today tasks' },
    children: [
      nativeElement('Stack', {
        key: 'heading',
        props: { spacing: theme.sectionSpacing / 2 },
        children: [
          nativeElement('Text', { props: { text: view.title, role: 'heading' } }),
          nativeElement('Text', { props: { text: view.summary, live: 'polite' } }),
        ],
      }),
      nativeElement('Grid', {
        key: 'composer',
        props: { columns: '*,auto', spacing: theme.sectionSpacing / 2 },
        children: [
          nativeElement('TextField', {
            props: { text: view.draft, minimumHeight: theme.controlHeight },
            events: {
              textChange: (event) =>
                draftChanged(
                  String(
                    (event as Readonly<{ object?: Readonly<{ text?: unknown }> }>).object?.text ??
                      '',
                  ),
                ),
            },
            accessibility: { name: 'New task' },
          }),
          nativeElement('Button', {
            props: {
              text: 'Add',
              disabled: !view.canAdd,
              minimumHeight: theme.controlHeight,
              cornerRadius: theme.cornerRadius,
            },
            events: { tap: view.addMessage },
            accessibility: { name: 'Add task', disabled: !view.canAdd },
          }),
        ],
      }),
      ...editor,
      customNativeElement('MotionSummary', {
        key: 'motion',
        props: {
          samples: model.motionSamples,
          magnitude: model.lastMotion,
          platformImplementation: theme.motionAdapter.implementation,
        },
        accessibility: { name: 'Accelerometer status' },
      }),
      view.empty
        ? nativeElement('Text', {
            key: 'empty',
            props: { text: 'Nothing here yet. Add one clear next step.' },
          })
        : customNativeElement('TodoList', {
            key: 'todos',
            props: { rows: view.rows },
            accessibility: { name: 'Reminders' },
          }),
    ],
  })
}
