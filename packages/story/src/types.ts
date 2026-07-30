import type { JsonValue } from '@orikit/spike-trace'

export type StoryOrigin =
  | Readonly<{ _tag: 'Flags'; flags: JsonValue }>
  | Readonly<{ _tag: 'Model'; model: JsonValue }>

export type StoryTraceState = Readonly<{
  model: JsonValue
  modelFingerprint: string
  commands: ReadonlyArray<JsonValue>
}>

export type StoryTraceEvent = Readonly<{
  sequence: number
  source: 'Message' | 'Resolution'
  message: JsonValue
  completedCommand?: JsonValue
  state: StoryTraceState
}>

export type StoryTrace = Readonly<{
  formatVersion: 1
  program: Readonly<{
    name: string
    schemaVersion: number
    buildVersion: string
  }>
  origin: StoryOrigin
  initial: StoryTraceState
  events: ReadonlyArray<StoryTraceEvent>
}>
