import { canonicalTodoTrace, runTodoFixture } from '@orikit/spike-trace'
import { TodoModel } from '@orikit/todo'
import { Runtime } from 'foldkit'

import './style.css'
import { initTodoWeb, updateTodoWeb, viewTodoWeb } from './todo-app'

declare global {
  interface Window {
    __ORIKIT_TODO_RESULT__?: Readonly<{
      trace: ReturnType<typeof runTodoFixture>
      canonicalTrace: string
    }>
  }
}

const application = Runtime.makeApplication({
  Model: TodoModel,
  init: initTodoWeb,
  update: updateTodoWeb,
  view: viewTodoWeb,
  container: document.getElementById('app'),
  preserveScroll: true,
})

Runtime.run(application)

window.__ORIKIT_TODO_RESULT__ = {
  trace: runTodoFixture(),
  canonicalTrace: canonicalTodoTrace(),
}
