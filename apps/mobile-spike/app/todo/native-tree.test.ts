import { initialTodoModel, todosLoaded, updateTodo } from '@orikit/todo'
import { describe, expect, it } from 'vitest'

import {
  androidTodoTheme,
  describeTodoNativeTree,
  iosTodoTheme,
  type NativeMobilePlatform,
} from './native-tree'

const ready = updateTodo(
  initialTodoModel(),
  todosLoaded([{ id: 'one', title: 'Shared native semantics', completed: false }]),
)[0]

const semanticSignature = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(semanticSignature)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  if (record._tag === 'Element' || record._tag === 'Custom')
    return {
      _tag: record._tag,
      kind: record.kind,
      adapter: record.adapter,
      key: record.key,
      accessibility: record.accessibility,
      eventNames: Object.keys((record.events as Record<string, unknown> | undefined) ?? {}).sort(),
      children: semanticSignature(record.children ?? []),
    }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, semanticSignature(child)]),
  )
}

describe('shared Android/iOS native tree', () => {
  it('keeps one semantic structure while allowing platform metrics', () => {
    const android = describeTodoNativeTree(ready, androidTodoTheme)
    const ios = describeTodoNativeTree(ready, iosTodoTheme)
    expect(semanticSignature(android)).toEqual(semanticSignature(ios))
    expect(android.props).toMatchObject({ platform: 'Android', navigation: 'ActionBar' })
    expect(ios.props).toMatchObject({ platform: 'IOS', navigation: 'NavigationBar' })
  })

  it('maps one custom semantic adapter to Kotlin and Swift implementations', () => {
    const mappings: Record<NativeMobilePlatform, string> = {
      Android: androidTodoTheme.motionAdapter.nativeClass,
      IOS: iosTodoTheme.motionAdapter.nativeClass,
    }
    expect(androidTodoTheme.motionAdapter.adapter).toBe('MotionSummary')
    expect(iosTodoTheme.motionAdapter.adapter).toBe('MotionSummary')
    expect(mappings).toEqual({
      Android: 'dev.orikit.device.MotionSummaryView',
      IOS: 'OriKitMotionSummaryView',
    })
  })
})
