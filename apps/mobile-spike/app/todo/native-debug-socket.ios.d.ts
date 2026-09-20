declare class OriKitDebugSocket extends NSObject {
  static alloc(): OriKitDebugSocket
  // biome-ignore lint/suspicious/noMisleadingInstantiator: Objective-C exposes +new as a factory
  static new(): OriKitDebugSocket
  connectWithUrlOnOpenOnMessageOnErrorOnClosed(
    url: string,
    onOpen: () => void,
    onMessage: (value: string) => void,
    onError: (message: string) => void,
    onClosed: (message: string) => void,
  ): void
  send(value: string): void
  close(): void
}
