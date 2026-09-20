import type { SubscriptionDefinition } from '@orikit/runtime'
import type { TodoMessage, TodoModel } from '@orikit/todo'

export declare const platformMotionSubscription: () => SubscriptionDefinition<
  TodoModel,
  TodoMessage
>
