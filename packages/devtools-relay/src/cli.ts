import { startDevtoolsRelay } from './index'

const relay = await startDevtoolsRelay(Number(process.env.ORIKIT_INSPECTOR_PORT ?? 4317))
console.log(`ORIKIT_DEVTOOLS_RELAY_READY:ws://127.0.0.1:${relay.port}`)
const stop = async (): Promise<void> => {
  await relay.close()
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
