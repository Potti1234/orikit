import {
  createInMemoryTodoStorage,
  draftChanged,
  editDraftChanged,
  interpretTodoCommand,
  loadTodos,
  presentTodo,
  saveTodos,
  Todo,
  type TodoCommand,
  type TodoMessage,
  type TodoModel as TodoModelType,
  type TodoPresentation,
  type TodoPresentationRow,
  TodosLoaded,
  TodosLoadFailed,
  TodosSaved,
  TodosSaveFailed,
  todoProgram,
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

const todoRow = (
  todo: TodoPresentationRow,
  presentation: TodoPresentation,
  h: HtmlBuilder<TodoMessage>,
): Html => {
  const editing = presentation.editor.state === 'editing' && presentation.editor.id === todo.id

  if (editing && presentation.editor.state === 'editing') {
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
              h.Value(presentation.editor.draft),
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
                h.OnClick(presentation.editor.saveMessage),
                h.Disabled(!presentation.editor.canSave),
              ],
              ['Save'],
            ),
            h.button(
              [
                h.Type('button'),
                h.Class('text-button'),
                h.OnClick(presentation.editor.cancelMessage),
              ],
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
        h.OnClick(todo.toggleMessage),
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
              h.OnClick(todo.editMessage),
            ],
            ['Edit'],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('text-button destructive'),
              h.AriaLabel(`Delete ${todo.title}`),
              h.OnClick(todo.deleteMessage),
            ],
            ['Delete'],
          ),
        ],
      ),
    ],
  )
}

const content = (presentation: TodoPresentation, h: HtmlBuilder<TodoMessage>): Html => {
  if (presentation.load.state === 'loading') {
    return h.div(
      [h.Class('loading-state'), h.Role('status'), h.AriaLive('polite')],
      [
        h.div([h.Class('skeleton-line wide')], []),
        h.div([h.Class('skeleton-line')], []),
        h.span([h.Class('visually-hidden')], ['Loading reminders']),
      ],
    )
  }

  if (presentation.load.state === 'failed') {
    return h.section(
      [h.Class('inline-state failure'), h.Role('alert')],
      [
        h.h2([], ['Couldn’t load reminders']),
        h.p([], [presentation.load.detail]),
        h.button(
          [
            h.Type('button'),
            h.Class('text-button primary'),
            h.OnClick(presentation.load.retryMessage as TodoMessage),
          ],
          ['Try again'],
        ),
      ],
    )
  }

  if (presentation.empty) {
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
    presentation.rows.map((todo) => todoRow(todo, presentation, h)),
  )
}

export const viewTodoWeb = (model: TodoModelType, h: HtmlBuilder<TodoMessage>): Document => {
  const presentation = presentTodo(model)

  return {
    title: `${presentation.openCount} open reminders · OriKit`,
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
                    h.h1([], [presentation.title]),
                    h.p([h.Class('summary'), h.AriaLive('polite')], [presentation.summary]),
                  ],
                ),
                h.span([h.Class('platform-note')], ['Shared behavior · Web view']),
              ],
            ),
          ],
        ),
        h.form(
          [h.Class('quick-add'), h.OnSubmit(presentation.addMessage)],
          [
            h.label([h.For('new-todo'), h.Class('visually-hidden')], ['New reminder']),
            h.input([
              h.Id('new-todo'),
              h.Type('text'),
              h.Value(presentation.draft),
              h.Placeholder('New reminder'),
              h.Autocomplete('off'),
              h.OnInput(draftChanged),
            ]),
            h.button(
              [h.Type('submit'), h.Class('add-button'), h.Disabled(!presentation.canAdd)],
              ['Add'],
            ),
          ],
        ),
        presentation.save.state === 'failed'
          ? h.section(
              [h.Class('save-status failure'), h.Role('alert')],
              [
                h.p([], [presentation.save.detail]),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('text-button primary'),
                    h.OnClick(presentation.save.retryMessage as TodoMessage),
                  ],
                  ['Retry saving'],
                ),
              ],
            )
          : h.p(
              [h.Class('save-status'), h.Role('status'), h.AriaLive('polite')],
              [presentation.save.state === 'saving' ? presentation.save.detail : 'Saved in memory'],
            ),
        content(presentation, h),
        h.footer([], [h.p([], ['One Program. Separate platform views.'])]),
      ],
    ),
  }
}
