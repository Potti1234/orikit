import {
  createNativeRenderer,
  type NativeElementKind,
  type NativeHost,
  nativeElement,
  type RendererLocalState,
} from '@orikit/renderer-nativescript'

type BenchmarkView = {
  readonly kind: NativeElementKind
  readonly properties: Record<string, unknown>
  readonly listeners: Map<string, Set<(event: unknown) => void>>
  readonly children: Array<BenchmarkView>
  state: RendererLocalState
}

const properties = new Set([
  'text',
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityRole',
  'accessibilityState',
  'automationText',
])

const host: NativeHost<BenchmarkView> = {
  create: (kind) => ({ kind, properties: {}, listeners: new Map(), children: [], state: {} }),
  setProperty: (view, name, value) => {
    view.properties[name] = value
  },
  supportedProperties: () => properties,
  addEventListener: (view, name, listener) => {
    const listeners = view.listeners.get(name) ?? new Set()
    listeners.add(listener)
    view.listeners.set(name, listeners)
  },
  removeEventListener: (view, name, listener) => {
    view.listeners.get(name)?.delete(listener)
  },
  insertChild: (parent, child, index) => {
    const previous = parent.children.indexOf(child)
    if (previous >= 0) parent.children.splice(previous, 1)
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
  dispose: () => undefined,
}

const renderer = createNativeRenderer<never, BenchmarkView>({ host, dispatch: () => undefined })
const tree = (changed: number) =>
  nativeElement<never>('List', {
    children: Array.from({ length: 100 }, (_, index) =>
      nativeElement('Text', {
        key: `row-${index}`,
        props: { text: index === changed ? `Changed ${changed}` : `Row ${index}` },
      }),
    ),
  })

renderer.render(tree(-1))
const samples: Array<number> = []
for (let index = 0; index < 1_000; index += 1) {
  const started = performance.now()
  renderer.render(tree(index % 100))
  samples.push(performance.now() - started)
}
samples.sort((left, right) => left - right)
const percentile = (fraction: number): number =>
  samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))] ?? 0
const report = {
  nodesPerTree: 101,
  samples: samples.length,
  medianMilliseconds: percentile(0.5),
  p95Milliseconds: percentile(0.95),
  maximumMilliseconds: samples.at(-1) ?? 0,
  budgetMilliseconds: 8,
  status: percentile(0.95) < 8 ? 'pass' : 'fail',
}
console.log(JSON.stringify(report, undefined, 2))
if (report.status === 'fail') process.exitCode = 1
