import {
  addRequested,
  createInMemoryTodoStorage,
  deleteRequested,
  draftChanged,
  editCancelled,
  editCommitted,
  editDraftChanged,
  editRequested,
  interpretTodoCommand,
  loadRequested,
  loadTodos,
  saveRetried,
  saveTodos,
  Todo,
  type TodoCommand,
  type TodoMessage,
  type TodoModel as TodoModelType,
  TodosLoaded,
  TodosLoadFailed,
  TodosSaved,
  TodosSaveFailed,
  type Todo as TodoType,
  todoProgram,
  toggleRequested,
} from '@orikit/todo'
import { Effect, Schema } from 'effect'
import { Command } from 'foldkit'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

const storage = createInMemoryTodoStorage([
  {
    id: 'welcome',
    title: 'Try the same Todo logic on Android',
    completed: false,
  },
])

export const LoadTodosCommand = Command.define(
  'LoadTodos',
  TodosLoaded,
  TodosLoadFailed,
)(Effect.promise(() => interpretTodoCommand(loadTodos(), storage)))

export const SaveTodosCommand = Command.define(
  'SaveTodos',
  { todos: Schema.Array(Todo) },
  TodosSaved,
  TodosSaveFailed,
)(({ todos }) => Effect.promise(() => interpretTodoCommand(saveTodos(todos), storage)))

const adaptCommand = (command: TodoCommand) => {
  switch (command._tag) {
    case 'LoadTodos':
      return LoadTodosCommand()
    case 'SaveTodos':
      return SaveTodosCommand({ todos: command.todos })
  }
}

const adapt = (transition: readonly [TodoModelType, ReadonlyArray<TodoCommand>]) =>
  [transition[0], transition[1].map(adaptCommand)] as const

export const initTodoWeb = () => adapt(todoProgram.init({}))

export const updateTodoWeb = (model: TodoModelType, message: TodoMessage) =>
  adapt(todoProgram.update(model, message))

const todoRow = (todo: TodoType, model: TodoModelType, h: HtmlBuilder<TodoMessage>): Html => {
  const editing = model.editor._tag === 'Editing' && model.editor.id === todo.id

  if (editing && model.editor._tag === 'Editing') {
    return h.keyed('li')(
      todo.id,
      [h.Class('todo-row editing')],
      [
        h.div(
          [h.Class('edit-field')],
          [
            h.label([h.For(`edit-${todo.id}`)], [`Edit ${todo.title}`]),
            h.input([
              h.Id(`edit-${todo.id}`),
              h.Type('text'),
              h.Value(model.editor.draft),
              h.OnInput(editDraftChanged),
            ]),
          ],
        ),
        h.div(
          [h.Class('row-actions')],
          [
            h.button(
              [
                h.Type('button'),
                h.Class('text-button primary'),
                h.OnClick(editCommitted()),
                h.Disabled(model.editor.draft.trim().length === 0),
              ],
              ['Save'],
            ),
            h.button(
              [h.Type('button'), h.Class('text-button'), h.OnClick(editCancelled())],
              ['Cancel'],
            ),
          ],
        ),
      ],
    )
  }

  return h.keyed('li')(
    todo.id,
    [h.Class(todo.completed ? 'todo-row completed' : 'todo-row')],
    [
      h.input([
        h.Id(`todo-${todo.id}`),
        h.Class('todo-check'),
        h.Type('checkbox'),
        h.Checked(todo.completed),
        h.AriaLabel(
          todo.completed ? `Mark ${todo.title} incomplete` : `Mark ${todo.title} complete`,
        ),
        h.OnClick(toggleRequested(todo.id)),
      ]),
      h.label([h.Class('todo-title'), h.For(`todo-${todo.id}`)], [todo.title]),
      h.div(
        [h.Class('row-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('text-button'),
              h.AriaLabel(`Edit ${todo.title}`),
              h.OnClick(editRequested(todo.id)),
            ],
            ['Edit'],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('text-button destructive'),
              h.AriaLabel(`Delete ${todo.title}`),
              h.OnClick(deleteRequested(todo.id)),
            ],
            ['Delete'],
          ),
        ],
      ),
    ],
  )
}

