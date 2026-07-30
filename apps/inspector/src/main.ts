import type {
  DevtoolsEventRecord,
  HistoryExport,
  RecordedResourceState,
  RelayEnvelope,
  RuntimeInfo,
} from '@orikit/devtools-protocol'
import './style.css'

const app = document.querySelector<HTMLElement>('#app')
if (app === null) throw new Error('Missing inspector root')

app.innerHTML = `<header><div><p class="eyebrow">ORIKIT · REMOTE DEVTOOLS</p><h1>Runtime inspector</h1></div><div class="connect"><input id="code" inputmode="numeric" maxlength="6" placeholder="Pairing code" aria-label="Pairing code"><button id="connect">Connect</button><span id="status">Offline</span></div></header><section class="mode"><strong id="mode">No runtime</strong><button id="resume" disabled>Resume live</button><button id="export" disabled>Export redacted history</button><label class="import">Import history<input id="import" type="file" accept="application/json"></label></section><div class="workspace"><aside><h2>Messages</h2><p class="hint">Select to inspect · double-click to travel</p><ol id="timeline"></ol></aside><section class="detail"><h2 id="eventTitle">Select an event</h2><div class="panes"><article><h3>Model</h3><pre id="model">—</pre></article><article><h3>Model diff</h3><pre id="diff">—</pre></article><article><h3>Message / Commands / Resources</h3><pre id="effects">—</pre></article></div></section></div>`

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id)
  if (value === null) throw new Error(`Missing #${id}`)
  return value as T
}
let socket: WebSocket | undefined
let info: RuntimeInfo | undefined
let records: ReadonlyArray<DevtoolsEventRecord> = []
let selected: number | undefined
let resources: ReadonlyArray<RecordedResourceState> = []

const modelDiff = (before: unknown, after: unknown, path = '$'): ReadonlyArray<string> => {
  if (Object.is(before, after)) return []
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null)
    return [`${path}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`]
  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  return [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].flatMap((key) =>
    modelDiff(beforeRecord[key], afterRecord[key], `${path}.${key}`),
  )
}

const renderDetail = (): void => {
  const record = records.find((candidate) => candidate.sequence === selected) ?? records.at(-1)
  if (record === undefined) return
  selected = record.sequence
  element('eventTitle').textContent =
    `Event ${record.sequence} · ${String((record.message as { _tag?: string } | undefined)?._tag ?? 'Initial snapshot')}`
  element('model').textContent = JSON.stringify(record.modelAfter, null, 2)
  const previous =
    records[records.findIndex((candidate) => candidate.sequence === record.sequence) - 1]
  element('diff').textContent =
    record.sequence === 0
      ? 'Initial model'
      : modelDiff(previous?.modelAfter, record.modelAfter).join('\n') || 'No model changes'
  element('effects').textContent = JSON.stringify(
    {
      message: record.message,
      commands: record.commands,
      resourceChanges: record.resourceChanges,
      activeResources: resources,
    },
    null,
    2,
  )
}
const render = (): void => {
  element('status').textContent =
    info === undefined ? 'Waiting for runtime' : `${info.program.name} · ${info.sessionId}`
  element('mode').textContent =
    info === undefined
      ? 'No runtime'
      : info.mode._tag === 'Live'
        ? `LIVE · EVENT ${info.liveSequence}`
        : `HISTORICAL · EVENT ${info.mode.sequence} · LIVE ${info.liveSequence}`
  element<HTMLButtonElement>('resume').disabled = info?.mode._tag !== 'Traveling'
  element<HTMLButtonElement>('export').disabled = info === undefined
  const timeline = element<HTMLOListElement>('timeline')
  timeline.replaceChildren(
    ...records.map((record) => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.textContent = `${record.sequence}  ${(record.message as { _tag?: string } | undefined)?._tag ?? 'Snapshot'}`
      button.className = record.sequence === selected ? 'selected' : ''
      button.onclick = () => {
        selected = record.sequence
        renderDetail()
        render()
      }
      button.ondblclick = () => request({ _tag: 'TravelTo', sequence: record.sequence })
      item.append(button)
      return item
    }),
  )
  renderDetail()
}
const request = (
  value:
    | { _tag: 'TravelTo'; sequence: number }
    | { _tag: 'ResumeLive' }
    | { _tag: 'ExportHistory' },
): void => {
  if (socket?.readyState !== WebSocket.OPEN || info === undefined) return
  const id = crypto.randomUUID()
  const inspectorRequest =
    value._tag === 'TravelTo'
      ? {
          id,
          _tag: 'TravelTo' as const,
          sequence: value.sequence,
          expectedSessionId: info.sessionId,
        }
      : value._tag === 'ResumeLive'
        ? { id, _tag: 'ResumeLive' as const, expectedSessionId: info.sessionId }
        : { id, _tag: 'ExportHistory' as const }
  socket.send(
    JSON.stringify({ _tag: 'InspectorRequest', request: inspectorRequest } satisfies RelayEnvelope),
  )
}

element<HTMLButtonElement>('connect').onclick = () => {
  socket?.close()
  const code = element<HTMLInputElement>('code').value.trim()
  socket = new WebSocket(`ws://127.0.0.1:4317/inspector?code=${encodeURIComponent(code)}`)
  socket.onopen = () => {
    element('status').textContent = 'Connected · waiting for runtime'
  }
  socket.onclose = () => {
    info = undefined
    element('status').textContent = 'Disconnected'
    render()
  }
  socket.onmessage = (event) => {
    const envelope = JSON.parse(String(event.data)) as RelayEnvelope
    if (envelope._tag === 'RuntimeHello') info = envelope.info
    if (envelope._tag === 'RuntimeState') {
      info = envelope.info
      records = envelope.records
      resources = envelope.resources
      selected ??= records.at(-1)?.sequence
    }
    if (
      envelope._tag === 'InspectorResponse' &&
      envelope.response.ok &&
      typeof envelope.response.result === 'object' &&
      envelope.response.result !== null &&
      'fingerprintNamespace' in envelope.response.result
    )
      download(envelope.response.result as HistoryExport)
    render()
  }
}
element<HTMLButtonElement>('resume').onclick = () => request({ _tag: 'ResumeLive' })
element<HTMLButtonElement>('export').onclick = () => request({ _tag: 'ExportHistory' })
element<HTMLInputElement>('import').onchange = async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0]
  if (file === undefined) return
  const archive = JSON.parse(await file.text()) as HistoryExport
  info = undefined
  records = archive.records
  resources = []
  selected = records.at(-1)?.sequence
  render()
}
const download = (archive: HistoryExport): void => {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(
    new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }),
  )
  anchor.download = `orikit-${archive.program.name}-history.json`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}
render()
