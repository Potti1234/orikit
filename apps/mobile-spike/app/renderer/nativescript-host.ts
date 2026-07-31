import {
  ActivityIndicator,
  Button,
  ContentView,
  GridLayout,
  Image,
  Label,
  LayoutBase,
  ListView,
  ScrollView,
  StackLayout,
  Switch,
  TextField,
  type View,
} from '@nativescript/core'
import {
  createRegistryHost,
  type NativeElementKind,
  type NativeElementRegistry,
  type RendererLocalState,
} from '@orikit/renderer-nativescript'

const common = [
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityRole',
  'accessibilityState',
  'automationText',
  'className',
  'visibility',
] as const

const properties = (...names: ReadonlyArray<string>): ReadonlySet<string> =>
  new Set([...common, ...names])

const textFieldState = (view: View): RendererLocalState => {
  const field = view as TextField
  const native = field.android
  return {
    focused: native?.hasFocus() ?? false,
    selectionStart: native?.getSelectionStart() ?? field.text?.length ?? 0,
    selectionEnd: native?.getSelectionEnd() ?? field.text?.length ?? 0,
  }
}

const restoreTextFieldState = (view: View, state: RendererLocalState): void => {
  const field = view as TextField
  const native = field.android
  if (native !== undefined && native !== null) {
    const length = field.text?.length ?? 0
    const start = Math.min(state.selectionStart ?? length, length)
    const end = Math.min(Math.max(state.selectionEnd ?? start, start), length)
    native.setSelection(start, end)
  }
  if (state.focused === true) field.focus()
}

const registration = <ViewType extends View>(
  create: () => ViewType,
  names: ReadonlySet<string>,
) => ({ create, properties: names })

export const nativeScriptElementRegistry = (): NativeElementRegistry<View> => ({
  Page: registration(
    () => new StackLayout(),
    properties('title', 'navigation', 'padding', 'spacing', 'platform'),
  ),
  Stack: registration(() => new StackLayout(), properties('padding', 'spacing')),
  Grid: registration(() => new GridLayout(), properties('columns', 'rows', 'spacing')),
  Scroll: registration(() => new ScrollView(), properties('orientation')),
  Text: registration(
    () => new Label(),
    properties('text', 'textWrap', 'role', 'live', 'completed'),
  ),
  Button: registration(
    () => new Button(),
    properties('text', 'disabled', 'minimumHeight', 'cornerRadius', 'destructive'),
  ),
  TextField: {
    ...registration(
      () => new TextField(),
      properties('text', 'hint', 'disabled', 'minimumHeight', 'returnKeyType'),
    ),
    captureLocalState: textFieldState,
    restoreLocalState: restoreTextFieldState,
  },
  Switch: registration(() => new Switch(), properties('checked', 'disabled')),
  ActivityIndicator: registration(() => new ActivityIndicator(), properties('busy')),
  Image: registration(() => new Image(), properties('src', 'stretch')),
  List: registration(() => new ListView(), properties('items', 'separatorColor')),
})

const setProperty = (view: View, name: string, value: unknown): void => {
  if (name === 'disabled') {
    view.isEnabled = value !== true
    return
  }
  if (name === 'accessibilityState') {
    const state = value as Readonly<{ disabled?: boolean }> | undefined
    if (state?.disabled !== undefined) view.isEnabled = !state.disabled
    return
  }
  if (name === 'completed') {
    view.className = value === true ? 'todo-title completed' : 'todo-title'
    return
  }
  if (name === 'destructive') {
    if (value === true) view.className = `${view.className} destructive`.trim()
    return
  }
  if (
    name === 'role' ||
    name === 'live' ||
    name === 'spacing' ||
    name === 'platform' ||
    name === 'title' ||
    name === 'navigation'
  )
    return
  ;(view as unknown as Record<string, unknown>)[name] = value
}

const insertChild = (parent: View, child: View, index: number): void => {
  if (parent instanceof LayoutBase) {
    const previous = parent.getChildIndex(child)
    if (previous >= 0) parent.removeChild(child)
    parent.insertChild(child, Math.min(index, parent.getChildrenCount()))
    return
  }
  if (parent instanceof ContentView) {
    parent.content = child
    return
  }
  throw new Error(`${parent.constructor.name} cannot contain ordinary visual children`)
}

const removeChild = (parent: View, child: View): void => {
  if (parent instanceof LayoutBase) {
    parent.removeChild(child)
  } else if (parent instanceof ContentView && parent.content === child) {
    ;(parent as unknown as { content: View | null }).content = null
  }
}

export const createNativeScriptHost = () =>
  createRegistryHost(nativeScriptElementRegistry(), {
    setProperty,
    addEventListener: (view, name, listener) => view.on(name, listener),
    removeEventListener: (view, name, listener) => view.off(name, listener),
    insertChild,
    removeChild,
  })

export const nativeScriptKindOf = (view: View): NativeElementKind | undefined => {
  if (view instanceof TextField) return 'TextField'
  if (view instanceof Button) return 'Button'
  if (view instanceof Label) return 'Text'
  if (view instanceof GridLayout) return 'Grid'
  if (view instanceof StackLayout) return 'Stack'
  if (view instanceof ScrollView) return 'Scroll'
  if (view instanceof Switch) return 'Switch'
  if (view instanceof ActivityIndicator) return 'ActivityIndicator'
  if (view instanceof Image) return 'Image'
  if (view instanceof ListView) return 'List'
  return undefined
}