const content = (model: TodoModelType, h: HtmlBuilder<TodoMessage>): Html => {
  if (model.loadState._tag === 'Loading') {
    return h.div(
      [h.Class('loading-state'), h.Role('status'), h.AriaLive('polite')],
      [
        h.div([h.Class('skeleton-line wide')], []),
        h.div([h.Class('skeleton-line')], []),
        h.span([h.Class('visually-hidden')], ['Loading reminders']),
      ],
    )
  }

  if (model.loadState._tag === 'Failed') {
    return h.section(
      [h.Class('inline-state failure'), h.Role('alert')],
      [
        h.h2([], ['Couldn’t load reminders']),
        h.p([], [model.loadState.reason]),
        h.button(
          [h.Type('button'), h.Class('text-button primary'), h.OnClick(loadRequested())],
          ['Try again'],
        ),
      ],
    )
  }

  if (model.todos.length === 0) {
    return h.section(
      [h.Class('inline-state empty-state')],
      [
        h.p([h.Class('empty-symbol'), h.AriaHidden(true)], ['✓']),
        h.h2([], ['All clear']),
        h.p([], ['Add a reminder when something needs your attention.']),
      ],
    )
  }

  return h.ul(
    [h.Class('todo-list'), h.AriaLabel('Reminders')],
    model.todos.map((todo) => todoRow(todo, model, h)),
  )
}

export const viewTodoWeb = (model: TodoModelType, h: HtmlBuilder<TodoMessage>): Document => {
  const open = model.todos.filter((todo) => !todo.completed).length
  const completed = model.todos.length - open

  return {
    title: `${open} open reminders · OriKit`,
    lang: 'en',
    body: h.main(
      [h.Class('todo-shell')],
      [
        h.header(
          [h.Class('page-header')],
          [
            h.p([h.Class('eyebrow')], ['OriKit']),
            h.div(
              [h.Class('title-line')],
              [
                h.div(
                  [],
                  [
                    h.h1([], ['Today']),
                    h.p(
                      [h.Class('summary'), h.AriaLive('polite')],
                      [`${open} open · ${completed} completed`],
                    ),
                  ],
                ),
                h.span([h.Class('platform-note')], ['Shared behavior · Web view']),
              ],
            ),
          ],
        ),
        h.form(
          [h.Class('quick-add'), h.OnSubmit(addRequested())],
          [
            h.label([h.For('new-todo'), h.Class('visually-hidden')], ['New reminder']),
            h.input([
              h.Id('new-todo'),
              h.Type('text'),
              h.Value(model.draft),
              h.Placeholder('New reminder'),
              h.Autocomplete('off'),
              h.OnInput(draftChanged),
            ]),
            h.button(
              [
                h.Type('submit'),
                h.Class('add-button'),
                h.Disabled(model.draft.trim().length === 0),
              ],
              ['Add'],
            ),
          ],
        ),
        model.saveState._tag === 'Failed'
          ? h.section(
              [h.Class('save-status failure'), h.Role('alert')],
              [
                h.p(
                  [],
                  [`Changes are on this device, but saving failed: ${model.saveState.reason}`],
                ),
                h.button(
                  [h.Type('button'), h.Class('text-button primary'), h.OnClick(saveRetried())],
                  ['Retry saving'],
                ),
              ],
            )
          : h.p(
              [h.Class('save-status'), h.Role('status'), h.AriaLive('polite')],
              [model.saveState._tag === 'Saving' ? 'Saving…' : 'Saved in memory'],
            ),
        content(model, h),
        h.footer([], [h.p([], ['One Program. Separate platform views.'])]),
      ],
    ),
  }
}
