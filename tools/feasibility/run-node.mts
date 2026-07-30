import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { arch, platform, release } from 'node:os'

import {
  incremented,
  initialCounterModel,
  runEffectCompatibilityChecks,
  updateCounter,
} from '../../packages/spike-core/src/index.ts'
import { canonicalCounterTrace, runCounterFixture } from '../../packages/spike-trace/src/index.ts'

const root = new URL('../../', import.meta.url)
const artifacts = new URL('artifacts/feasibility/', root)

const packageVersion = async (path: string): Promise<string> => {
  const contents = await readFile(new URL(path, root), 'utf8')
  return (JSON.parse(contents) as { version: string }).version
}

const percentile = (samples: ReadonlyArray<number>, value: number): number => {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * value) - 1] ?? 0
}

await mkdir(artifacts, { recursive: true })

const effect = await runEffectCompatibilityChecks('node')
const trace = runCounterFixture()
const updateSamples: Array<number> = []
let model = initialCounterModel()

for (let index = 0; index < 20_000; index += 1) {
  const started = performance.now()
  const [nextModel] = updateCounter(model, incremented())
  updateSamples.push(performance.now() - started)
  model = nextModel
}

const environment = {
  capturedAt: new Date().toISOString(),
  host: {
    platform: platform(),
    release: release(),
    arch: arch(),
  },
  node: process.versions.node,
  packages: {
    effect: await packageVersion('node_modules/effect/package.json'),
    nativescriptCli: await packageVersion('node_modules/nativescript/package.json'),
    nativescriptCore: await packageVersion('node_modules/@nativescript/core/package.json'),
    nativescriptAndroid: await packageVersion('node_modules/@nativescript/android/package.json'),
    typescript: await packageVersion('node_modules/typescript/package.json'),
  },
  benchmark: {
    name: 'pure-counter-update',
    samples: updateSamples.length,
    p50Milliseconds: percentile(updateSamples, 0.5),
    p95Milliseconds: percentile(updateSamples, 0.95),
    maxMilliseconds: Math.max(...updateSamples),
    historyBytesPerCanonicalEvent: Math.ceil(canonicalCounterTrace().length / trace.events.length),
  },
}

await Promise.all([
  writeFile(
    new URL('environment.json', artifacts),
    `${JSON.stringify(environment, null, 2)}\n`,
    'utf8',
  ),
  writeFile(new URL('effect-node.json', artifacts), `${JSON.stringify(effect, null, 2)}\n`, 'utf8'),
  writeFile(new URL('trace-node.json', artifacts), canonicalCounterTrace(), 'utf8'),
])

const failed = Object.entries(effect.checks).filter(([, check]) => check.status !== 'pass')
if (failed.length > 0) {
  throw new Error(`Node Effect checks failed: ${failed.map(([name]) => name).join(', ')}`)
}

console.log(
  JSON.stringify({
    effect: `${Object.keys(effect.checks).length}/${Object.keys(effect.checks).length}`,
    traceFingerprint: trace.finalModelFingerprint,
    updateP95Milliseconds: environment.benchmark.p95Milliseconds,
  }),
)
