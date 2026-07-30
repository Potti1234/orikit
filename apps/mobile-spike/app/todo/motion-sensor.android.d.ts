declare namespace dev.orikit.device {
  class MotionSensorListener {
    constructor(implementation: {
      onSample: (magnitude: number) => void
      onUnavailable: () => void
    })
  }

  class MotionSensorStream {
    constructor(context: android.content.Context, listener: MotionSensorListener)
    start(): boolean
    stop(): void
  }
}
