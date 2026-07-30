import type { Tagged } from '@orikit/spike-core'

import type { ProductionRuntime, RuntimeAbortSignal, RuntimeDefect } from './types'

export type ManagedRestartPolicy = Readonly<{ maxAttempts: number; delayMilliseconds?: number }>

export type ManagedContext<Message> = Readonly<{
  signal: RuntimeAbortSignal
  dispatch: (message: Message) => void
}>

export type SubscriptionDefinition<Model, Message> = Readonly<{
  id: string
  key: (model: Model) => unknown
  active?: (model: Model) => boolean
  start: (model: Model, context: ManagedContext<Message>) => void | Promise<void>
  restart?: ManagedRestartPolicy
}>

export type ResourceDefinition<Model, Message, Handle = unknown> = Readonly<{
  id: string
  desired: (model: Model) => false | unknown
  acquire: (key: unknown, context: ManagedContext<Message>) => Handle | Promise<Handle>
  release: (handle: Handle) => void | Promise<void>
  restart?: ManagedRestartPolicy
}>

export type ManagedResourceState = Readonly<{
  kind: 'Subscription' | 'Resource'
  id: string
  key: unknown
  generation: number
  status: 'Starting' | 'Active' | 'Stopping' | 'Failed'
  restartAttempt: number
}>

export type ManagedResourceEvent = Readonly<{
  ordinal: number
  kind: 'Subscription' | 'Resource'
  id: string
  key: unknown
  generation: number
  causedBySequence: number
  action: 'Started' | 'Preserved' | 'Stopped' | 'Emitted' | 'Failed' | 'RestartScheduled'
  reason?: 'Inactive' | 'KeyChanged' | 'BranchChanged' | 'Disposed' | 'Defect'
  defect?: RuntimeDefect
}>

export type ManagedRuntime<Model, Message, Command> = ProductionRuntime<Model, Message, Command> &
  Readonly<{
    managedResources: () => ReadonlyArray<ManagedResourceState>
    managedResourceEvents: () => ReadonlyArray<ManagedResourceEvent>
    settleManagedResources: () => Promise<void>
  }>

export type ManagedRuntimeOptions<Model, Message extends Tagged> = Readonly<{
  subscriptions?: ReadonlyArray<SubscriptionDefinition<Model, Message>>
  resources?: ReadonlyArray<ResourceDefinition<Model, Message, unknown>>
  eventLimit?: number
  delay?: (milliseconds: number) => Promise<void>
}>
