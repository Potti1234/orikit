export const devtoolsProtocolVersion = 1 as const

export type DevtoolsMode =
  | Readonly<{ _tag: 'Live' }>
  | Readonly<{ _tag: 'Traveling'; sequence: number }>

export type RecordedCommand = Readonly<{
  commandId?: string
  description: unknown
}>

export type DevtoolsEventRecord = Readonly<{
  program: Readonly<{ name: string; schemaVersion: number; buildVersion: string }>
  sessionId: string
  branchId: string
  sequence: number
  source: unknown
  message?: unknown
  modelBeforeFingerprint: string
  modelAfter: unknown
  modelAfterFingerprint: string
  commands: ReadonlyArray<RecordedCommand>
  updateDurationMicros: number
  snapshot: boolean
}>

export type RuntimeInfo = Readonly<{
  protocolVersion: typeof devtoolsProtocolVersion
  program: DevtoolsEventRecord['program']
  sessionId: string
  branchId: string
  liveSequence: number
  mode: DevtoolsMode
  paired: boolean
  mutation: 'ReadOnly' | 'TravelResume'
}>

export type HistoryExport = Readonly<{
  protocolVersion: typeof devtoolsProtocolVersion
  fingerprintNamespace: 'redacted-v1'
  exportedAt: string
  program: DevtoolsEventRecord['program']
  records: ReadonlyArray<DevtoolsEventRecord>
}>

export type InspectorRequest =
  | Readonly<{ id: string; _tag: 'Pair'; code: string }>
  | Readonly<{ id: string; _tag: 'GetRuntimeInfo' }>
  | Readonly<{ id: string; _tag: 'ListEvents' }>
  | Readonly<{ id: string; _tag: 'GetCurrentModel' }>
  | Readonly<{ id: string; _tag: 'TravelTo'; sequence: number; expectedSessionId: string }>
  | Readonly<{ id: string; _tag: 'ResumeLive'; expectedSessionId: string }>
  | Readonly<{ id: string; _tag: 'ExportHistory' }>

export type InspectorResponse = Readonly<{
  id: string
  ok: boolean
  result?: unknown
  error?: string
}>

export type RelayEnvelope =
  | Readonly<{ _tag: 'RuntimeHello'; pairingCode: string; info: RuntimeInfo }>
  | Readonly<{
      _tag: 'RuntimeState'
      info: RuntimeInfo
      model: unknown
      records: ReadonlyArray<DevtoolsEventRecord>
    }>
  | Readonly<{ _tag: 'InspectorRequest'; request: InspectorRequest }>
  | Readonly<{ _tag: 'InspectorResponse'; response: InspectorResponse }>

export const parseInspectorRequest = (input: unknown): InspectorRequest => {
  if (typeof input !== 'object' || input === null)
    throw new Error('Inspector request must be an object')
  const value = input as Record<string, unknown>
  if (typeof value.id !== 'string' || typeof value._tag !== 'string')
    throw new Error('Inspector request needs id and _tag')
  switch (value._tag) {
    case 'Pair':
      if (typeof value.code !== 'string') throw new Error('Pair needs code')
      return { id: value.id, _tag: 'Pair', code: value.code }
    case 'GetRuntimeInfo':
    case 'ListEvents':
    case 'GetCurrentModel':
    case 'ExportHistory':
      return { id: value.id, _tag: value._tag }
    case 'TravelTo':
      if (typeof value.sequence !== 'number' || typeof value.expectedSessionId !== 'string')
        throw new Error('TravelTo fields invalid')
      return {
        id: value.id,
        _tag: 'TravelTo',
        sequence: value.sequence,
        expectedSessionId: value.expectedSessionId,
      }
    case 'ResumeLive':
      if (typeof value.expectedSessionId !== 'string') throw new Error('ResumeLive fields invalid')
      return { id: value.id, _tag: 'ResumeLive', expectedSessionId: value.expectedSessionId }
    default:
      throw new Error(`Unknown inspector request ${String(value._tag)}`)
  }
}
