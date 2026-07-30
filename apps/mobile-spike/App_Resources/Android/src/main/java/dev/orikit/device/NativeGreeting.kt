package dev.orikit.device

class NativeGreeting {
    fun value(): String {
        return "Hello from Kotlin ${android.os.Build.MODEL}"
    }
}
