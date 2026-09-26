package com.example.motolock.data

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.util.UUID
import kotlinx.serialization.json.*
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Display-only snapshot of an existing motor STATUS report. */
data class MotorStatus(
    val helmetConnected: Boolean?,
    val helmetDataFresh: Boolean?,
    val testStatus: String?,
    val locked: Boolean?,
    val receivedAt: Long
) {
    fun helmetLabel(): String = when {
        helmetConnected == false -> "Disconnected"
        helmetConnected == true && helmetDataFresh == true && testStatus != "HELMET_NOT_FOUND" -> "Connected through Motor"
        helmetConnected == true && helmetDataFresh == false -> "Waiting for fresh data"
        testStatus == "HELMET_NOT_FOUND" -> "Not found"
        else -> "Waiting for status"
    }
    companion object {
        fun parse(line: String, now: Long): MotorStatus? = runCatching {
            if (!line.startsWith("STATUS:")) return null
            val json = Json.parseToJsonElement(line.substringAfter(':')) as? JsonObject ?: return null
            MotorStatus(
                (json["helmetConnected"] as? JsonPrimitive)?.booleanOrNull,
                (json["helmetDataFresh"] as? JsonPrimitive)?.booleanOrNull,
                (json["testStatus"] as? JsonPrimitive)?.contentOrNull,
                (json["locked"] as? JsonPrimitive)?.booleanOrNull,
                now
            )
        }.getOrNull()
    }
}

