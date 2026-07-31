import { describe, expect, it } from 'vitest'

import { nativeElement } from './node'
import { createRegistryHost } from './registry'
import { createNativeRenderer } from './renderer'
import type { NativeElementKind } from './types'

type View = {
  kind: NativeElementKind
  children: Array<View>
  props: Record<string, unknown>
  listeners: Map<string, Set<(event: unknown) => void>>
  selection: number
}

const createView = (kind: NativeElementKind): View => ({
  kind,
  children: [],
  props: {},
  listeners: new Map(),
  selection: 0,
})

describe('native element registry', () => {
  it('routes creation and controlled local state through element metadata', () => {
    const registration = (kind: NativeElementKind) => ({
      create: () => createView(kind),
      properties: new Set(['text']),
    })
    const registry: Parameters<typeof createRegistryHost<View>>[0] = {
      Page: registration('Page'),
      Stack: registration('Stack'),
      Grid: registration('Grid'),
      Scroll: registration('Scroll'),
      Text: registration('Text'),
      Button: registration('Button'),
      TextField: {
        ...registration('TextField'),
        captureLocalState: (view) => ({ selectionStart: view.selection }),
        restoreLocalState: (view, state) => {
          view.selection = state.selectionStart ?? 0
        },
      },
      Switch: registration('Switch'),
      ActivityIndicator: registration('ActivityIndicator'),
      Image: registration('Image'),
      List: registration('List'),
    }
    const host = createRegistryHost(registry, {
      setProperty: (view, name, value) => {
        view.props[name] = value
      },
      addEventListener: (view, name, listener) => {
        const listeners = view.listeners.get(name) ?? new Set()
        listeners.add(listener)
        view.listeners.set(name, listeners)
      },
      removeEventListener: (view, name, listener) => view.listeners.get(name)?.delete(listener),
      insertChild: (parent, child, index) => {
        const previous = parent.children.indexOf(child)
        if (previous >= 0) parent.children.splice(previous, 1)
        parent.children.splice(index, 0, child)
      },
      removeChild: (parent, child) => {
        const index = parent.children.indexOf(child)
        if (index >= 0) parent.children.splice(index, 1)
      },
    })
    const renderer = createNativeRenderer<string, View>({ host, dispatch: () => undefined })
    const field = renderer.render(nativeElement('TextField', { props: { text: 'Before' } }))
    field.selection = 4
    renderer.render(nativeElement('TextField', { props: { text: 'After' } }))
    expect(field.selection).toBe(4)
    expect(field.props.text).toBe('After')
  })
})
