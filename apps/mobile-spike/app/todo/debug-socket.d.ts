export type DebugSocketHandlers = Readonly<{
  onOpen: () => void
  onMessage: (value: string) => void
  onClosed: () => void
  onError: (message: string) => void
}>

export type DebugSocket = Readonly<{
  send: (value: string) => void
  close: () => void
}>

export declare const connectDebugSocket: (
  host: string,
  port: number,
  path: string,
  handlers: DebugSocketHandlers,
) => DebugSocket
