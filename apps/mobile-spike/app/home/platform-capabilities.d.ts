import type { Button } from '@nativescript/core'

export type PlatformId = 'android' | 'ios'

export type PlatformEvidence = Readonly<{
  platform: PlatformId
  deviceModel: string
  sdk: number
  nativeGreeting: string
}>

export declare const platformId: PlatformId

export declare const platformTag: string

export declare const nativeLanguage: string

export declare const readPlatformEvidence: () => PlatformEvidence

export declare const setPlatformButtonEnabled: (button: Button, enabled: boolean) => void
