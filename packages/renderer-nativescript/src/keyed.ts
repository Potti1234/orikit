import { type NativeKey, RendererError } from './types'

export type KeyedItem = Readonly<{ key: NativeKey }>

export const assertUniqueKeys = (
  items: ReadonlyArray<Readonly<{ key?: NativeKey }>>,
  path: string,
): void => {
  const seen = new Set<NativeKey>()
  for (const item of items) {
    if (item.key === undefined) continue
    if (seen.has(item.key)) {
      throw new RendererError({
        code: 'DuplicateKey',
        path,
        detail: `Sibling key ${JSON.stringify(item.key)} appears more than once`,
      })
    }
    seen.add(item.key)
  }
}

export const reconcileKeyedValues = <Item extends KeyedItem>(
  previous: ReadonlyArray<Item>,
  desired: ReadonlyArray<Item>,
  equal: (left: Item, right: Item) => boolean,
): ReadonlyArray<Item> => {
  assertUniqueKeys(desired, 'keyed collection')
  const previousByKey = new Map(previous.map((item) => [item.key, item]))
  return desired.map((item) => {
    const existing = previousByKey.get(item.key)
    return existing !== undefined && equal(existing, item) ? existing : item
  })
}

export type MutableKeyedValues<Item extends KeyedItem> = Readonly<{
  length: number
  getItem: (index: number) => Item
  setItem: (index: number, value: Item) => void
  splice: (start: number, deleteCount?: number, ...items: Array<Item>) => unknown
}>

export const applyKeyedValues = <Item extends KeyedItem>(
  target: MutableKeyedValues<Item>,
  desired: ReadonlyArray<Item>,
): void => {
  assertUniqueKeys(desired, 'keyed collection')
  for (const [index, item] of desired.entries()) {
    if (index >= target.length) {
      target.splice(index, 0, item)
      continue
    }
    if (target.getItem(index).key !== item.key) {
      let existingIndex = index + 1
      while (existingIndex < target.length && target.getItem(existingIndex).key !== item.key) {
        existingIndex += 1
      }
      if (existingIndex < target.length) {
        const moved = target.getItem(existingIndex)
        target.splice(existingIndex, 1)
        target.splice(index, 0, moved)
      } else {
        target.splice(index, 0, item)
      }
    }
    if (target.getItem(index) !== item) target.setItem(index, item)
  }
  if (target.length > desired.length) {
    target.splice(desired.length, target.length - desired.length)
  }
}
