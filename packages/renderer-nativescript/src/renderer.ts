import { assertUniqueKeys } from './keyed'
import {
  type CustomNativeNode,
  type NativeElementAdapter,
  type NativeElementNode,
  type NativeEvent,
  type NativeHost,
  type NativeNode,
  RendererError,
} from './types'

type MountedEvent = {
  source: NativeEvent<unknown>
  listener: (event: unknown) => void
}

type MountedNode<Message, View> = {
  node: NativeNode<Message>
  view: View
  events: Map<string, MountedEvent>
  children: Array<MountedNode<Message, View>>
}

export type NativeRendererOptions<Message, View> = Readonly<{
  host: NativeHost<View>
  dispatch: (message: Message) => void
  customAdapters?: Readonly<Record<string, NativeElementAdapter<CustomNativeNode<Message>, View>>>
}>

export type NativeRenderer<Message, View> = Readonly<{
  render: (node: NativeNode<Message>) => View
  currentView: () => View | undefined
  dispose: () => void
}>

const identity = (node: NativeNode<unknown>): string =>
  node._tag === 'Element' ? `element:${node.kind}` : `custom:${node.adapter}`

const sameIdentity = (left: NativeNode<unknown>, right: NativeNode<unknown>): boolean =>
  identity(left) === identity(right) && left.key === right.key

const accessibilityProperties = (
  accessibility: NativeNode<unknown>['accessibility'],
): Readonly<Record<string, unknown>> =>
  accessibility === undefined
    ? {}
    : {
        accessibilityLabel: accessibility.name,
        accessibilityHint: accessibility.hint,
        accessibilityRole: accessibility.role,
        accessibilityState: {
          checked: accessibility.checked,
          selected: accessibility.selected,
          disabled: accessibility.disabled,
          expanded: accessibility.expanded,
        },
        automationText: accessibility.testId,
      }

const validateAccessibility = (node: NativeNode<unknown>, path: string): void => {
  const interactive = node.events !== undefined && Object.keys(node.events).length > 0
  if (interactive && node.accessibility?.name?.trim() === '') {
    throw new RendererError({
      code: 'InvalidAccessibility',
      path,
      detail: 'Interactive nodes cannot have an empty accessible name',
    })
  }
  if (interactive && node.accessibility?.name === undefined) {
    throw new RendererError({
      code: 'InvalidAccessibility',
      path,
      detail: 'Interactive nodes require an accessible name',
    })
  }
}

