import type { DebugSocket, DebugSocketHandlers } from './debug-socket'

export const connectDebugSocket = (
  host: string,
  port: number,
  path: string,
  handlers: DebugSocketHandlers,
): DebugSocket => {
  const listener = new dev.orikit.device.DebugWebSocketListener({
    onOpen: () => handlers.onOpen(),
    onMessage: (value) => handlers.onMessage(value),
    onClosed: () => handlers.onClosed(),
    onError: (message) => handlers.onError(message),
  })
  const client = new dev.orikit.device.DebugWebSocketClient(listener)
  client.connect(host, port, path)
  return {
    send: (value) => client.send(value),
    close: () => client.close(),
  }
}
