import { createProductionRuntime } from '../../packages/runtime/src/index.ts'
import {
  draftChanged,
  todoProgram,
  todosLoaded,
  todosSaved,
} from '../../packages/todo/src/index.ts'

const runtime = createProductionRuntime({
  program: todoProgram,
  flags: {},
  interpret: async (command) => {
    switch (command._tag) {
      case 'LoadTodos':
        return todosLoaded([])
      case 'SaveTodos':
        return todosSaved()
    }
  },
  eventLimit: 256,
  now: () => performance.now(),
})

await runtime.settle()
const before = runtime.metrics()
const started = performance.now()
for (let index = 0; index < 10_000; index += 1) {
  runtime.dispatch(draftChanged(`draft-${index}`))
}
await runtime.flush()
const elapsedMilliseconds = performance.now() - started
const after = runtime.metrics()

console.log(
  JSON.stringify(
    {
      status: runtime.status()._tag,
      messages: after.committedMessages - before.committedMessages,
      finalSequence: runtime.snapshot().sequence,
      finalDraft: runtime.current().draft,
      elapsedMilliseconds,
      messagesPerSecond: 10_000 / (elapsedMilliseconds / 1_000),
      maximumQueueDepth: after.maximumQueueDepth,
      maximumUpdateMilliseconds: after.maximumUpdateMilliseconds,
      averageUpdateMilliseconds:
        (after.totalUpdateMilliseconds - before.totalUpdateMilliseconds) /
        (after.committedMessages - before.committedMessages),
      retainedRuntimeEvents: runtime.events().length,
      droppedRuntimeEvents: after.droppedEvents,
    },
    null,
    2,
  ),
)

runtime.dispose()
