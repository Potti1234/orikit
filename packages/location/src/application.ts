import {
  createProductionRuntime,
  type ProductionRuntime,
  type RuntimeEvent,
  type RuntimeLifecycle,
  type RuntimeMetrics,
  type RuntimeSnapshot,
  type RuntimeStatus,
} from '@orikit/runtime'

import type { LocationCapability } from './capability'
import {
  type LocationCommand,
  type LocationMessage,
  type LocationModel,
  locationProgram,
  locationReadFailed,
  locationResolved,
  permissionResolved,
} from './program'

type Runtime = ProductionRuntime<LocationModel, LocationMessage, LocationCommand>

const nativeFailure = (failure: unknown): LocationMessage => {
  console.error('Location capability failed', failure)
  return locationReadFailed('NativeFailure')
}

const interpret = async (
  capability: LocationCapability,
  command: LocationCommand,
  signal: Parameters<LocationCapability['checkPermission']>[0],
): Promise<LocationMessage> => {
  try {
    switch (command._tag) {
      case 'CheckLocationPermission':
        return permissionResolved(await capability.checkPermission(signal))
      case 'RequestLocationPermission':
        return permissionResolved(await capability.requestPermission(signal))
      case 'ReadCurrentLocation': {
        const result = await capability.readCurrentLocation(signal)
        return result._tag === 'Located'
          ? locationResolved(result.fix)
          : locationReadFailed(result.reason)
      }
    }
  } catch (failure) {
    signal.throwIfAborted()
    return nativeFailure(failure)
  }
}

export type LocationApplication = Readonly<{
  dispatch: (message: LocationMessage) => void
  current: () => LocationModel
  snapshot: () => RuntimeSnapshot<LocationModel, LocationCommand>
  subscribe: (observer: (model: LocationModel) => void) => () => void
  status: () => RuntimeStatus
  events: () => ReadonlyArray<RuntimeEvent<LocationMessage, LocationCommand>>
  metrics: () => RuntimeMetrics
  reportLifecycle: (lifecycle: RuntimeLifecycle) => void
  enterBackground: () => Promise<void>
  returnForeground: () => void
  settle: () => Promise<void>
  dispose: () => void
}>

export const createLocationApplication = (capability: LocationCapability): LocationApplication => {
  const runtime: Runtime = createProductionRuntime({
    program: locationProgram,
    flags: {},
    interpret: (command, { signal }) => interpret(capability, command, signal),
  })
  return {
    dispatch: (message) => runtime.dispatch(message),
    current: runtime.current,
    snapshot: runtime.snapshot,
    subscribe: (observer) => runtime.subscribe(({ model }) => observer(model)),
    status: runtime.status,
    events: runtime.events,
    metrics: runtime.metrics,
    reportLifecycle: runtime.reportLifecycle,
    enterBackground: async () => {
      runtime.reportLifecycle('EnteredBackground')
      runtime.dispatch({ _tag: 'EnteredBackground' }, { _tag: 'Lifecycle' })
      await runtime.flush()
      runtime.replaceBranch(runtime.current())
    },
    returnForeground: () => {
      runtime.reportLifecycle('ReturnedForeground')
      runtime.dispatch({ _tag: 'ReturnedForeground' }, { _tag: 'Lifecycle' })
    },
    settle: runtime.settle,
    dispose: runtime.dispose,
  }
}
