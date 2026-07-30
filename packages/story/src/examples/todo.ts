export * from '@orikit/todo'

import {
  addRequested,
  deleteRequested,
  draftChanged,
  editCommitted,
  editDraftChanged,
  editRequested,
  loadRequested,
  loadTodos,
  saveRetried,
  saveTodos,
  type Todo,
  type TodoModel,
  todoProgram,
  todosLoaded,
  todosLoadFailed,
  todosSaved,
  todosSaveFailed,
  toggleRequested,
} from '@orikit/todo'

import { runStory, Story } from '../story'

export const firstTodo: Todo = {
  id: 'todo-1',
  title: 'Prove deterministic stories',
  completed: false,
}

export const runTodoLoadStory = () =>
  runStory(todoProgram, [
    Story.flags({}),
    Story.expectCommand(loadTodos()),
    Story.resolve(loadTodos(), todosLoaded([firstTodo])),
    Story.expectModelPartial<TodoModel>({
      todos: [firstTodo],
      loadState: { _tag: 'Ready' },
    }),
  ])

export const runTodoAddAndSaveStory = () =>
  runStory(todoProgram, [
    Story.flags({}),
    Story.resolve(loadTodos(), todosLoaded([])),
    Story.message(draftChanged('Write native UI')),
    Story.message(addRequested()),
    Story.expectCommand(saveTodos([{ id: 'todo-1', title: 'Write native UI', completed: false }])),
    Story.resolve(
      saveTodos([{ id: 'todo-1', title: 'Write native UI', completed: false }]),
      todosSaved(),
    ),
    Story.expectModelPartial<TodoModel>({
      draft: '',
      saveState: { _tag: 'Idle' },
    }),
  ])

export const runTodoEditStory = () =>
  runStory(todoProgram, [
    Story.flags({}),
    Story.resolve(loadTodos(), todosLoaded([firstTodo])),
    Story.message(editRequested(firstTodo.id)),
    Story.message(editDraftChanged('Ship deterministic stories')),
    Story.message(editCommitted()),
    Story.expectCommand(
      saveTodos([
        {
          ...firstTodo,
          title: 'Ship deterministic stories',
        },
      ]),
    ),
    Story.resolve(
      saveTodos([
        {
          ...firstTodo,
          title: 'Ship deterministic stories',
        },
      ]),
      todosSaved(),
    ),
    Story.expectModelPartial<TodoModel>({
      editor: { _tag: 'Closed' },
      todos: [{ ...firstTodo, title: 'Ship deterministic stories' }],
    }),
  ])

export const runTodoToggleDeleteStory = () =>
  runStory(todoProgram, [
    Story.flags({}),
    Story.resolve(loadTodos(), todosLoaded([firstTodo])),
    Story.message(toggleRequested(firstTodo.id)),
    Story.resolve(saveTodos([{ ...firstTodo, completed: true }]), todosSaved()),
    Story.message(deleteRequested(firstTodo.id)),
    Story.resolve(saveTodos([]), todosSaved()),
    Story.expectModelPartial<TodoModel>({ todos: [] }),
  ])

export const runTodoFailureAndRetryStory = () =>
  runStory(todoProgram, [
    Story.flags({}),
    Story.resolve(loadTodos(), todosLoadFailed('offline')),
    Story.expectModelPartial<TodoModel>({
      loadState: { _tag: 'Failed', reason: 'offline' },
    }),
    Story.message(loadRequested()),
    Story.expectCommand(loadTodos()),
    Story.resolve(loadTodos(), todosLoaded([firstTodo])),
    Story.message(toggleRequested(firstTodo.id)),
    Story.resolve(saveTodos([{ ...firstTodo, completed: true }]), todosSaveFailed('read only')),
    Story.expectModelPartial<TodoModel>({
      saveState: { _tag: 'Failed', reason: 'read only' },
    }),
    Story.message(saveRetried()),
    Story.resolve(saveTodos([{ ...firstTodo, completed: true }]), todosSaved()),
    Story.expectModelPartial<TodoModel>({
      loadState: { _tag: 'Ready' },
      saveState: { _tag: 'Idle' },
    }),
  ])
