package dev.orikit.device

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

interface MotionSensorListener {
    fun onSample(magnitude: Double)
    fun onUnavailable()
}

class MotionSensorStream(context: Context, private val listener: MotionSensorListener) : SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var running = false
    private var lastEmissionNanos = 0L

    fun start(): Boolean {
        if (running) return true
        val available = sensor ?: run {
            listener.onUnavailable()
            return false
        }
        running = manager.registerListener(this, available, SensorManager.SENSOR_DELAY_NORMAL)
        if (!running) listener.onUnavailable()
        return running
    }

    fun stop() {
        if (!running) return
        manager.unregisterListener(this)
        running = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!running || event.values.size < 3) return
        if (lastEmissionNanos != 0L && event.timestamp - lastEmissionNanos < 2_000_000_000L) return
        lastEmissionNanos = event.timestamp
        val x = event.values[0].toDouble()
        val y = event.values[1].toDouble()
        val z = event.values[2].toDouble()
        listener.onSample(sqrt(x * x + y * y + z * z))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
