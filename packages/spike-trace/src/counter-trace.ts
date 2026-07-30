import {
  type CounterMessage,
  decremented,
  encodeCounterMessage,
  encodeCounterModel,
  incremented,
  initialCounterModel,
  reset,
  updateCounter,
} from '@orikit/spike-core'

import { canonicalJson, fingerprint, type JsonValue } from './canonical'

export const counterFixtureMessages = (): ReadonlyArray<CounterMessage> => [
  incremented(),
  incremented(),
  decremented(),
  reset(),
  incremented(),
]

export type CanonicalTraceEvent = Readonly<{
  sequence: number
  message: JsonValue
  modelFingerprint: string
  commands: ReadonlyArray<JsonValue>
}>

export type CanonicalCounterTrace = Readonly<{
  fixture: 'counter-v1'
  program: Readonly<{
    name: 'counter'
    schemaVersion: 1
    buildVersion: '0.0.0-spike'
  }>
  initialModel: JsonValue
  events: ReadonlyArray<CanonicalTraceEvent>
  finalModelFingerprint: string
}>

export const runCounterFixture = (): CanonicalCounterTrace => {
  let model = initialCounterModel()
  const initialModel = encodeCounterModel(model) as JsonValue
  const events: Array<CanonicalTraceEvent> = []

  for (const [index, message] of counterFixtureMessages().entries()) {
    const [nextModel, commands] = updateCounter(model, message)
    model = nextModel
    events.push({
      sequence: index + 1,
      message: encodeCounterMessage(message) as JsonValue,
      modelFingerprint: fingerprint(encodeCounterModel(model) as JsonValue),
      commands: commands as ReadonlyArray<JsonValue>,
    })
  }

  return {
    fixture: 'counter-v1',
    program: {
      name: 'counter',
      schemaVersion: 1,
      buildVersion: '0.0.0-spike',
    },
    initialModel,
    events,
    finalModelFingerprint: fingerprint(encodeCounterModel(model) as JsonValue),
  }
}

export const canonicalCounterTrace = (): string => canonicalJson(runCounterFixture() as JsonValue)
