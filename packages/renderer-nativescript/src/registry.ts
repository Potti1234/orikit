import type { NativeElementKind, NativeHost, RendererLocalState } from './types'

export type NativeElementRegistration<View> = Readonly<{
  create: () => View
  properties: ReadonlySet<string>
  insertChild?: (parent: View, child: View, index: number) => void
  removeChild?: (parent: View, child: View) => void
  captureLocalState?: (view: View) => RendererLocalState
  restoreLocalState?: (view: View, state: RendererLocalState) => void
  dispose?: (view: View) => void
}>

export type NativeElementRegistry<View> = Readonly<
  Record<NativeElementKind, NativeElementRegistration<View>>
>

export type RegistryHostOperations<View> = Readonly<{
  setProperty: (view: View, name: string, value: unknown) => void
  addEventListener: (view: View, name: string, listener: (event: unknown) => void) => void
  removeEventListener: (view: View, name: string, listener: (event: unknown) => void) => void
  insertChild: (parent: View, child: View, index: number) => void
  removeChild: (parent: View, child: View) => void
}>

const emptyState: RendererLocalState = {}

export const createRegistryHost = <View>(
  registry: NativeElementRegistry<View>,
  operations: RegistryHostOperations<View>,
): NativeHost<View> => {
  const registrations = new WeakMap<object, NativeElementRegistration<View>>()
  const registrationFor = (view: View): NativeElementRegistration<View> => {
    if ((typeof view !== 'object' && typeof view !== 'function') || view === null) {
      throw new Error('Registry hosts require object-backed native views')
    }
    const registration = registrations.get(view as object)
    if (registration === undefined) throw new Error('View was not created by this registry')
    return registration
  }

  return {
    create: (kind) => {
      const registration = registry[kind]
      const view = registration.create()
      registrations.set(view as object, registration)
      return view
    },
    setProperty: operations.setProperty,
    supportedProperties: (kind) => registry[kind].properties,
    addEventListener: operations.addEventListener,
    removeEventListener: operations.removeEventListener,
    insertChild: (parent, child, index) =>
      (registrationFor(parent).insertChild ?? operations.insertChild)(parent, child, index),
    removeChild: (parent, child) =>
      (registrationFor(parent).removeChild ?? operations.removeChild)(parent, child),
    captureLocalState: (view) => registrationFor(view).captureLocalState?.(view) ?? emptyState,
    restoreLocalState: (view, state) => registrationFor(view).restoreLocalState?.(view, state),
    dispose: (view) => {
      registrationFor(view).dispose?.(view)
      registrations.delete(view as object)
    },
  }
}
