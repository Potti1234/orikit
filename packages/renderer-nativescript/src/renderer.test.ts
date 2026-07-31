import { describe, expect, it } from 'vitest'

import { nativeElement } from './node'
import { createNativeRenderer } from './renderer'
import type { NativeElementKind, NativeHost, RendererLocalState } from './types'

type FakeView = {
  kind: NativeElementKind | 'Custom'
  props: Record<string, unknown>
  listeners: Map<string, Set<(event: unknown) => void>>
  children: Array<FakeView>
  state: RendererLocalState
  disposed: boolean
}

const supported = new Set([
  'text',
  'visibility',
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityRole',
  'accessibilityState',
  'automationText',
])

const createView = (kind: FakeView['kind']): FakeView => ({
  kind,
  props: {},
  listeners: new Map(),
  children: [],
  state: {},
  disposed: false,
})

const host: NativeHost<FakeView> = {
  create: createView,
  setProperty: (view, name, value) => {
    view.props[name] = value
  },
  supportedProperties: () => supported,
  addEventListener: (view, name, listener) => {
    const listeners = view.listeners.get(name) ?? new Set()
    listeners.add(listener)
    view.listeners.set(name, listeners)
  },
  removeEventListener: (view, name, listener) => {
    view.listeners.get(name)?.delete(listener)
  },
  insertChild: (parent, child, index) => {
    const oldIndex = parent.children.indexOf(child)
    if (oldIndex >= 0) parent.children.splice(oldIndex, 1)
    parent.children.splice(index, 0, child)
  },
  removeChild: (parent, child) => {
    const index = parent.children.indexOf(child)
    if (index >= 0) parent.children.splice(index, 1)
  },
  captureLocalState: (view) => view.state,
  restoreLocalState: (view, state) => {
    view.state = state
  },
  dispose: (view) => {
    view.disposed = true
  },
}

const fire = (view: FakeView, event: string, value: unknown = {}): void => {
  for (const listener of view.listeners.get(event) ?? []) listener(value)
}

