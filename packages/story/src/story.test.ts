import { canonicalJson } from '@orikit/spike-trace'
import { describe, expect, it } from 'vitest'

import {
  addRequested,
  draftChanged,
  initialTodoModel,
  loadTodos,
  runCounterStory,
  runTodoAddAndSaveStory,
  runTodoEditStory,
  runTodoFailureAndRetryStory,
  runTodoLoadStory,
  runTodoToggleDeleteStory,
  saveTodos,
  type TodoCommand,
  type TodoMessage,
  type TodoModel,
  todoProgram,
  todosLoaded,
  todosSaved,
} from './examples'
import { replayStory } from './replay'
import { runStory, Story, StoryFailure } from './story'

describe('Story', () => {
  it('runs deterministic Counter and Todo examples without a platform runtime', () => {
    expect(runCounterStory().finalModel.count).toBe(2)
    expect(runTodoLoadStory().finalModel.todos).toHaveLength(1)
    expect(runTodoAddAndSaveStory().finalModel.saveState).toEqual({ _tag: 'Idle' })
    expect(runTodoEditStory().finalModel.todos[0]?.title).toBe('Ship deterministic stories')
    expect(runTodoToggleDeleteStory().finalModel.todos).toEqual([])
    expect(runTodoFailureAndRetryStory().finalModel.loadState).toEqual({
      _tag: 'Ready',
    })
  })

  it('produces byte-identical canonical traces for the same story', () => {
    const first = canonicalJson(runTodoAddAndSaveStory().trace)
    const second = canonicalJson(runTodoAddAndSaveStory().trace)
    expect(second).toBe(first)
  })

  it('reports readable property paths for exact model failures', () => {
    expect(() =>
      runStory(todoProgram, [
        Story.model(initialTodoModel()),
        Story.expectModel({ ...initialTodoModel(), draft: 'unexpected' }),
      ]),
    ).toThrowError(/\$\.draft changed/)
  })

  it('supports partial nested model assertions', () => {
    expect(() =>
      runStory(todoProgram, [
        Story.model(initialTodoModel()),
        Story.expectModelPartial<TodoModel>({ loadState: { _tag: 'Loading' } }),
      ]),
    ).not.toThrow()
  })

  it('rejects an invalid message at the Story boundary', () => {
    expect(() =>
      runStory(todoProgram, [
        Story.model(initialTodoModel()),
        Story.message({ _tag: 'NotAMessage' } as unknown as TodoMessage),
      ]),
    ).toThrow(StoryFailure)
  })

  it('rejects a command completion that violates its contract', () => {
    expect(() =>
      runStory(todoProgram, [Story.flags({}), Story.resolve(loadTodos(), todosSaved())]),
    ).toThrowError(/cannot complete command "LoadTodos"/)
  })

  it('rejects a resolution for a different pending command', () => {
    expect(() =>
      runStory(todoProgram, [Story.flags({}), Story.resolve(saveTodos([]), todosSaved())]),
    ).toThrowError(/resolved command did not match/)
  })

  it('does not execute emitted commands', () => {
    const result = runStory(todoProgram, [
      Story.model(initialTodoModel()),
      Story.message(draftChanged('Pending')),
      Story.message(addRequested()),
    ])
    expect(result.pendingCommands).toEqual([
      saveTodos([{ id: 'todo-1', title: 'Pending', completed: false }]),
    ])
  })

  it('rejects invalid commands emitted by update', () => {
    const invalidProgram = {
      ...todoProgram,
      update: (): readonly [TodoModel, ReadonlyArray<TodoCommand>] => [
        initialTodoModel(),
        [{ _tag: 'SaveTodos', todos: [{ id: 'bad', title: 'Bad' }] } as unknown as TodoCommand],
      ],
    }
    expect(() =>
      runStory(invalidProgram, [
        Story.model(initialTodoModel()),
        Story.message(draftChanged('trigger')),
      ]),
    ).toThrow(StoryFailure)
  })

  it('requires a portable Flags or Model origin', () => {
    expect(() => runStory(todoProgram, [Story.message(todosLoaded([]))])).toThrowError(
      /first step must provide Flags or a Model/,
    )
  })
})

describe('replay', () => {
  it('replays a command-resolution trace without an interpreter', () => {
    const original = runTodoAddAndSaveStory()
    const replayed = replayStory(todoProgram, original.trace)
    expect(replayed.finalModel).toEqual(original.finalModel)
    expect(replayed.pendingCommands).toEqual([])
    expect(replayed.transitions).toBe(original.trace.events.length)
  })

  it('decodes and replays a model snapshot origin', () => {
    const result = runStory(todoProgram, [
      Story.model(initialTodoModel()),
      Story.message(draftChanged('from snapshot')),
    ])
    expect(replayStory(todoProgram, result.trace).finalModel.draft).toBe('from snapshot')
  })

  it('stops at the first divergent property path', () => {
    const original = runTodoLoadStory()
    const first = original.trace.events[0]
    if (first === undefined) {
      throw new Error('fixture must contain an event')
    }
    const changedTrace = {
      ...original.trace,
      events: [
        {
          ...first,
          state: {
            ...first.state,
            model: {
              ...(first.state.model as Readonly<Record<string, unknown>>),
              draft: 'changed trace',
            },
          },
        },
      ],
    }
    expect(() => replayStory(todoProgram, changedTrace)).toThrowError(/\$\.draft/)
  })

  it('detects a changed fingerprint even when the model snapshot is unchanged', () => {
    const original = runTodoLoadStory()
    const first = original.trace.events[0]
    if (first === undefined) {
      throw new Error('fixture must contain an event')
    }
    const changedTrace = {
      ...original.trace,
      events: [
        {
          ...first,
          state: { ...first.state, modelFingerprint: '0'.repeat(64) },
        },
      ],
    }
    expect(() => replayStory(todoProgram, changedTrace)).toThrowError(/model fingerprint/)
  })
})
