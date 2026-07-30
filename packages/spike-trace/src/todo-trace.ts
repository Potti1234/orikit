import { codecsFor } from '@orikit/spike-core'
import {
  addRequested,
  deleteRequested,
  draftChanged,
  editCommitted,
  editDraftChanged,
  editRequested,
  type TodoMessage,
  todoProgram,
  todosLoaded,
  todosSaved,
  toggleRequested,
} from '@orikit/todo'

import { canonicalJson, fingerprint, type JsonValue } from './canonical'

export const todoFixtureMessages = (): ReadonlyArray<TodoMessage> => [
  todosLoaded([]),
  draftChanged('Write shared behavior'),
  addRequested(),
  todosSaved(),
  toggleRequested('todo-1'),
  todosSaved(),
  editRequested('todo-1'),
  editDraftChanged('Ship shared behavior'),
  editCommitted(),
  todosSaved(),
  deleteRequested('todo-1'),
  todosSaved(),
]

export type CanonicalTodoTrace = Readonly<{
  fixture: 'todo-v2'
  program: typeof todoProgram.identity
  initialModel: JsonValue
  events: ReadonlyArray<{
    sequence: number
    message: JsonValue
    model: JsonValue
    modelFingerprint: string
    commands: ReadonlyArray<JsonValue>
  }>
  finalModelFingerprint: string
}>

export const runTodoFixture = (): CanonicalTodoTrace => {
  const codecs = codecsFor(todoProgram)
  const [initialized] = todoProgram.init({})
  let model = codecs.decodeModel(initialized)
  const initialModel = codecs.encodeModel(model) as JsonValue
  const events: Array<CanonicalTodoTrace['events'][number]> = []

  for (const [index, message] of todoFixtureMessages().entries()) {
    const [nextModel, commands] = todoProgram.update(model, message)
    model = codecs.decodeModel(nextModel)
    const encodedModel = codecs.encodeModel(model) as JsonValue
    events.push({
      sequence: index + 1,
      message: codecs.encodeMessage(message) as JsonValue,
      model: encodedModel,
      modelFingerprint: fingerprint(encodedModel),
      commands: commands.map((command) => codecs.encodeCommand(command) as JsonValue),
    })
  }

  return {
    fixture: 'todo-v2',
    program: todoProgram.identity,
    initialModel,
    events,
    finalModelFingerprint: fingerprint(codecs.encodeModel(model) as JsonValue),
  }
}

export const canonicalTodoTrace = (): string => canonicalJson(runTodoFixture() as JsonValue)
