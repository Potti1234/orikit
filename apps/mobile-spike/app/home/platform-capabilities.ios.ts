import type { Button } from '@nativescript/core'

import type { PlatformEvidence, PlatformId } from './platform-capabilities'

export const platformId: PlatformId = 'ios'

export const platformTag = 'IOS'

export const nativeLanguage = 'Swift'

const majorVersion = (value: string): number => Number.parseInt(value.split('.')[0] ?? '0', 10)

export const readPlatformEvidence = (): PlatformEvidence => {
  const greeting = OriKitNativeGreeting.new()
  const device = UIDevice.currentDevice
  return {
    platform: 'ios',
    deviceModel: String(device.model),
    sdk: majorVersion(String(device.systemVersion)),
    nativeGreeting: String(greeting.value()),
  }
}

export const setPlatformButtonEnabled = (button: Button, enabled: boolean): void => {
  button.isEnabled = enabled
  button.isUserInteractionEnabled = enabled
  const nativeButton = button.ios as UIButton | undefined
  if (nativeButton !== undefined && nativeButton !== null) {
    const applyNativeState = (): void => {
      nativeButton.enabled = enabled
      nativeButton.userInteractionEnabled = enabled
    }
    applyNativeState()
    // NativeScript can apply its queued property values after a dynamic
    // layout patch. Re-assert at the next task boundary so UIKit semantics
    // and the NativeScript property remain aligned.
    setTimeout(() => {
      applyNativeState()
      if (!enabled) {
        console.log(
          `ORIKIT_BUTTON_DISABLED:${JSON.stringify({
            clickable: nativeButton.userInteractionEnabled,
            enabled: nativeButton.enabled,
            focusable: nativeButton.canBecomeFocused,
          })}`,
        )
      }
    }, 0)
  }
}
