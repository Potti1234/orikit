import type {
  CustomNativeNode,
  NativeAccessibility,
  NativeElementKind,
  NativeElementNode,
  NativeEvent,
  NativeKey,
  NativeNode,
} from './types'

type ElementOptions<Message> = Readonly<{
  key?: NativeKey
  props?: Readonly<Record<string, unknown>>
  events?: Readonly<Record<string, NativeEvent<Message>>>
  accessibility?: NativeAccessibility
  children?: ReadonlyArray<NativeNode<Message>>
}>

export const nativeElement = <Message>(
  kind: NativeElementKind,
  options: ElementOptions<Message> = {},
): NativeElementNode<Message> => ({ _tag: 'Element', kind, ...options })

export const customNativeElement = <Message>(
  adapter: string,
  options: ElementOptions<Message> = {},
): CustomNativeNode<Message> => ({ _tag: 'Custom', adapter, ...options })
