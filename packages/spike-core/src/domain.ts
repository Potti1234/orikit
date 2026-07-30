import { Match, Schema } from 'effect'
import type { Transition } from './program'

export const DeviceState = Schema.Union([
  Schema.TaggedStruct('Unknown', {}),
  Schema.TaggedStruct('Loaded', {
    model: Schema.String,
    sdk: Schema.Number,
  }),
])

export const GreetingState = Schema.Union([
  Schema.TaggedStruct('Unknown', {}),
  Schema.TaggedStruct('Loaded', {
    value: Schema.String,
  }),
])

export const CompatibilityState = Schema.Union([
  Schema.TaggedStruct('Unknown', {}),
  Schema.TaggedStruct('Loaded', {
    passed: Schema.Number,
    total: Schema.Number,
  }),
])

export const CounterModel = Schema.Struct({
  count: Schema.Number,
  device: DeviceState,
  greeting: GreetingState,
  compatibility: CompatibilityState,
})

export type CounterModel = typeof CounterModel.Type

export const Incremented = Schema.TaggedStruct('Incremented', {})
export const Decremented = Schema.TaggedStruct('Decremented', {})
export const Reset = Schema.TaggedStruct('Reset', {})
export const DeviceInfoLoaded = Schema.TaggedStruct('DeviceInfoLoaded', {
  model: Schema.String,
  sdk: Schema.Number,
})
export const NativeGreetingLoaded = Schema.TaggedStruct('NativeGreetingLoaded', {
  value: Schema.String,
})
export const CompatibilityCompleted = Schema.TaggedStruct('CompatibilityCompleted', {
  passed: Schema.Number,
  total: Schema.Number,
})

export const CounterMessage = Schema.Union([
  Incremented,
  Decremented,
  Reset,
  DeviceInfoLoaded,
  NativeGreetingLoaded,
  CompatibilityCompleted,
])

export type CounterMessage = typeof CounterMessage.Type

export type CounterCommand = never

const counterTransition = (model: CounterModel): Transition<CounterModel, CounterCommand> => [
  model,
  [],
]

export const initialCounterModel = (): CounterModel => ({
  count: 0,
  device: { _tag: 'Unknown' },
  greeting: { _tag: 'Unknown' },
  compatibility: { _tag: 'Unknown' },
})

export const incremented = (): CounterMessage => ({ _tag: 'Incremented' })
export const decremented = (): CounterMessage => ({ _tag: 'Decremented' })
export const reset = (): CounterMessage => ({ _tag: 'Reset' })

export const deviceInfoLoaded = (model: string, sdk: number): CounterMessage => ({
  _tag: 'DeviceInfoLoaded',
  model,
  sdk,
})

export const nativeGreetingLoaded = (value: string): CounterMessage => ({
  _tag: 'NativeGreetingLoaded',
  value,
})

export const compatibilityCompleted = (passed: number, total: number): CounterMessage => ({
  _tag: 'CompatibilityCompleted',
  passed,
  total,
})

export const updateCounter = (
  model: CounterModel,
  message: CounterMessage,
): Transition<CounterModel, CounterCommand> =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      Incremented: () =>
        counterTransition({
          ...model,
          count: model.count + 1,
        }),
      Decremented: () =>
        counterTransition({
          ...model,
          count: model.count - 1,
        }),
      Reset: () =>
        counterTransition({
          ...model,
          count: 0,
        }),
      DeviceInfoLoaded: ({ model: deviceModel, sdk }) =>
        counterTransition({
          ...model,
          device: {
            _tag: 'Loaded',
            model: deviceModel,
            sdk,
          },
        }),
      NativeGreetingLoaded: ({ value }) =>
        counterTransition({
          ...model,
          greeting: {
            _tag: 'Loaded',
            value,
          },
        }),
      CompatibilityCompleted: ({ passed, total }) =>
        counterTransition({
          ...model,
          compatibility: {
            _tag: 'Loaded',
            passed,
            total,
          },
        }),
    }),
  )

export const decodeCounterMessage = Schema.decodeUnknownSync(CounterMessage)
export const decodeCounterModel = Schema.decodeUnknownSync(CounterModel)
export const encodeCounterMessage = Schema.encodeSync(CounterMessage)
export const encodeCounterModel = Schema.encodeSync(CounterModel)
