declare class OriKitNativeGreeting extends NSObject {
  static alloc(): OriKitNativeGreeting
  // biome-ignore lint/suspicious/noMisleadingInstantiator: Objective-C exposes +new as a factory
  static new(): OriKitNativeGreeting
  value(): string
}
