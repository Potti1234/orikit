import {
  type DevtoolsEventRecord,
  type DevtoolsMode,
  devtoolsProtocolVersion,
  type HistoryExport,
  type RecordedResourceState,
  type RuntimeInfo,
} from '@orikit/devtools-protocol'
import type { ManagedResourceEvent, ProductionRuntime, RuntimeSnapshot } from '@orikit/runtime'
import { codecsFor, type Program, type Tagged } from '@orikit/spike-core'

import { fingerprint, type JsonValue } from './canonical'
import { redactValue } from './redaction'

export type DevtoolsSnapshot<Model> = Readonly<{
  liveModel: Model
  visibleModel: Model
  liveSequence: number
  mode: DevtoolsMode
}>

export type DevtoolsHistory<Model> = Readonly<{
  snapshot: () => DevtoolsSnapshot<Model>
  records: () => ReadonlyArray<DevtoolsEventRecord>
  runtimeInfo: () => RuntimeInfo
  reconstruct: (sequence: number) => Model
  travelTo: (sequence: number) => void
  resumeLive: () => void
  subscribe: (observer: (snapshot: DevtoolsSnapshot<Model>) => void) => () => void
  exportHistory: () => HistoryExport
  resources: () => ReadonlyArray<RecordedResourceState>
  dispose: () => void
}>

export type DevtoolsHistoryOptions<
  Flags,
  Model,
  Message extends Tagged,
  Command extends Tagged,
> = Readonly<{
  program: Program<Flags, Model, Message, Command>
  runtime: ProductionRuntime<Model, Message, Command>
  maxEvents?: number
  maxBytes?: number
  snapshotInterval?: number
  sensitivePaths?: ReadonlyArray<string>
  nowIso?: () => string
  managedResources?: () => ReadonlyArray<RecordedResourceState>
  managedResourceEvents?: () => ReadonlyArray<ManagedResourceEvent>
}>

const json = (value: unknown): JsonValue => value as JsonValue

