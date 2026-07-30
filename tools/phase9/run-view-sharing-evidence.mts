import { readFile } from 'node:fs/promises'
import { initialTodoModel, todosLoaded, updateTodo } from '@orikit/todo'
import {
  androidTodoTheme,
  describeTodoNativeTree,
  iosTodoTheme,
} from '../../apps/mobile-spike/app/todo/native-tree'

const ready = updateTodo(
  initialTodoModel(),
  todosLoaded([
    { id: 'open', title: 'Compare platform views', completed: false },
    { id: 'done', title: 'Share the Program', completed: true },
  ]),
)[0]
const android = describeTodoNativeTree(ready, androidTodoTheme)
const ios = describeTodoNativeTree(ready, iosTodoTheme)

const nodes = (value: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null) return []
  const record = value as Record<string, unknown>
  const children = Array.isArray(record.children) ? record.children : []
  return [record, ...children.flatMap(nodes)]
}
const signature = (tree: unknown): string =>
  JSON.stringify(
    nodes(tree).map((node) => ({
      tag: node._tag,
      kind: node.kind,
      adapter: node.adapter,
      key: node.key,
      events: Object.keys((node.events as Record<string, unknown> | undefined) ?? {}).sort(),
    })),
  )
const differingProps = nodes(android).flatMap((node, index) => {
  const other = nodes(ios)[index]
  const left = (node.props as Record<string, unknown> | undefined) ?? {}
  const right = (other?.props as Record<string, unknown> | undefined) ?? {}
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => !Object.is(left[key], right[key]))
    .map((key) => `${index}.${key}`)
})

const [programSource, projectionSource, webSource, nativeSource] = await Promise.all([
  readFile(new URL('../../packages/todo/src/program.ts', import.meta.url), 'utf8'),
  readFile(new URL('../../packages/todo/src/presentation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../../apps/web-spike/src/todo-app.ts', import.meta.url), 'utf8'),
  readFile(new URL('../../apps/mobile-spike/app/todo/native-tree.ts', import.meta.url), 'utf8'),
])
const rubric = {
  onePortableProgram:
    programSource.includes('updateTodo') && !programSource.includes('@nativescript'),
  portableProjection:
    !projectionSource.includes('@nativescript') && !projectionSource.includes('foldkit'),
  separateWebView: webSource.includes("from 'foldkit/html'"),
  sharedNativeProjection: webSource.includes('presentTodo') && nativeSource.includes('presentTodo'),
  androidIosSemanticParity: signature(android) === signature(ios),
  explicitNativeEscape: nativeSource.includes("customNativeElement('MotionSummary'"),
}
if (Object.values(rubric).some((value) => !value)) throw new Error('View-sharing rubric failed')

console.log(
  JSON.stringify(
    {
      status: 'pass',
      decision: 'SeparateWebSharedNative',
      sharedSemanticNodes: nodes(android).length,
      platformSpecificPropertyPaths: differingProps,
      customSemanticAdapters: ['MotionSummary'],
      aiReadabilityRubric: rubric,
      score: `${Object.values(rubric).filter(Boolean).length}/${Object.keys(rubric).length}`,
    },
    undefined,
    2,
  ),
)
