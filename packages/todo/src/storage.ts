import type {
  LoadTodos,
  SaveTodos,
  Todo,
  TodoCommand,
  TodoMessage,
  TodosLoaded,
  TodosLoadFailed,
  TodosSaved,
  TodosSaveFailed,
} from './program'
import { todosLoaded, todosLoadFailed, todosSaved, todosSaveFailed } from './program'

export type TodoStorage = Readonly<{
  load: () => Promise<ReadonlyArray<Todo>>
  save: (todos: ReadonlyArray<Todo>) => Promise<void>
}>

export type InMemoryTodoStorage = TodoStorage &
  Readonly<{
    snapshot: () => ReadonlyArray<Todo>
    failNextLoad: (reason: string) => void
    failNextSave: (reason: string) => void
  }>

const messageFrom = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure)

export const createInMemoryTodoStorage = (
  initialTodos: ReadonlyArray<Todo> = [],
): InMemoryTodoStorage => {
  let stored = [...initialTodos]
  let nextLoadFailure: string | undefined
  let nextSaveFailure: string | undefined

  return {
    load: async () => {
      if (nextLoadFailure !== undefined) {
        const reason = nextLoadFailure
        nextLoadFailure = undefined
        throw new Error(reason)
      }
      return stored.map((todo) => ({ ...todo }))
    },
    save: async (todos) => {
      if (nextSaveFailure !== undefined) {
        const reason = nextSaveFailure
        nextSaveFailure = undefined
        throw new Error(reason)
      }
      stored = todos.map((todo) => ({ ...todo }))
    },
    snapshot: () => stored.map((todo) => ({ ...todo })),
    failNextLoad: (reason) => {
      nextLoadFailure = reason
    },
    failNextSave: (reason) => {
      nextSaveFailure = reason
    },
  }
}

export function interpretTodoCommand(
  command: LoadTodos,
  storage: TodoStorage,
): Promise<TodosLoaded | TodosLoadFailed>
export function interpretTodoCommand(
  command: SaveTodos,
  storage: TodoStorage,
): Promise<TodosSaved | TodosSaveFailed>
export function interpretTodoCommand(
  command: TodoCommand,
  storage: TodoStorage,
): Promise<TodoMessage>
export async function interpretTodoCommand(
  command: TodoCommand,
  storage: TodoStorage,
): Promise<TodoMessage> {
  switch (command._tag) {
    case 'LoadTodos':
      try {
        return todosLoaded(await storage.load())
      } catch (failure) {
        return todosLoadFailed(messageFrom(failure))
      }
    case 'SaveTodos':
      try {
        await storage.save(command.todos)
        return todosSaved()
      } catch (failure) {
        return todosSaveFailed(messageFrom(failure))
      }
  }
}