export const createDevtoolsHistory = <Flags, Model, Message extends Tagged, Command extends Tagged>(
  options: DevtoolsHistoryOptions<Flags, Model, Message, Command>,
): DevtoolsHistory<Model> => {
  const codecs = codecsFor(options.program)
  const maxEvents = options.maxEvents ?? 500
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024
  const snapshotInterval = options.snapshotInterval ?? 50
  const observers = new Set<(snapshot: DevtoolsSnapshot<Model>) => void>()
  let liveModel = options.runtime.current()
  let visibleModel = liveModel
  let mode: DevtoolsMode = { _tag: 'Live' }
  let disposed = false
  const initialRuntime = options.runtime.snapshot()
  const initialEncoded = codecs.encodeModel(liveModel)
  let resourceOrdinal = 0
  const takeResourceChanges = (sequence: number): ReadonlyArray<ManagedResourceEvent> => {
    const changes = (options.managedResourceEvents?.() ?? []).filter(
      (event) => event.ordinal > resourceOrdinal && event.causedBySequence <= sequence,
    )
    resourceOrdinal = Math.max(resourceOrdinal, ...changes.map((event) => event.ordinal), 0)
    return changes
  }
  const records: Array<DevtoolsEventRecord> = [
    {
      program: options.program.identity,
      sessionId: initialRuntime.sessionId,
      branchId: initialRuntime.branchId,
      sequence: 0,
      source: { _tag: 'Runtime' },
      modelBeforeFingerprint: fingerprint(json(initialEncoded)),
      modelAfter: initialEncoded,
      modelAfterFingerprint: fingerprint(json(initialEncoded)),
      commands: [],
      resourceChanges: takeResourceChanges(0),
      updateDurationMicros: 0,
      snapshot: true,
    },
  ]

  const snapshot = (): DevtoolsSnapshot<Model> => ({
    liveModel,
    visibleModel,
    liveSequence: options.runtime.snapshot().sequence,
    mode,
  })
  const publish = (): void => {
    const value = snapshot()
    for (const observer of observers) observer(value)
  }
  const runtimeUnsubscribe = options.runtime.subscribe(
    (runtimeSnapshot: RuntimeSnapshot<Model, Command>) => {
      if (disposed || runtimeSnapshot.sequence === records.at(-1)?.sequence) return
      const transition = [...options.runtime.events()]
        .reverse()
        .find(
          (event) =>
            event._tag === 'TransitionCommitted' && event.sequence === runtimeSnapshot.sequence,
        )
      if (transition === undefined || transition._tag !== 'TransitionCommitted') return
      const beforeEncoded = codecs.encodeModel(liveModel)
      liveModel = runtimeSnapshot.model
      const afterEncoded = codecs.encodeModel(liveModel)
      records.push({
        program: options.program.identity,
        sessionId: runtimeSnapshot.sessionId,
        branchId: runtimeSnapshot.branchId,
        sequence: runtimeSnapshot.sequence,
        source: transition.source,
        message: codecs.encodeMessage(transition.message),
        modelBeforeFingerprint: fingerprint(json(beforeEncoded)),
        modelAfter: afterEncoded,
        modelAfterFingerprint: fingerprint(json(afterEncoded)),
        commands: transition.commands.map((command) => ({
          description: codecs.encodeCommand(command),
        })),
        resourceChanges: takeResourceChanges(runtimeSnapshot.sequence),
        updateDurationMicros: transition.updateDurationMilliseconds * 1_000,
        snapshot: runtimeSnapshot.sequence % snapshotInterval === 0,
      })
      const historyBytes = (): number =>
        records.reduce((total, record) => total + JSON.stringify(record).length * 2, 0)
      if (records.length > maxEvents || historyBytes() > maxBytes) {
        while (records.length > 1 && (records.length > maxEvents || historyBytes() > maxBytes))
          records.shift()
        const first = records[0]
        if (first !== undefined && !first.snapshot) records[0] = { ...first, snapshot: true }
      }
      if (mode._tag === 'Live') visibleModel = liveModel
      publish()
    },
  )

  const reconstruct = (sequence: number): Model => {
    const targetIndex = records.findIndex((record) => record.sequence === sequence)
    if (targetIndex < 0) throw new RangeError(`Unknown history sequence ${sequence}`)
    let snapshotIndex = targetIndex
    while (snapshotIndex > 0 && !records[snapshotIndex]?.snapshot) snapshotIndex -= 1
    const origin = records[snapshotIndex]
    if (origin === undefined) throw new RangeError(`No snapshot for sequence ${sequence}`)
    let reconstructed = codecs.decodeModel(origin.modelAfter)
    for (let index = snapshotIndex + 1; index <= targetIndex; index += 1) {
      const record = records[index]
      if (record?.message === undefined)
        throw new Error(`Missing Message at sequence ${record?.sequence}`)
      reconstructed = codecs.decodeModel(
        options.program.update(reconstructed, codecs.decodeMessage(record.message))[0],
      )
      const actual = fingerprint(json(codecs.encodeModel(reconstructed)))
      if (actual !== record.modelAfterFingerprint)
        throw new Error(`Replay diverged at sequence ${record.sequence}`)
    }
    return reconstructed
  }

  return {
    snapshot,
    records: () => [...records],
    runtimeInfo: () => {
      const current = options.runtime.snapshot()
      return {
        protocolVersion: devtoolsProtocolVersion,
        program: options.program.identity,
        sessionId: current.sessionId,
        branchId: current.branchId,
        liveSequence: current.sequence,
        mode,
        paired: false,
        mutation: 'TravelResume',
      }
    },
    reconstruct,
    travelTo: (sequence) => {
      visibleModel = reconstruct(sequence)
      mode = { _tag: 'Traveling', sequence }
      publish()
    },
    resumeLive: () => {
      visibleModel = liveModel
      mode = { _tag: 'Live' }
      publish()
    },
    subscribe: (observer) => {
      observers.add(observer)
      observer(snapshot())
      return () => observers.delete(observer)
    },
    exportHistory: () => ({
      protocolVersion: devtoolsProtocolVersion,
      fingerprintNamespace: 'redacted-v1',
      exportedAt: options.nowIso?.() ?? new Date().toISOString(),
      program: options.program.identity,
      records: records.map((record) => {
        const modelAfter = redactValue(record.modelAfter, options.sensitivePaths ?? [])
        const message = redactValue(record.message, options.sensitivePaths ?? [])
        const commands = record.commands.map((command) => ({
          ...command,
          description: redactValue(command.description, options.sensitivePaths ?? []),
        }))
        const resourceChanges = redactValue(
          record.resourceChanges,
          options.sensitivePaths ?? [],
        ) as typeof record.resourceChanges
        return {
          ...record,
          modelAfter,
          commands,
          resourceChanges,
          ...(record.message === undefined ? {} : { message }),
          modelBeforeFingerprint: `redacted-v1:${record.modelBeforeFingerprint}`,
          modelAfterFingerprint: `redacted-v1:${fingerprint(json(modelAfter))}`,
        }
      }),
    }),
    resources: () =>
      redactValue(
        options.managedResources?.() ?? [],
        options.sensitivePaths ?? [],
      ) as ReadonlyArray<RecordedResourceState>,
    dispose: () => {
      disposed = true
      runtimeUnsubscribe()
      observers.clear()
    },
  }
}
