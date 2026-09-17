import type { TextField } from '@nativescript/core'

export const patchTextFieldText = (field: TextField, text: string): void => {
  if (field.text === text) return

  const native = field.ios as UITextField | undefined
  const usable = native !== undefined && native !== null
  const focused = usable ? native.isFirstResponder : false
  const range = usable ? native.selectedTextRange : null
  const caret =
    usable && range !== null
      ? native.offsetFromPositionToPosition(native.beginningOfDocument, range.end)
      : text.length
  field.text = text

  if (usable) {
    const offset = Math.min(caret, text.length)
    const position = native.positionFromPositionOffset(native.beginningOfDocument, offset)
    if (position !== null) {
      native.selectedTextRange = native.textRangeFromPositionToPosition(position, position)
    }
  }
  if (focused) field.focus()
}
