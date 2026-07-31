import { describe, expect, it } from 'vitest'

import {
  addRequested,
  createInMemoryTodoStorage,
  createTestTodoApplication,
  deleteRequested,
  draftChanged,
  editCommitted,
  editDraftChanged,
  editRequested,
  initialTodoModel,
  interpretTodoCommand,
  loadTodos,
  motionObserved,
  saveRetried,
  saveTodos,
  todosLoaded,
  todosSaved,
  todosSaveFailed,
  toggleRequested,
  updateTodo,
} from './index'

const milk = { id: 'milk', title: 'Buy milk', completed: false } as const

describe('Todo Program', () => {
  it('adds, edits, toggles, and deletes through pure transitions', () => {
    let model = updateTodo(initialTodoModel(), todosLoaded([]))[0]
    model = updateTodo(model, draftChanged('  Buy milk  '))[0]
    const added = updateTodo(model, addRequested())
    expect(added[0].todos).toEqual([{ id: 'todo-1', title: 'Buy milk', completed: false }])
    expect(added[1][0]?.name).toBe('SaveTodos')

    model = updateTodo(added[0], todosSaved())[0]
    model = updateTodo(model, editRequested('todo-1'))[0]
    model = updateTodo(model, editDraftChanged('Buy oat milk'))[0]
    model = updateTodo(model, editCommitted())[0]
    expect(model.todos[0]?.title).toBe('Buy oat milk')

    model = updateTodo(model, toggleRequested('todo-1'))[0]
    expect(model.todos[0]?.completed).toBe(true)
    model = updateTodo(model, deleteRequested('todo-1'))[0]
    expect(model.todos).toEqual([])
  })

  it('keeps optimistic data and emits a retry command after save failure', () => {
    const loaded = updateTodo(initialTodoModel(), todosLoaded([milk]))[0]
    const failed = updateTodo(loaded, todosSaveFailed('disk full'))[0]
    const retried = updateTodo(failed, saveRetried())
    expect(retried[0].todos).toEqual([milk])
    expect(retried[0].saveState).toEqual({ _tag: 'Saving' })
    expect(retried[1]).toHaveLength(1)
    expect(retried[1][0]).toMatchObject({ name: 'SaveTodos', args: { todos: [milk] } })
  })

  it('keeps native motion samples in the portable Model', () => {
    const model = updateTodo(initialTodoModel(), motionObserved(9.81))[0]
    expect(model.motionSamples).toBe(1)
    expect(model.lastMotion).toBe(9.81)
  })
})

describe('in-memory Todo storage', () => {
  it('round-trips immutable values through Command completion Messages', async () => {
    const storage = createInMemoryTodoStorage()
    const saveResult = await interpretTodoCommand(saveTodos([milk]), storage)
    expect(saveResult).toEqual({ _tag: 'TodosSaved' })
    const loadResult = await interpretTodoCommand(loadTodos(), storage)
    expect(loadResult).toEqual({ _tag: 'TodosLoaded', todos: [milk] })
  })

  it('runs Commands only after a committed Model and dispatches completions', async () => {
    const { application, storage } = createTestTodoApplication()
    await application.settle()
    application.dispatch(draftChanged('Persist me'))
    application.dispatch(addRequested())
    await application.settle()
    expect(application.current().saveState).toEqual({ _tag: 'Idle' })
    expect(storage.snapshot()).toEqual([{ id: 'todo-1', title: 'Persist me', completed: false }])
    expect(application.status()).toEqual({ _tag: 'Running' })
    expect(application.metrics()).toMatchObject({
      committedMessages: 4,
      commandsStarted: 2,
      commandsCompleted: 2,
    })
    expect(
      application
        .events()
        .flatMap((event) =>
          event._tag === 'CommandQueued' ? [event.execution.causedBySequence] : [],
        ),
    ).toEqual([0, 3])
    expect(JSON.stringify(application.events())).not.toContain('effect')
    expect(application.events()).toContainEqual(
      expect.objectContaining({
        _tag: 'CommandCompleted',
        execution: expect.objectContaining({
          command: {
            _tag: 'SaveTodos',
            name: 'SaveTodos',
            args: { todos: [{ id: 'todo-1', title: 'Persist me', completed: false }] },
          },
        }),
      }),
    )
    application.dispose()
  })

  it('converts expected storage failures into typed Messages', async () => {
    const storage = createInMemoryTodoStorage()
    storage.failNextLoad('offline')
    storage.failNextSave('read only')
    expect(await interpretTodoCommand(loadTodos(), storage)).toEqual({
      _tag: 'TodosLoadFailed',
      reason: 'offline',
    })
    expect(await interpretTodoCommand(saveTodos([milk]), storage)).toEqual({
      _tag: 'TodosSaveFailed',
      reason: 'read only',
    })
  })
})
