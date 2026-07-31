import { initialTodoModel, type Todo, type TodoModel, todosLoaded, todosSaved } from '@orikit/todo'
import { Command, click, expect, given, label, role, scene, text, type } from 'foldkit/scene'
import { describe, it } from 'vitest'

import { LoadTodosCommand, SaveTodosCommand, updateTodoWeb, viewTodoWeb } from './todo-app'

const milk: Todo = { id: 'milk', title: 'Buy milk', completed: false }

const ready = (todos: ReadonlyArray<Todo>): TodoModel => ({
  ...initialTodoModel(),
  todos,
  loadState: { _tag: 'Ready' },
})

describe('Todo Foldkit Scene', () => {
  it('adds a reminder through the labeled form', () => {
    scene(
      { update: updateTodoWeb, view: viewTodoWeb },
      given(ready([])),
      type(label('New reminder'), 'Call Mum'),
      click(role('button', { name: 'Add' })),
      expect(text('Call Mum')).toExist(),
      Command.expectExact(SaveTodosCommand),
      Command.resolve(SaveTodosCommand, todosSaved()),
      expect(text('Saved in memory')).toExist(),
    )
  })

  it('toggles and deletes by accessible name', () => {
    scene(
      { update: updateTodoWeb, view: viewTodoWeb },
      given(ready([milk])),
      click(role('checkbox', { name: 'Mark Buy milk complete' })),
      expect(role('checkbox', { checked: true })).toExist(),
      Command.resolve(SaveTodosCommand, todosSaved()),
      click(role('button', { name: 'Delete Buy milk' })),
      expect(text('All clear')).toExist(),
      Command.resolve(SaveTodosCommand, todosSaved()),
    )
  })

  it('edits a reminder inline', () => {
    scene(
      { update: updateTodoWeb, view: viewTodoWeb },
      given(ready([milk])),
      click(role('button', { name: 'Edit Buy milk' })),
      type(label('Edit Buy milk'), 'Buy oat milk'),
      click(role('button', { name: 'Save' })),
      expect(text('Buy oat milk')).toExist(),
      Command.resolve(SaveTodosCommand, todosSaved()),
    )
  })

  it('renders load failure recovery semantically', () => {
    scene(
      { update: updateTodoWeb, view: viewTodoWeb },
      given({
        ...initialTodoModel(),
        loadState: { _tag: 'Failed', reason: 'offline' },
      }),
      expect(role('alert')).toExist(),
      click(role('button', { name: 'Try again' })),
      expect(role('status')).toExist(),
      Command.resolve(LoadTodosCommand, todosLoaded([])),
      expect(text('All clear')).toExist(),
    )
  })
})
