import {
  Button,
  type EventData,
  type Label,
  type NavigatedData,
  type Page,
  type StackLayout,
} from '@nativescript/core'
import {
  type CounterCommand,
  type CounterMessage,
  type CounterModel,
  compatibilityCompleted,
  createSpikeRuntime,
  decodeCounterMessage,
  decremented,
  deviceInfoLoaded,
  incremented,
  initialCounterModel,
  nativeGreetingLoaded,
  type RuntimeSnapshot,
  reset,
  runEffectCompatibilityChecks,
  type SpikeRuntime,
  updateCounter,
} from '@orikit/spike-core'
import { canonicalCounterTrace, runCounterFixture } from '@orikit/spike-trace'

import {
  nativeLanguage,
  platformId,
  platformTag,
  readPlatformEvidence,
  setPlatformButtonEnabled,
} from './platform-capabilities'

type CounterRuntime = SpikeRuntime<CounterModel, CounterMessage, CounterCommand>
type CounterSnapshot = RuntimeSnapshot<CounterModel, CounterMessage, CounterCommand>

let runtime: CounterRuntime | undefined
let unsubscribe: (() => void) | undefined
let activePage: Page | undefined
const renderDurations: Array<number> = []

const now = (): number => globalThis.performance?.now() ?? Date.now()

const percentile = (samples: ReadonlyArray<number>, value: number): number => {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * value) - 1] ?? 0
}

const requireRuntime = (): CounterRuntime => {
  if (runtime === undefined) {
    throw new Error('Counter runtime is not initialized')
  }
  return runtime
}

const view = <ViewType>(page: Page, id: string): ViewType => {
  const match = page.getViewById(id)
  if (match === undefined) {
    throw new Error(`Missing native view #${id}`)
  }
  return match as ViewType
}

const render = (page: Page, snapshot: CounterSnapshot): void => {
  const started = now()
  const traveling = snapshot.mode._tag === 'Traveling'
  const count = view<Label>(page, 'count')
  count.text = String(snapshot.visibleModel.count)
  count.accessibilityLabel = `Counter value ${snapshot.visibleModel.count}`

  const mode = view<Label>(page, 'mode')
  mode.text = traveling
    ? `PAST · EVENT ${snapshot.mode.sequence} · LIVE ${snapshot.liveModel.count}`
    : 'LIVE'
  mode.accessibilityLabel = mode.text

  view<Button>(page, 'resume').visibility = traveling ? 'visible' : 'collapsed'

  const device = snapshot.visibleModel.device
  view<Label>(page, 'device').text =
    device._tag === 'Loaded'
      ? `Direct platform API: ${device.model}, API ${device.sdk}`
      : 'Platform API: loading…'

  const greeting = snapshot.visibleModel.greeting
  view<Label>(page, 'greeting').text =
    greeting._tag === 'Loaded'
      ? `${nativeLanguage}: ${greeting.value}`
      : `${nativeLanguage}: loading…`

  const compatibility = snapshot.visibleModel.compatibility
  view<Label>(page, 'effect').text =
    compatibility._tag === 'Loaded'
      ? `Effect checks: ${compatibility.passed}/${compatibility.total} passed`
      : 'Effect checks: running…'

  const history = view<StackLayout>(page, 'history')
  history.removeChildren()
  for (const entry of snapshot.history) {
    const button = new Button()
    button.text = `${entry.sequence}: ${entry.message?._tag ?? 'Initial'} → ${entry.modelAfter.count}`
    button.accessibilityLabel = `Travel to history event ${entry.sequence}`
    button.className =
      traveling && snapshot.mode.sequence === entry.sequence
        ? 'history-button selected'
        : 'history-button'
    button.on(Button.tapEvent, () => {
      const travelStarted = now()
      requireRuntime().travelTo(entry.sequence)
      console.log(`ORIKIT_TRAVEL_RENDER_MS:${now() - travelStarted}`)
    })
    history.addChild(button)
  }

  // Rebuilding the history layout can trigger another Android property pass,
  // so transition-control state is the final native patch in this render.
  for (const id of ['decrement', 'increment', 'reset']) {
    setPlatformButtonEnabled(view<Button>(page, id), !traveling)
  }
  renderDurations.push(now() - started)
}

const initializeEvidence = async (counterRuntime: CounterRuntime): Promise<void> => {
  const platform = readPlatformEvidence()
  counterRuntime.dispatch(deviceInfoLoaded(platform.deviceModel, platform.sdk))
  counterRuntime.dispatch(nativeGreetingLoaded(platform.nativeGreeting))

  const effect = await runEffectCompatibilityChecks(platformId)
  const checks = Object.values(effect.checks)
  const passed = checks.filter((check) => check.status === 'pass').length
  counterRuntime.dispatch(compatibilityCompleted(passed, checks.length))
  await counterRuntime.flush()

  const trace = canonicalCounterTrace()
  const fixture = runCounterFixture()
  if (activePage !== undefined) {
    view<Label>(activePage, 'trace').text =
      `Canonical trace: ${fixture.events.length} events · ${fixture.finalModelFingerprint.slice(0, 12)}…`
  }

  console.log(`ORIKIT_EFFECT_${platformTag}:${JSON.stringify(effect)}`)
  // NativeScript routes console output through the platform log, whose
  // effective payload can be much smaller than the nominal line limit.
  const traceParts = trace.match(/.{1,600}/g) ?? []
  for (const [index, part] of traceParts.entries()) {
    console.log(`ORIKIT_TRACE_${platformTag}:${index + 1}/${traceParts.length}:${part}`)
  }
  console.log(
    `ORIKIT_READY:${JSON.stringify({
      effectPassed: passed,
      effectTotal: checks.length,
      finalModelFingerprint: fixture.finalModelFingerprint,
      nativeGreeting: platform.nativeGreeting,
      sdk: platform.sdk,
    })}`,
  )
}

export function onNavigatingTo(args: NavigatedData): void {
  onUnloaded()
  const page = args.object as Page
  activePage = page
  runtime = createSpikeRuntime<CounterModel, CounterMessage, CounterCommand>({
    initialModel: initialCounterModel(),
    decodeMessage: decodeCounterMessage,
    update: updateCounter,
  })
  unsubscribe = runtime.subscribe((snapshot) => render(page, snapshot))
  void initializeEvidence(runtime)
}

export function onIncrement(_args: EventData): void {
  const counterRuntime = requireRuntime()
  if (counterRuntime.status()._tag === 'Running') {
    counterRuntime.dispatch(incremented())
  }
}

export function onDecrement(_args: EventData): void {
  const counterRuntime = requireRuntime()
  if (counterRuntime.status()._tag === 'Running') {
    counterRuntime.dispatch(decremented())
  }
}

export function onReset(_args: EventData): void {
  const counterRuntime = requireRuntime()
  if (counterRuntime.status()._tag === 'Running') {
    counterRuntime.dispatch(reset())
  }
}

export function onResume(_args: EventData): void {
  requireRuntime().resume()
  console.log(
    `ORIKIT_RENDER_METRICS:${JSON.stringify({
      samples: renderDurations.length,
      p50Milliseconds: percentile(renderDurations, 0.5),
      p95Milliseconds: percentile(renderDurations, 0.95),
      maxMilliseconds: Math.max(...renderDurations),
    })}`,
  )
}

export function onUnloaded(): void {
  unsubscribe?.()
  runtime?.dispose()
  unsubscribe = undefined
  runtime = undefined
  activePage = undefined
  renderDurations.length = 0
}
