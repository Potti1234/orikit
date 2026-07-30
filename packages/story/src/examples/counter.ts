import {
  type CounterCommand,
  CounterMessage,
  type CounterMessage as CounterMessageType,
  CounterModel,
  type CounterModel as CounterModelType,
  defineCommandContract,
  defineProgram,
  incremented,
  initialCounterModel,
  updateCounter,
} from '@orikit/spike-core'
import { Schema } from 'effect'

import { runStory, Story } from '../story'

export const CounterFlags = Schema.Struct({})
export type CounterFlags = typeof CounterFlags.Type

export const counterProgram = defineProgram<
  CounterFlags,
  CounterModelType,
  CounterMessageType,
  CounterCommand
>({
  identity: {
    name: 'counter',
    schemaVersion: 1,
    buildVersion: '0.0.0-phase2',
  },
  Flags: CounterFlags,
  Model: CounterModel,
  Message: CounterMessage,
  Command: Schema.Never,
  commandContract: defineCommandContract<CounterCommand, CounterMessageType>({}),
  init: () => [initialCounterModel(), []],
  update: updateCounter,
})

export const runCounterStory = () =>
  runStory(counterProgram, [
    Story.flags({}),
    Story.message(incremented()),
    Story.message(incremented()),
    Story.expectModelPartial<CounterModelType>({ count: 2 }),
  ])