describe('NativeScript renderer contract', () => {
  it('reuses keyed stateful controls across insertion and movement', () => {
    const renderer = createNativeRenderer<string, FakeView>({ host, dispatch: () => undefined })
    const first = renderer.render(
      nativeElement('Stack', {
        children: [
          nativeElement('TextField', { key: 'a', props: { text: 'A' } }),
          nativeElement('TextField', { key: 'b', props: { text: 'B' } }),
        ],
      }),
    )
    const a = first.children[0] as FakeView
    const b = first.children[1] as FakeView
    a.state = { focused: true, selectionStart: 1, selectionEnd: 1 }

    const next = renderer.render(
      nativeElement('Stack', {
        children: [
          nativeElement('TextField', { key: 'b', props: { text: 'B' } }),
          nativeElement('TextField', { key: 'new', props: { text: 'New' } }),
          nativeElement('TextField', { key: 'a', props: { text: 'A' } }),
        ],
      }),
    )

    expect(next).toBe(first)
    expect(next.children).toEqual([b, expect.anything(), a])
    expect(a.state).toEqual({ focused: true, selectionStart: 1, selectionEnd: 1 })
  })

  it('diffs properties and preserves renderer-local state', () => {
    const writes: Array<string> = []
    const trackingHost: NativeHost<FakeView> = {
      ...host,
      setProperty: (view, name, value) => {
        writes.push(name)
        host.setProperty(view, name, value)
      },
    }
    const renderer = createNativeRenderer<string, FakeView>({
      host: trackingHost,
      dispatch: () => undefined,
    })
    const view = renderer.render(nativeElement('TextField', { props: { text: 'Draft' } }))
    view.state = { focused: true, selectionStart: 3, selectionEnd: 3 }
    writes.length = 0
    renderer.render(nativeElement('TextField', { props: { text: 'Draft' } }))

    expect(writes).toEqual([])
    expect(view.state.selectionStart).toBe(3)
  })

  it('replaces listeners and prevents removed controls from dispatching', () => {
    const messages: Array<string> = []
    const renderer = createNativeRenderer<string, FakeView>({
      host,
      dispatch: (value) => messages.push(value),
    })
    const firstHandler = (): string => 'first'
    const first = renderer.render(
      nativeElement('Button', {
        events: { tap: firstHandler },
        accessibility: { name: 'Continue' },
      }),
    )
    fire(first, 'tap')
    const secondHandler = (): string => 'second'
    renderer.render(
      nativeElement('Button', {
        events: { tap: secondHandler },
        accessibility: { name: 'Continue' },
      }),
    )
    fire(first, 'tap')
    renderer.render(nativeElement('Text', { props: { text: 'Done' } }))
    fire(first, 'tap')

    expect(messages).toEqual(['first', 'second'])
    expect(first.disposed).toBe(true)
  })

  it('preserves list scroll state across unrelated child updates', () => {
    const renderer = createNativeRenderer<string, FakeView>({ host, dispatch: () => undefined })
    const list = renderer.render(
      nativeElement('List', {
        children: [nativeElement('Text', { key: 'row', props: { text: 'Before' } })],
      }),
    )
    list.state = { scrollOffset: 480 }
    renderer.render(
      nativeElement('List', {
        children: [nativeElement('Text', { key: 'row', props: { text: 'After' } })],
      }),
    )
    expect(list.state.scrollOffset).toBe(480)
  })

  it('rejects duplicate keys, unsupported properties, and inaccessible interaction', () => {
    const renderer = createNativeRenderer<string, FakeView>({ host, dispatch: () => undefined })
    expect(() =>
      renderer.render(
        nativeElement('Stack', {
          children: [
            nativeElement('Text', { key: 'same' }),
            nativeElement('Text', { key: 'same' }),
          ],
        }),
      ),
    ).toThrow('DuplicateKey')

    const invalidProperty = createNativeRenderer<string, FakeView>({
      host,
      dispatch: () => undefined,
    })
    expect(() =>
      invalidProperty.render(nativeElement('Text', { props: { madeUp: true } })),
    ).toThrow('InvalidProperty')

    const inaccessible = createNativeRenderer<string, FakeView>({ host, dispatch: () => undefined })
    expect(() =>
      inaccessible.render(nativeElement('Button', { events: { tap: 'Tapped' } })),
    ).toThrow('InvalidAccessibility')
  })

  it('updates and disposes custom native elements through their adapter', () => {
    const updates: Array<string> = []
    const disposed: Array<FakeView> = []
    const renderer = createNativeRenderer<string, FakeView>({
      host,
      dispatch: () => undefined,
      customAdapters: {
        MapSurface: {
          create: () => createView('Custom'),
          update: (_view, _previous, next) => updates.push(String(next.props?.mode)),
          dispose: (view) => disposed.push(view),
        },
      },
    })
    const first = renderer.render({
      _tag: 'Custom',
      adapter: 'MapSurface',
      props: { mode: 'standard' },
    })
    renderer.render({ _tag: 'Custom', adapter: 'MapSurface', props: { mode: 'terrain' } })
    renderer.dispose()

    expect(updates).toEqual(['terrain'])
    expect(disposed).toEqual([first])
  })

  it('invalidates retained listeners and balances repeated mount disposal', () => {
    const messages: Array<string> = []
    const renderer = createNativeRenderer<string, FakeView>({
      host,
      dispatch: (message) => messages.push(message),
    })
    let retained: ((event: unknown) => void) | undefined
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const button = renderer.render(
        nativeElement('Button', {
          events: { tap: `Tapped-${cycle}` },
          accessibility: { name: 'Run' },
        }),
      )
      retained = [...(button.listeners.get('tap') ?? [])][0]
      renderer.dispose()
      retained?.({})
      expect(renderer.inspect()).toMatchObject({ mountedNodes: 0, eventInvokers: 0 })
    }
    expect(messages).toEqual([])
    expect(renderer.inspect()).toMatchObject({
      createdNodes: 100,
      disposedNodes: 100,
      renderCount: 100,
    })
  })
})
