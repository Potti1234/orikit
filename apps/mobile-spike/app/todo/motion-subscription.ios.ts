import type { SubscriptionDefinition } from '@orikit/runtime'
import { motionObserved, type TodoMessage, type TodoModel } from '@orikit/todo'

const gravity = 9.80665
const sampleIntervalSeconds = 2

export const platformMotionSubscription = (): SubscriptionDefinition<TodoModel, TodoMessage> => ({
  id: 'ios.accelerometer',
  key: () => 'normal',
  start: (_model, context) => {
    const manager = CMMotionManager.alloc().init()
    if (!manager.accelerometerAvailable) {
      console.log('ORIKIT_MOTION_UNAVAILABLE:ios')
      return
    }
    manager.accelerometerUpdateInterval = sampleIntervalSeconds
    manager.startAccelerometerUpdatesToQueueWithHandler(
      NSOperationQueue.mainQueue,
      (data, _error) => {
        if (data === null) return
        const sample = data.acceleration
        const magnitude =
          Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z) * gravity
        context.dispatch(motionObserved(Math.round(magnitude * 100) / 100))
      },
    )
    context.signal.addEventListener('abort', () => manager.stopAccelerometerUpdates(), {
      once: true,
    })
  },
})