export const createNativeRenderer = <Message, View>(
  options: NativeRendererOptions<Message, View>,
): NativeRenderer<Message, View> => {
  let root: MountedNode<Message, View> | undefined

  const customAdapter = (
    node: CustomNativeNode<Message>,
    path: string,
  ): NativeElementAdapter<CustomNativeNode<Message>, View> => {
    const adapter = options.customAdapters?.[node.adapter]
    if (adapter === undefined) {
      throw new RendererError({
        code: 'UnknownCustomAdapter',
        path,
        detail: `No adapter registered as ${JSON.stringify(node.adapter)}`,
      })
    }
    return adapter
  }

  const patchEvents = (mounted: MountedNode<Message, View>, next: NativeNode<Message>): void => {
    const desired = next.events ?? {}
    for (const [name, current] of mounted.events) {
      if (desired[name] === undefined) {
        options.host.removeEventListener(mounted.view, name, current.listener)
        mounted.events.delete(name)
      }
    }
    for (const [name, source] of Object.entries(desired)) {
      const existing = mounted.events.get(name)
      if (existing !== undefined) {
        existing.source = source as NativeEvent<unknown>
        continue
      }
      const binding: MountedEvent = {
        source: source as NativeEvent<unknown>,
        listener: () => undefined,
      }
      const listener = (event: unknown): void => {
        const current = binding.source as NativeEvent<Message>
        const message =
          typeof current === 'function' ? (current as (event: unknown) => Message)(event) : current
        options.dispatch(message)
      }
      binding.listener = listener
      options.host.addEventListener(mounted.view, name, listener)
      mounted.events.set(name, binding)
    }
  }

  const patchProperties = (
    mounted: MountedNode<Message, View>,
    previous: NativeElementNode<Message>,
    next: NativeElementNode<Message>,
    path: string,
  ): void => {
    const supported = options.host.supportedProperties(next.kind)
    const before = { ...(previous.props ?? {}), ...accessibilityProperties(previous.accessibility) }
    const after = { ...(next.props ?? {}), ...accessibilityProperties(next.accessibility) }
    for (const name of Object.keys(after)) {
      if (!supported.has(name)) {
        throw new RendererError({
          code: 'InvalidProperty',
          path,
          detail: `${next.kind} does not support property ${JSON.stringify(name)}`,
        })
      }
    }
    const localState = options.host.captureLocalState(mounted.view)
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!Object.is(before[name], after[name])) {
        options.host.setProperty(mounted.view, name, after[name])
      }
    }
    options.host.restoreLocalState(mounted.view, localState)
  }

  const disposeMounted = (mounted: MountedNode<Message, View>): void => {
    for (const child of mounted.children) disposeMounted(child)
    for (const [name, event] of mounted.events) {
      options.host.removeEventListener(mounted.view, name, event.listener)
    }
    if (mounted.node._tag === 'Custom') {
      customAdapter(mounted.node, 'dispose').dispose(mounted.view)
    } else {
      options.host.dispose(mounted.view)
    }
    mounted.children = []
    mounted.events.clear()
  }

  const mount = (node: NativeNode<Message>, path: string): MountedNode<Message, View> => {
    validateAccessibility(node, path)
    const view =
      node._tag === 'Element'
        ? options.host.create(node.kind)
        : customAdapter(node, path).create(node)
    const mounted: MountedNode<Message, View> = {
      node,
      view,
      events: new Map(),
      children: [],
    }
    if (node._tag === 'Element') {
      patchProperties(mounted, { _tag: 'Element', kind: node.kind }, node, path)
      const children = node.children ?? []
      assertUniqueKeys(children, path)
      mounted.children = children.map((child, index) => {
        const childMounted = mount(child, `${path}/${identity(child)}[${index}]`)
        options.host.insertChild(view, childMounted.view, index)
        return childMounted
      })
    }
    patchEvents(mounted, node)
    return mounted
  }

  const reconcileChildren = (
    mounted: MountedNode<Message, View>,
    next: NativeElementNode<Message>,
    path: string,
  ): void => {
    const desired = next.children ?? []
    assertUniqueKeys(desired, path)
    const unused = new Set(mounted.children)
    const ordered: Array<MountedNode<Message, View>> = []
    for (const [index, child] of desired.entries()) {
      const positional = mounted.children[index]
      const existing =
        child.key === undefined
          ? positional !== undefined &&
            positional.node.key === undefined &&
            unused.has(positional) &&
            sameIdentity(positional.node, child)
            ? positional
            : undefined
          : mounted.children.find(
              (candidate) => unused.has(candidate) && sameIdentity(candidate.node, child),
            )
      const reconciled =
        existing === undefined
          ? mount(child, `${path}/${identity(child)}[${index}]`)
          : reconcile(existing, child, `${path}/${identity(child)}[${index}]`)
      unused.delete(reconciled)
      ordered.push(reconciled)
      options.host.insertChild(mounted.view, reconciled.view, index)
    }
    for (const removed of unused) {
      options.host.removeChild(mounted.view, removed.view)
      disposeMounted(removed)
    }
    mounted.children = ordered
  }

  const reconcile = (
    mounted: MountedNode<Message, View>,
    next: NativeNode<Message>,
    path: string,
  ): MountedNode<Message, View> => {
    validateAccessibility(next, path)
    if (!sameIdentity(mounted.node, next)) {
      disposeMounted(mounted)
      return mount(next, path)
    }
    const previous = mounted.node
    if (previous._tag === 'Element' && next._tag === 'Element') {
      patchProperties(mounted, previous, next, path)
      reconcileChildren(mounted, next, path)
    } else if (previous._tag === 'Custom' && next._tag === 'Custom') {
      customAdapter(next, path).update(mounted.view, previous, next)
    }
    patchEvents(mounted, next)
    mounted.node = next
    return mounted
  }

  return {
    render: (node) => {
      try {
        root = root === undefined ? mount(node, 'root') : reconcile(root, node, 'root')
        return root.view
      } catch (failure) {
        if (failure instanceof RendererError) throw failure
        throw new RendererError({
          code: 'NativeOperationFailed',
          path: 'root',
          detail: failure instanceof Error ? failure.message : String(failure),
        })
      }
    },
    currentView: () => root?.view,
    dispose: () => {
      if (root !== undefined) disposeMounted(root)
      root = undefined
    },
  }
}