/** One socket reader dispatches telemetry and replies; callers never read the socket. */
class BluetoothService(context: Context) {
    private val appContext = context.applicationContext
    private val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
    private val sppUuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    @Volatile private var socket: BluetoothSocket? = null
    @Volatile private var connected = false
    private val lock = Any()
    private val writeLock = Any()
    private val mutableConnectionState = MutableStateFlow(false)
    val connectionState = mutableConnectionState.asStateFlow()
    private val mutableMotorStatus = MutableStateFlow<MotorStatus?>(null)
    val motorStatus = mutableMotorStatus.asStateFlow()
    private var receiver: BroadcastReceiver? = null
    private var heartbeatExecutor: java.util.concurrent.ScheduledExecutorService? = null
    @Volatile private var heartbeat: BluetoothHeartbeat? = null
    private var linkReady: CompletableDeferred<Unit>? = null
    private val commands = Mutex()
    private var pending: CompletableDeferred<String>? = null
    private var accepts: ((String) -> Boolean)? = null
    private val lines = MutableSharedFlow<String>(extraBufferCapacity = 64, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val isConnected: Boolean get() = mutableConnectionState.value

    @SuppressLint("MissingPermission")
    suspend fun connectToDevice(macAddress: String): Boolean {
        disconnect()
        return try {
            val bt = adapter ?: return false
            if (!bt.isEnabled) return false
            bt.cancelDiscovery()
            val device = bt.getRemoteDevice(macAddress)
            for (secure in listOf(false, true)) {
                val candidate = if (secure) device.createRfcommSocketToServiceRecord(sppUuid)
                    else device.createInsecureRfcommSocketToServiceRecord(sppUuid)
                try {
                    withTimeout(10_000) {
                        suspendCancellableCoroutine<Unit> { continuation ->
                            continuation.invokeOnCancellation { runCatching { candidate.close() } }
                            Thread({
                                try {
                                    candidate.connect()
                                    if (continuation.isActive) continuation.resume(Unit) else candidate.close()
                                } catch (e: Exception) {
                                    if (continuation.isActive) continuation.resumeWithException(e)
                                }
                            }, "MotoLock-connect").apply { isDaemon = true; start() }
                        }
                    }
                    socket = candidate
                    connected = true
                    val ready = CompletableDeferred<Unit>()
                    linkReady = ready
                    heartbeat = BluetoothHeartbeat(SystemClock.elapsedRealtime())
                    registerDisconnectReceiver(candidate)
                    Thread({ readSocket(candidate) }, "MotoLock-reader").apply { isDaemon = true; start() }
                    startHeartbeat(candidate)
                    withTimeout(4000) { ready.await() }
                    return true
                } catch (e: Exception) {
                    disconnectOwner(candidate)
                    runCatching { candidate.close() }
                    if (e is CancellationException && e !is TimeoutCancellationException) throw e
                }
            }
            false
        } catch (e: CancellationException) { throw e }
        catch (_: Exception) { false }
    }

    private fun readSocket(owner: BluetoothSocket) {
        try {
            val input = owner.inputStream.buffered()
            val line = StringBuilder()
            while (socket === owner) {
                val value = input.read()
                if (value < 0) break
                if (value == 10) {
                    val text = line.toString().trim()
                    line.setLength(0)
                    synchronized(lock) {
                        if (socket !== owner) return
                        MotorStatus.parse(text, SystemClock.elapsedRealtime())?.let { mutableMotorStatus.value = it }
                        if (heartbeat?.receive(text, SystemClock.elapsedRealtime()) == true) {
                            mutableConnectionState.value = true
                            linkReady?.complete(Unit)
                        }
                        if (accepts?.invoke(text) == true) pending?.complete(text)
                    }
                    lines.tryEmit(text)
                } else if (value != 13) {
                    if (line.length >= 4096) throw IOException("Bluetooth frame is too long")
                    line.append(value.toChar())
                }
            }
        } catch (_: IOException) {
        } finally {
            disconnectOwner(owner)
        }
    }

    private suspend fun request(command: String, expected: (String) -> Boolean): String {
        val reply = CompletableDeferred<String>()
        synchronized(lock) {
            check(connected) { "Bluetooth disconnected" }
            pending = reply
            accepts = { it.startsWith("ERR_") || expected(it) }
        }
        return try {
            withContext(Dispatchers.IO) { writeCommand(command + "\n") }
            val response = withTimeoutOrNull(5000) { reply.await() } ?: throw IOException("Bluetooth command timed out")
            if (response.startsWith("ERR_")) throw IOException(response)
            response
        } finally {
            synchronized(lock) { if (pending === reply) { pending = null; accepts = null } }
        }
    }

    suspend fun establishPairing(secret: String, progress: (String) -> Unit = {}) {
        require(secret.matches(Regex("[0-9a-f]{64}")))
        PairingRecovery().establish(
            authenticate = { check(authenticateSession(secret)) },
            provision = { commands.withLock { request("PROVISION:$secret") { it == "OK_PROVISIONED" }; Unit } },
            progress = progress
        )
    }

    suspend fun sendProvisionCommand(secret: String): Pair<Boolean, String> = commands.withLock {
        try {
            require(secret.matches(Regex("[0-9a-f]{64}")))
            request("PROVISION:$secret") { it == "OK_PROVISIONED" }
            true to "Success"
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) {
            if (e.message?.startsWith("ERR_") != true) throw e
            false to when (e.message) {
                "ERR_PROVISIONING_NOT_ACTIVE" -> "Hold the motor BOOT button for 3 seconds, then pair within 60 seconds."
                "ERR_ALREADY_PROVISIONED" -> "This motor is already provisioned. Use its saved phone credentials."
                "ERR_HELMET_NOT_READY" -> "Power on your helmet and wait for the motor to connect, then retry."
                else -> e.message.orEmpty()
            }
        }
    }

    private suspend fun authenticate(secret: String, unlock: Boolean): Boolean = commands.withLock {
        val nonce = request(if (unlock) "AUTH_REQ" else "SESSION_REQ") { it.startsWith("NONCE:") }.substringAfter(':')
        require(nonce.matches(Regex("[0-9a-f]{64}"))) { "Invalid motor challenge" }
        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(javax.crypto.spec.SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val signature = HelmetProtocol.hex(mac.doFinal(nonce.toByteArray(Charsets.UTF_8)))
        val ok = if (unlock) "OK_UNLOCKED" else "OK_AUTHENTICATED"
        request((if (unlock) "UNLOCK:" else "AUTH:") + signature) { it == ok } == ok
    }

    suspend fun authenticateSession(secret: String): Boolean = authenticate(secret, false)
    suspend fun sendUnlockCommand(deviceSecret: String): Boolean = authenticate(deviceSecret, true)
    suspend fun readHelmetIdentity(): HelmetIdentity = commands.withLock {
        var timeouts = 0
        repeat(40) {
            try {
                return@withLock HelmetProtocol.parseIdentity(request("GET_HELMET_ID") { it.startsWith("HELMET_ID:") })
            } catch (e: IOException) {
                when (e.message) {
                    "ERR_HELMET_NOT_READY" -> Unit
                    "Bluetooth command timed out" -> if (++timeouts >= 3) throw e
                    else -> throw e
                }
            }
            delay(500)
        }
        throw IOException("Helmet is not ready. Check helmet power and keep it near the motor.")
    }

    fun writeCommand(command: String) {
        val active = socket ?: throw IOException("Bluetooth disconnected")
        writeTo(active, command)
    }
    private fun writeTo(owner: BluetoothSocket, command: String) {
        try {
            synchronized(writeLock) {
                if (socket !== owner || !connected) throw IOException("Bluetooth disconnected")
                owner.outputStream.write(command.toByteArray(Charsets.US_ASCII))
                owner.outputStream.flush()
            }
        } catch (e: IOException) { disconnectOwner(owner); throw e }
    }

    private fun startHeartbeat(owner: BluetoothSocket) {
        val executor = java.util.concurrent.Executors.newScheduledThreadPool(2) { job ->
            Thread(job, "MotoLock-heartbeat").apply { isDaemon = true }
        }
        synchronized(lock) {
            if (socket !== owner) { executor.shutdownNow(); return }
            heartbeatExecutor = executor
            executor.scheduleWithFixedDelay({
            if (socket === owner) {
                runCatching { heartbeat?.ping()?.let { writeTo(owner, it) } }
                    .onFailure { disconnectOwner(owner) }
            }
        }, 0, 1000, java.util.concurrent.TimeUnit.MILLISECONDS)
        // Independent of the writer: closing the socket also interrupts a blocked write/read.
        executor.scheduleWithFixedDelay({
            if (socket === owner && (heartbeat?.expired(SystemClock.elapsedRealtime()) != false ||
                    !runCatching { adapter?.isEnabled == true }.getOrDefault(false))) disconnectOwner(owner)
            }, 250, 250, java.util.concurrent.TimeUnit.MILLISECONDS)
        }
    }

    @SuppressLint("MissingPermission")
    private fun registerDisconnectReceiver(owner: BluetoothSocket) {
        val listener = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val radioOff = intent.action == BluetoothAdapter.ACTION_STATE_CHANGED &&
                    intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR) in
                    listOf(BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF)
                @Suppress("DEPRECATION")
                val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                val peerGone = intent.action == BluetoothDevice.ACTION_ACL_DISCONNECTED &&
                    device?.address == owner.remoteDevice.address
                if (radioOff || peerGone) disconnectOwner(owner)
            }
        }
        val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED).apply {
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
        }
        ContextCompat.registerReceiver(appContext, listener, filter, ContextCompat.RECEIVER_EXPORTED)
        synchronized(lock) {
            if (socket === owner) receiver = listener
            else runCatching { appContext.unregisterReceiver(listener) }
        }
    }

    fun readDataStream(): Flow<String> = lines
    fun disconnect() = disconnectOwner(null)

    private fun disconnectOwner(owner: BluetoothSocket?) {
        val old: BluetoothSocket?
        val oldReceiver: BroadcastReceiver?
        val oldExecutor: java.util.concurrent.ScheduledExecutorService?
        synchronized(lock) {
            if (owner != null && socket !== owner) { runCatching { owner.close() }; return }
            connected = false
            mutableConnectionState.value = false
            mutableMotorStatus.value = null
            old = socket
            socket = null
            oldReceiver = receiver
            receiver = null
            oldExecutor = heartbeatExecutor
            heartbeatExecutor = null
            heartbeat = null
            linkReady?.completeExceptionally(IOException("Bluetooth disconnected"))
            linkReady = null
            pending?.completeExceptionally(IOException("Bluetooth disconnected"))
            pending = null
            accepts = null
        }
        oldExecutor?.shutdownNow()
        oldReceiver?.let { runCatching { appContext.unregisterReceiver(it) } }
        runCatching { old?.close() }
    }
}
