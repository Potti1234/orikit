import { createServer, type Server } from 'node:http'
import { type WebSocket, WebSocketServer } from 'ws'

export type Relay = Readonly<{ port: number; close: () => Promise<void> }>

export const startDevtoolsRelay = async (port = 4317): Promise<Relay> => {
  const server = createServer((_request, response) => {
    response.writeHead(404).end()
  })
  const sockets = new Set<WebSocket>()
  let runtime: WebSocket | undefined
  let pairingCode: string | undefined
  let latestHello: string | undefined
  let latestState: string | undefined
  const inspectors = new Set<WebSocket>()
  const websocket = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const role =
      url.pathname === '/runtime'
        ? 'runtime'
        : url.pathname === '/inspector'
          ? 'inspector'
          : undefined
    const code = url.searchParams.get('code') ?? ''
    if (role === undefined || (role === 'inspector' && code !== pairingCode)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    websocket.handleUpgrade(request, socket, head, (client) => {
      sockets.add(client)
      if (role === 'runtime') {
        runtime?.close(1012, 'Runtime replaced')
        runtime = client
        pairingCode = code
      } else {
        inspectors.add(client)
        if (latestHello !== undefined) client.send(latestHello)
        if (latestState !== undefined) client.send(latestState)
      }
      client.on('message', (data, binary) => {
        if (binary) return
        if (client === runtime) {
          const text = data.toString()
          try {
            const envelope = JSON.parse(text) as { _tag?: string }
            if (envelope._tag === 'RuntimeHello') latestHello = text
            if (envelope._tag === 'RuntimeState') latestState = text
          } catch {
            return
          }
          for (const inspector of inspectors)
            if (inspector.readyState === inspector.OPEN) inspector.send(text)
        } else if (runtime?.readyState === 1) {
          runtime.send(data.toString())
        }
      })
      client.on('close', () => {
        sockets.delete(client)
        inspectors.delete(client)
        if (client === runtime) {
          runtime = undefined
          pairingCode = undefined
          latestHello = undefined
          latestState = undefined
          for (const inspector of inspectors) inspector.close(1012, 'Runtime disconnected')
        }
      })
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address !== null ? address.port : port
  return {
    port: actualPort,
    close: async () => {
      for (const socket of sockets) socket.terminate()
      await new Promise<void>((resolve) => (server as Server).close(() => resolve()))
    },
  }
}
