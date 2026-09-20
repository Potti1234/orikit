import {
  type InspectorResponse,
  parseInspectorRequest,
  type RelayEnvelope,
} from '@orikit/devtools-protocol'
import type { TodoApplication } from '@orikit/todo'

import { connectDebugSocket } from './debug-socket'

export type TodoDevtoolsClient = Readonly<{
  pairingCode: string
  status: () => 'Connecting' | 'Connected' | 'Disconnected'
  dispose: () => void
}>

const pairingCode = (): string => String(Math.floor(100_000 + Math.random() * 900_000))

export const connectTodoDevtools = (
  application: TodoApplication,
  onStatus: (status: string) => void,
): TodoDevtoolsClient | undefined => {
  if (!__DEV__) return undefined
  const history = application.devtools()
  if (history === undefined) return undefined
  const code = pairingCode()
  let connection: 'Connecting' | 'Connected' | 'Disconnected' = 'Connecting'
  let opened = false

  const send = (envelope: RelayEnvelope): void => {
    if (opened) socket.send(JSON.stringify(envelope))
  }
  const info = (paired: boolean) => ({ ...history.runtimeInfo(), paired })
  const publish = (): void => {
    const exported = history.exportHistory()
    const current = history.snapshot()
    const selected =
      current.mode._tag === 'Traveling' ? current.mode.sequence : current.liveSequence
    const model =
      exported.records.find((record) => record.sequence === selected)?.modelAfter ?? null
    send({
      _tag: 'RuntimeState',
      info: info(true),
      model,
      records: exported.records,
      resources: history.resources(),
    })
  }
  const respond = (response: InspectorResponse): void =>
    send({ _tag: 'InspectorResponse', response })

  const socket = connectDebugSocket('127.0.0.1', 4317, `/runtime?code=${code}`, {
    onOpen: () => {
      opened = true
      connection = 'Connected'
      onStatus(`Inspector ready · pairing ${code}`)
      console.log(`ORIKIT_INSPECTOR_PAIRING:${code}`)
      send({ _tag: 'RuntimeHello', pairingCode: code, info: info(false) })
      publish()
    },
    onClosed: () => {
      opened = false
      connection = 'Disconnected'
      onStatus('Inspector relay disconnected')
    },
    onError: () => {
      connection = 'Disconnected'
      onStatus('Inspector relay unavailable')
    },
    onMessage: (value) => {
      try {
        const envelope = JSON.parse(value) as { _tag?: string; request?: unknown }
        if (envelope._tag !== 'InspectorRequest') return
        const request = parseInspectorRequest(envelope.request)
        const currentInfo = history.runtimeInfo()
        if ('expectedSessionId' in request && request.expectedSessionId !== currentInfo.sessionId) {
          throw new Error('Runtime session changed')
        }
        switch (request._tag) {
          case 'Pair':
            if (request.code !== code) throw new Error('Pairing code rejected')
            respond({ id: request.id, ok: true, result: info(true) })
            break
          case 'GetRuntimeInfo':
            respond({ id: request.id, ok: true, result: info(true) })
            break
          case 'ListEvents':
            respond({ id: request.id, ok: true, result: history.exportHistory().records })
            break
          case 'GetCurrentModel': {
            const snapshot = history.snapshot()
            const selected =
              snapshot.mode._tag === 'Traveling' ? snapshot.mode.sequence : snapshot.liveSequence
            respond({
              id: request.id,
              ok: true,
              result: history.exportHistory().records.find((record) => record.sequence === selected)
                ?.modelAfter,
            })
            break
          }
          case 'TravelTo':
            history.travelTo(request.sequence)
            respond({ id: request.id, ok: true, result: history.snapshot().mode })
            break
          case 'ResumeLive':
            history.resumeLive()
            respond({ id: request.id, ok: true, result: history.snapshot().mode })
            break
          case 'ExportHistory':
            respond({ id: request.id, ok: true, result: history.exportHistory() })
            break
        }
      } catch (failure) {
        respond({
          id: 'invalid',
          ok: false,
          error: failure instanceof Error ? failure.message : String(failure),
        })
      }
    },
  })
  const unsubscribe = history.subscribe(() => publish())
  onStatus(`Inspector connecting · pairing ${code}`)
  return {
    pairingCode: code,
    status: () => connection,
    dispose: () => {
      unsubscribe()
      socket.close()
    },
  }
}
