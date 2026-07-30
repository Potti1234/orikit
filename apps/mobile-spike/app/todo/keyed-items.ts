export type KeyedItem = Readonly<{ id: string }>

export const reconcileKeyedItems = <Item extends KeyedItem>(
  previous: ReadonlyArray<Item>,
  desired: ReadonlyArray<Item>,
  equal: (left: Item, right: Item) => boolean,
): ReadonlyArray<Item> => {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  return desired.map((item) => {
    const existing = previousById.get(item.id)
    return existing !== undefined && equal(existing, item) ? existing : item
  })
}

export type MutableKeyedItems<Item extends KeyedItem> = Readonly<{
  length: number
  getItem: (index: number) => Item
  setItem: (index: number, value: Item) => void
  splice: (start: number, deleteCount?: number, ...items: Array<Item>) => unknown
}>

export const applyKeyedItems = <Item extends KeyedItem>(
  target: MutableKeyedItems<Item>,
  desired: ReadonlyArray<Item>,
): void => {
  for (const [index, item] of desired.entries()) {
    if (index >= target.length) {
      target.splice(index, 0, item)
      continue
    }
    if (target.getItem(index).id !== item.id) {
      let existingIndex = index + 1
      while (existingIndex < target.length && target.getItem(existingIndex).id !== item.id) {
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
    if (target.getItem(index) !== item) {
      target.setItem(index, item)
    }
  }
  if (target.length > desired.length) {
    target.splice(desired.length, target.length - desired.length)
  }
}
