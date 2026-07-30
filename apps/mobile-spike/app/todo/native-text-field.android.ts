import type { TextField } from '@nativescript/core'

export const patchTextFieldText = (field: TextField, text: string): void => {
  if (field.text === text) return

  const native = field.android
  const focused = native?.hasFocus() ?? false
  const selectionStart = native?.getSelectionStart() ?? text.length
  const selectionEnd = native?.getSelectionEnd() ?? selectionStart
  field.text = text

  if (native !== undefined && native !== null) {
    const nextStart = Math.min(selectionStart, text.length)
    const nextEnd = Math.min(Math.max(selectionEnd, nextStart), text.length)
    native.setSelection(nextStart, nextEnd)
  }
  if (focused) field.focus()
}
