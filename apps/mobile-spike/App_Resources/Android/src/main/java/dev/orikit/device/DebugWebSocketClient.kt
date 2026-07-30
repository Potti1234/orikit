package dev.orikit.device

import android.util.Base64
import android.os.Handler
import android.os.Looper
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.concurrent.Executors
import kotlin.concurrent.thread

interface DebugWebSocketListener {
    fun onOpen()
    fun onMessage(value: String)
    fun onClosed()
    fun onError(message: String)
}

class DebugWebSocketClient(private val listener: DebugWebSocketListener) {
    @Volatile private var socket: Socket? = null
    @Volatile private var output: BufferedOutputStream? = null
    private val random = SecureRandom()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val writerExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "orikit-devtools-writer").apply { isDaemon = true }
    }

    fun connect(host: String, port: Int, path: String) {
        thread(name = "orikit-devtools-websocket", isDaemon = true) {
            try {
                val connected = Socket(host, port)
                socket = connected
                val input = BufferedInputStream(connected.getInputStream())
                val writer = BufferedOutputStream(connected.getOutputStream())
                output = writer
                val keyBytes = ByteArray(16).also(random::nextBytes)
                val key = Base64.encodeToString(keyBytes, Base64.NO_WRAP)
                val request = "GET $path HTTP/1.1\r\nHost: $host:$port\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\n\r\n"
                writer.write(request.toByteArray(StandardCharsets.US_ASCII))
                writer.flush()
                val response = readHeaders(input)
                if (!response.startsWith("HTTP/1.1 101")) error("WebSocket handshake rejected")
                mainHandler.post { listener.onOpen() }
                readFrames(input)
            } catch (failure: Throwable) {
                if (socket != null) mainHandler.post {
                    listener.onError(failure.message ?: failure.javaClass.simpleName)
                }
            } finally {
                closeSocket()
                mainHandler.post { listener.onClosed() }
            }
        }
    }

    fun send(value: String) {
        writerExecutor.execute {
            val writer = output ?: return@execute
            writeFrame(writer, 0x1, value.toByteArray(StandardCharsets.UTF_8))
        }
    }

    fun close() {
        writerExecutor.execute {
            output?.let { writeFrame(it, 0x8, ByteArray(0)) }
            closeSocket()
            writerExecutor.shutdown()
        }
    }

    private fun readHeaders(input: BufferedInputStream): String {
        val bytes = ArrayList<Byte>()
        while (bytes.size < 16_384) {
            val next = input.read()
            if (next < 0) error("WebSocket handshake ended early")
            bytes.add(next.toByte())
            val size = bytes.size
            if (size >= 4 && bytes[size - 4] == 13.toByte() && bytes[size - 3] == 10.toByte() && bytes[size - 2] == 13.toByte() && bytes[size - 1] == 10.toByte()) break
        }
        return String(bytes.toByteArray(), StandardCharsets.US_ASCII)
    }

    private fun readFrames(input: BufferedInputStream) {
        while (socket?.isClosed == false) {
            val first = input.read()
            if (first < 0) return
            val second = input.read()
            if (second < 0) return
            val opcode = first and 0x0f
            val masked = second and 0x80 != 0
            var length = (second and 0x7f).toLong()
            if (length == 126L) length = ((input.read() shl 8) or input.read()).toLong()
            if (length == 127L) {
                length = 0
                repeat(8) { length = (length shl 8) or input.read().toLong() }
            }
            if (length > 2 * 1024 * 1024) error("WebSocket frame exceeds debug limit")
            val mask = if (masked) ByteArray(4).also { readFully(input, it) } else null
            val payload = ByteArray(length.toInt()).also { readFully(input, it) }
            if (mask != null) payload.indices.forEach { payload[it] = (payload[it].toInt() xor mask[it % 4].toInt()).toByte() }
            when (opcode) {
                0x1 -> {
                    val value = String(payload, StandardCharsets.UTF_8)
                    mainHandler.post { listener.onMessage(value) }
                }
                0x8 -> return
                0x9 -> output?.let { writeFrame(it, 0xA, payload) }
            }
        }
    }

    private fun readFully(input: BufferedInputStream, target: ByteArray) {
        var offset = 0
        while (offset < target.size) {
            val count = input.read(target, offset, target.size - offset)
            if (count < 0) error("WebSocket frame ended early")
            offset += count
        }
    }

    @Synchronized private fun writeFrame(writer: BufferedOutputStream, opcode: Int, payload: ByteArray) {
        writer.write(0x80 or opcode)
        when {
            payload.size < 126 -> writer.write(0x80 or payload.size)
            payload.size <= 65_535 -> {
                writer.write(0x80 or 126)
                writer.write(payload.size shr 8)
                writer.write(payload.size and 0xff)
            }
            else -> {
                writer.write(0x80 or 127)
                repeat(8) { shift -> writer.write((payload.size.toLong() shr (56 - shift * 8)).toInt() and 0xff) }
            }
        }
        val mask = ByteArray(4).also(random::nextBytes)
        writer.write(mask)
        payload.indices.forEach { writer.write(payload[it].toInt() xor mask[it % 4].toInt()) }
        writer.flush()
    }

    @Synchronized private fun closeSocket() {
        output = null
        socket?.runCatching { close() }
        socket = null
    }
}
