declare namespace dev.orikit.device {
  class DebugWebSocketListener {
    constructor(implementation: {
      onOpen(): void
      onMessage(value: string): void
      onClosed(): void
      onError(message: string): void
    })
  }
  class DebugWebSocketClient {
    constructor(listener: DebugWebSocketListener)
    connect(host: string, port: number, path: string): void
    send(value: string): void
    close(): void
  }
}
