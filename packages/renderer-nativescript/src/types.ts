export type NativeKey = string | number

export type NativeElementKind =
  | 'Page'
  | 'Stack'
  | 'Grid'
  | 'Flexbox'
  | 'Wrap'
  | 'Absolute'
  | 'Dock'
  | 'Scroll'
  | 'Text'
  | 'Button'
  | 'TextField'
  | 'TextView'
  | 'SearchBar'
  | 'Switch'
  | 'Slider'
  | 'Progress'
  | 'ActivityIndicator'
  | 'Image'
  | 'List'
  | 'ListPicker'
  | 'SegmentedBar'
  | 'HtmlView'

export type NativeEvent<Message> = Message | ((event: unknown) => Message)

export type NativeAccessibility = Readonly<{
  name?: string
  hint?: string
  role?: string
  checked?: boolean
  selected?: boolean
  disabled?: boolean
  expanded?: boolean
  testId?: string
}>

export type NativeElementNode<Message> = Readonly<{
  _tag: 'Element'
  kind: NativeElementKind
  key?: NativeKey
  props?: Readonly<Record<string, unknown>>
  events?: Readonly<Record<string, NativeEvent<Message>>>
  accessibility?: NativeAccessibility
  children?: ReadonlyArray<NativeNode<Message>>
}>

export type CustomNativeNode<Message> = Readonly<{
  _tag: 'Custom'
  adapter: string
  key?: NativeKey
  props?: Readonly<Record<string, unknown>>
  events?: Readonly<Record<string, NativeEvent<Message>>>
  accessibility?: NativeAccessibility
  children?: ReadonlyArray<NativeNode<Message>>
}>

export type NativeNode<Message> = NativeElementNode<Message> | CustomNativeNode<Message>

export type NativeElementAdapter<Node, View> = Readonly<{
  create: (node: Node) => View
  update: (view: View, previous: Node, next: Node) => void
  insertChild?: (view: View, child: View, index: number) => void
  removeChild?: (view: View, child: View) => void
  dispose: (view: View) => void
}>

export type RendererLocalState = Readonly<{
  focused?: boolean
  selectionStart?: number
  selectionEnd?: number
  scrollOffset?: number
}>

export type NativeHost<View> = Readonly<{
  create: (kind: NativeElementKind) => View
  setProperty: (view: View, name: string, value: unknown) => void
  supportedProperties: (kind: NativeElementKind) => ReadonlySet<string>
  addEventListener: (view: View, name: string, listener: (event: unknown) => void) => void
  removeEventListener: (view: View, name: string, listener: (event: unknown) => void) => void
  insertChild: (parent: View, child: View, index: number) => void
  removeChild: (parent: View, child: View) => void
  captureLocalState: (view: View) => RendererLocalState
  restoreLocalState: (view: View, state: RendererLocalState) => void
  dispose: (view: View) => void
}>

export type RendererDiagnostic = Readonly<{
  code:
    | 'DuplicateKey'
    | 'InvalidProperty'
    | 'InvalidAccessibility'
    | 'UnknownCustomAdapter'
    | 'MissingChildSupport'
    | 'NativeOperationFailed'
  path: string
  detail: string
}>

export class RendererError extends Error {
  readonly diagnostic: RendererDiagnostic

  constructor(diagnostic: RendererDiagnostic) {
    super(`${diagnostic.code} at ${diagnostic.path}: ${diagnostic.detail}`)
    this.name = 'RendererError'
    this.diagnostic = diagnostic
  }
}
