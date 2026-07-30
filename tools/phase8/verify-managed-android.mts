import type { RelayEnvelope } from '@orikit/devtools-protocol'
import WebSocket from 'ws'

const code = process.argv[2]
if (code === undefined || !/^\d{6}$/.test(code))
  throw new Error('Provide the six-digit pairing code')
const socket = new WebSocket(`ws://127.0.0.1:4317/inspector?code=${code}`)
const messages: Array<RelayEnvelope> = []
socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as RelayEnvelope))
await new Promise<void>((resolve, reject) => {
  socket.once('open', resolve)
  socket.once('error', reject)
})

const waitFor = async <Value,>(
  select: () => Value | undefined,
  timeout = 12_000,
): Promise<Value> => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const value = select()
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Timed out waiting for managed Android state')
}
const latestState = () => [...messages].reverse().find((message) => message._tag === 'RuntimeState')
const initial = await waitFor(latestState)
if (initial._tag !== 'RuntimeState') throw new Error('Expected RuntimeState')
const accelerometer = initial.resources.find((resource) => resource.id === 'android.accelerometer')
if (accelerometer === undefined || accelerometer.status === 'Failed')
  throw new Error('Android accelerometer is not managed by the runtime')
const causal = initial.records.find(
  (record) =>
    (record.message as { _tag?: string } | undefined)?._tag === 'MotionObserved' &&
    (record.source as { _tag?: string })._tag === 'Subscription',
)
if (causal === undefined) throw new Error('No causally attributed MotionObserved event')

let responseIndex = 0
const request = async (request: RelayEnvelope & { _tag: 'InspectorRequest' }): Promise<void> => {
  socket.send(JSON.stringify(request))
  const response = await waitFor(() => {
    const candidate = messages.filter((message) => message._tag === 'InspectorResponse')[
      responseIndex
    ]
    if (candidate?._tag !== 'InspectorResponse') return undefined
    responseIndex += 1
    return candidate.response
  })
  if (!response.ok) throw new Error(response.error ?? 'Inspector request failed')
}
const sessionId = initial.info.sessionId
const selected = initial.records[Math.max(0, initial.records.length - 10)]?.sequence ?? 0
const generation = accelerometer.generation
const liveBefore = initial.info.liveSequence
await request({
  _tag: 'InspectorRequest',
  request: { id: 'travel', _tag: 'TravelTo', sequence: selected, expectedSessionId: sessionId },
})
await waitFor(() => {
  const state = latestState()
  return state?._tag === 'RuntimeState' && state.info.mode._tag === 'Traveling' ? state : undefined
})
await new Promise((resolve) => setTimeout(resolve, 3_000))
const duringTravel = await waitFor(() => {
  const state = latestState()
  return state?._tag === 'RuntimeState' && state.info.liveSequence > liveBefore ? state : undefined
})
if (duringTravel._tag !== 'RuntimeState') throw new Error('Expected RuntimeState while traveling')
if (
  duringTravel.resources.find((resource) => resource.id === 'android.accelerometer')?.generation !==
  generation
)
  throw new Error('Historical travel restarted the Android resource')
await request({
  _tag: 'InspectorRequest',
  request: { id: 'resume', _tag: 'ResumeLive', expectedSessionId: sessionId },
})
const resumed = await waitFor(() => {
  const state = latestState()
  return state?._tag === 'RuntimeState' && state.info.mode._tag === 'Live' ? state : undefined
})
if (resumed._tag !== 'RuntimeState') throw new Error('Expected resumed RuntimeState')
console.log(
  JSON.stringify(
    {
      status: 'pass',
      resource: resumed.resources.find((resource) => resource.id === 'android.accelerometer'),
      causalSource: causal.source,
      liveAdvancedDuringTravel: resumed.info.liveSequence > liveBefore,
      generationStable: true,
      records: resumed.records.length,
    },
    undefined,
    2,
  ),
)
socket.close()
