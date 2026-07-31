import { Label, type View } from '@nativescript/core'
import type { NativeElementAdapter } from '@orikit/renderer-nativescript'

type MotionNode = Readonly<{ props?: Readonly<Record<string, unknown>> }>

const patch = (label: Label, node: MotionNode): void => {
  const samples = Number(node.props?.samples ?? 0)
  const magnitude = Number(node.props?.magnitude ?? 0)
  label.text =
    samples === 0
      ? 'Motion sensor waiting for a sample'
      : `Motion · ${magnitude.toFixed(2)} m/s² · ${samples} samples`
  label.accessibilityLabel = 'Accelerometer status'
  label.className = 'devtools-status'
}

export const motionSummaryAdapter: NativeElementAdapter<MotionNode, View> = {
  create: (node) => {
    const label = new Label()
    patch(label, node)
    return label
  },
  update: (view, _previous, next) => patch(view as Label, next),
  dispose: () => undefined,
}
