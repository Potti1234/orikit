import {
  draftChanged,
  initialTodoModel,
  type TodoMessage,
  type TodoModel,
  todosLoaded,
  updateTodo,
} from '@orikit/todo'
import { describe, expect, it } from 'vitest'

import { describeTodoNativeView } from './native-view'

const step = (model: TodoModel, message: TodoMessage): TodoModel => updateTodo(model, message)[0]

describe('Todo NativeScene semantics', () => {
  it('adds and toggles through the messages exposed by the native view', () => {
    let model = step(initialTodoModel(), todosLoaded([]))
    model = step(model, draftChanged('Test on device'))
    let scene = describeTodoNativeView(model)

    model = step(model, scene.addMessage)
    scene = describeTodoNativeView(model)
    expect(scene.rows.map(({ title }) => title)).toEqual(['Test on device'])

    model = step(model, scene.rows[0]?.toggleMessage as TodoMessage)
    scene = describeTodoNativeView(model)
    expect(scene.rows[0]?.toggleText).toBe('✓')
  })

  it('exposes edit, delete, and retry as typed Messages', () => {
    let model = step(
      initialTodoModel(),
      todosLoaded([{ id: 'todo-1', title: 'Review', completed: false }]),
    )
    let scene = describeTodoNativeView(model)
    model = step(model, scene.rows[0]?.editMessage as TodoMessage)
    scene = describeTodoNativeView(model)

    expect(scene.editor.state).toBe('editing')
    if (scene.editor.state === 'editing') {
      model = step(model, scene.editor.cancelMessage)
    }
    scene = describeTodoNativeView(model)
    model = step(model, scene.rows[0]?.deleteMessage as TodoMessage)
    expect(describeTodoNativeView(model).rows).toHaveLength(0)
  })
})
