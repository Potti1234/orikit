import { execFile, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { canonicalTodoTrace } from '@orikit/spike-trace'

const run = promisify(execFile)

const workspace = new URL('../../', import.meta.url)
const artifacts = new URL('artifacts/phase10/', workspace)
const bundle = fileURLToPath(
  new URL('apps/mobile-spike/platforms/ios/build/Debug-iphonesimulator/mobilespike.app', workspace),
)
const applicationId = 'dev.orikit.spike'
const deviceName = process.env.ORIKIT_IOS_SIMULATOR ?? 'iPhone 17'

type SimulatorDevice = Readonly<{ udid: string; name: string; state: string; isAvailable: boolean }>

const listDevices = async (): Promise<ReadonlyArray<SimulatorDevice>> => {
  const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', '--json'])
  const parsed = JSON.parse(stdout) as { devices: Record<string, Array<SimulatorDevice>> }
  return Object.values(parsed.devices).flat()
}

const device = (await listDevices()).find(
  (candidate) => candidate.isAvailable && candidate.name === deviceName,
)
if (device === undefined) throw new Error(`No available simulator named ${deviceName}`)

if (device.state !== 'Booted') {
  await run('xcrun', ['simctl', 'boot', device.udid])
  await run('xcrun', ['simctl', 'bootstatus', device.udid])
}

await run('xcrun', ['simctl', 'install', device.udid, bundle])
await run('xcrun', ['simctl', 'terminate', device.udid, applicationId]).catch(() => undefined)

const lines: Array<string> = []
const logs = spawn('xcrun', [
  'simctl',
  'spawn',
  device.udid,
  'log',
  'stream',
  '--style',
  'compact',
  '--predicate',
  'process == "mobilespike"',
])
logs.stdout.setEncoding('utf8')
logs.stdout.on('data', (chunk: string) => {
  for (const line of chunk.split('\n')) if (line.includes('CONSOLE LOG:')) lines.push(line)
})
await new Promise((resolve) => setTimeout(resolve, 3_000))

await run('xcrun', ['simctl', 'launch', device.udid, applicationId])

const message = (marker: string): string | undefined =>
  lines.find((line) => line.includes(marker))?.split(marker)[1]

const waitFor = async (marker: string, timeout = 30_000): Promise<string> => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const value = message(marker)
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for ${marker}`)
}

const ready = JSON.parse(await waitFor('ORIKIT_TODO_READY:')) as Record<string, unknown>

const traceParts = lines
  .map((line) => /ORIKIT_TODO_TRACE_IOS:(\d+)\/(\d+):(.*)$/.exec(line))
  .filter((match): match is RegExpExecArray => match !== null)
  .sort((left, right) => Number(left[1]) - Number(right[1]))
const trace = traceParts.map((match) => match[3]).join('')
const expected = canonicalTodoTrace()
if (trace !== expected) throw new Error('Canonical Todo trace mismatch between iOS and Node')

await mkdir(artifacts, { recursive: true })
await writeFile(new URL('trace-ios.json', artifacts), trace, 'utf8')
await run('xcrun', [
  'simctl',
  'io',
  device.udid,
  'screenshot',
  fileURLToPath(new URL('todo-ios.png', artifacts)),
])
logs.kill()

const evidence = {
  status: 'pass',
  device: { name: device.name, udid: device.udid },
  bundle: applicationId,
  traceBytes: Buffer.byteLength(trace),
  ready,
}
await writeFile(
  new URL('evidence.json', artifacts),
  `${JSON.stringify(evidence, undefined, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(evidence, undefined, 2))
