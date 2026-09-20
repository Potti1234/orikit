import type { Button } from '@nativescript/core'

import type { PlatformEvidence, PlatformId } from './platform-capabilities'

export const platformId: PlatformId = 'android'

export const platformTag = 'ANDROID'

export const nativeLanguage = 'Kotlin'

export const readPlatformEvidence = (): PlatformEvidence => {
  const greeting = new dev.orikit.device.NativeGreeting()
  return {
    platform: 'android',
    deviceModel: String(android.os.Build.MODEL),
    sdk: android.os.Build.VERSION.SDK_INT,
    nativeGreeting: String(greeting.value()),
  }
}

export const setPlatformButtonEnabled = (button: Button, enabled: boolean): void => {
  button.isEnabled = enabled
  button.isUserInteractionEnabled = enabled
  const nativeButton = button.android
  if (nativeButton !== undefined) {
    const applyNativeState = (): void => {
      nativeButton.setEnabled(enabled)
      nativeButton.setClickable(enabled)
      nativeButton.setFocusable(enabled)
    }
    applyNativeState()
    // NativeScript can apply its queued property values after a dynamic
    // layout patch. Re-assert at the next task boundary so Android semantics
    // and the NativeScript property remain aligned.
    setTimeout(() => {
      applyNativeState()
      if (!enabled) {
        console.log(
          `ORIKIT_BUTTON_DISABLED:${JSON.stringify({
            clickable: nativeButton.isClickable(),
            enabled: nativeButton.isEnabled(),
            focusable: nativeButton.isFocusable(),
          })}`,
        )
      }
    }, 0)
  }
}
