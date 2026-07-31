import type { NavigatedData, Page, StackLayout, View } from '@nativescript/core'
import {
  createPortableCounterRuntime,
  type PortableCounterRuntime,
  RequestedPortableIncrement,
} from '@orikit/foldkit-portable-spike'
import {
  createNativeRenderer,
  type NativeRenderer,
  nativeElement,
} from '@orikit/renderer-nativescript'

import { createNativeScriptHost } from './nativescript-host'

let runtime: PortableCounterRuntime | undefined
let renderer: NativeRenderer<ReturnType<typeof RequestedPortableIncrement>, View> | undefined
let unsubscribe: (() => void) | undefined

const tree = (count: number) =>
  nativeElement<ReturnType<typeof RequestedPortableIncrement>>('Stack', {
    props: { spacing: 16, padding: 20 },
    accessibility: { name: 'Foldkit native host renderer' },
    children: [
      nativeElement('Text', {
        key: 'title',
        props: { text: 'Foldkit reconciler host proof', textWrap: true },
        accessibility: { name: 'Foldkit reconciler host proof', role: 'header' },
      }),
      nativeElement('Text', {
        key: 'count',
        props: { text: String(count) },
        accessibility: { name: `Rendered counter value ${count}`, testId: 'renderer-count' },
      }),
      nativeElement('Button', {
        key: 'increment',
        props: { text: 'Run Foldkit Command' },
        events: { tap: RequestedPortableIncrement() },
        accessibility: { name: 'Run Foldkit Command', testId: 'renderer-increment' },
      }),
    ],
  })

export function onNavigatingTo(args: NavigatedData): void {
  onUnloaded()
  const page = args.object as Page
  const container = page.getViewById<StackLayout>('rendererHost')
  if (container === undefined) throw new Error('Missing renderer host container')
  runtime = createPortableCounterRuntime()
  renderer = createNativeRenderer({
    host: createNativeScriptHost(),
    dispatch: (message) => runtime?.dispatch(message),
  })
  unsubscribe = runtime.subscribe(({ model }) => {
    const root = renderer?.render(tree(model.count))
    if (root !== undefined && container.getChildIndex(root) < 0) container.addChild(root)
  })
  console.log('ORIKIT_FOLDKIT_RENDERER_READY')
}

export function onUnloaded(): void {
  unsubscribe?.()
  renderer?.dispose()
  runtime?.dispose()
  unsubscribe = undefined
  renderer = undefined
  runtime = undefined
}
