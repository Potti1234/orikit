import type { DebugSocket, DebugSocketHandlers } from './debug-socket'

export const connectDebugSocket = (
  host: string,
  port: number,
  path: string,
  handlers: DebugSocketHandlers,
): DebugSocket => {
  const socket = OriKitDebugSocket.new()
  let live = true

  const closed = (): void => {
    if (!live) return
    live = false
    handlers.onClosed()
  }

  socket.connectWithUrlOnOpenOnMessageOnErrorOnClosed(
    `ws://${host}:${port}${path}`,
    () => {
      if (live) handlers.onOpen()
    },
    (value) => {
      if (live) handlers.onMessage(String(value))
    },
    (message) => {
      if (live) handlers.onError(String(message))
    },
    closed,
  )

  return {
    send: (value) => {
      if (live) socket.send(value)
    },
    close: () => {
      if (!live) return
      socket.close()
    },
  }
}
