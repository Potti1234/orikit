import WebSocket from 'ws'
import type { RelayEnvelope, RuntimeInfo } from '@orikit/devtools-protocol'

const code = process.argv[2]
if (code === undefined || !/^\d{6}$/.test(code)) throw new Error('Provide the six-digit pairing code')
const socket = new WebSocket(`ws://127.0.0.1:4317/inspector?code=${code}`)
const messages: Array<RelayEnvelope> = []
socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as RelayEnvelope))
await new Promise<void>((resolve, reject) => {
  socket.once('open', resolve)
  socket.once('error', reject)
})
const waitFor = async <Value>(select: () => Value | undefined, timeout = 10_000): Promise<Value> => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const value = select()
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Timed out waiting for inspector protocol state')
}
const latestState = () => [...messages].reverse().find((message) => message._tag === 'RuntimeState')
const initial = await waitFor(latestState)
if (initial._tag !== 'RuntimeState') throw new Error('Expected RuntimeState')
if (initial.info.program.name !== 'todo') throw new Error('Connected runtime is not Todo')
if (JSON.stringify(initial).includes('Remote_secret')) throw new Error('Sensitive draft crossed transport')

let responseIndex = 0
const request = async (request: RelayEnvelope & { _tag: 'InspectorRequest' }): Promise<unknown> => {
  socket.send(JSON.stringify(request))
  const response = await waitFor(() => {
    const candidates = messages.filter((message) => message._tag === 'InspectorResponse')
    const candidate = candidates[responseIndex]
    if (candidate === undefined || candidate._tag !== 'InspectorResponse') return undefined
    responseIndex += 1
    return candidate.response
  })
  if (!response.ok) throw new Error(response.error ?? 'Inspector request failed')
  return response.result
}
const sessionId = initial.info.sessionId
await request({
  _tag: 'InspectorRequest',
  request: { id: 'travel', _tag: 'TravelTo', sequence: 0, expectedSessionId: sessionId },
})
const historical = await waitFor(() => {
  const state = latestState()
  return state?._tag === 'RuntimeState' && state.info.mode._tag === 'Traveling' ? state : undefined
})
console.log(`ORIKIT_REMOTE_TRAVEL_READY:${JSON.stringify(historical.info)}`)
await new Promise((resolve) => setTimeout(resolve, 10_000))
await request({
  _tag: 'InspectorRequest',
  request: { id: 'resume', _tag: 'ResumeLive', expectedSessionId: sessionId },
})
const resumed = await waitFor(() => {
  const state = latestState()
  return state?._tag === 'RuntimeState' && state.info.mode._tag === 'Live' ? state.info : undefined
})
const report: Readonly<{ status: 'pass'; runtime: RuntimeInfo; records: number; redaction: 'pass' }> = {
  status: 'pass',
  runtime: resumed,
  records: initial.records.length,
  redaction: 'pass',
}
console.log(JSON.stringify(report, undefined, 2))
socket.close()
