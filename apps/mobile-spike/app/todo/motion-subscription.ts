import { Application } from '@nativescript/core'
import type { SubscriptionDefinition } from '@orikit/runtime'
import { motionObserved, type TodoMessage, type TodoModel } from '@orikit/todo'

export const androidMotionSubscription = (): SubscriptionDefinition<TodoModel, TodoMessage> => ({
  id: 'android.accelerometer',
  key: () => 'normal',
  start: (_model, context) => {
    const listener = new dev.orikit.device.MotionSensorListener({
      onSample: (magnitude) => context.dispatch(motionObserved(Math.round(magnitude * 100) / 100)),
      onUnavailable: () => undefined,
    })
    const stream = new dev.orikit.device.MotionSensorStream(Application.android.context, listener)
    stream.start()
    context.signal.addEventListener('abort', () => stream.stop(), { once: true })
  },
})
