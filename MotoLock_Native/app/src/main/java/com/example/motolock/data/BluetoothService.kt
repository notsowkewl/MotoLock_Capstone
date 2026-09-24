package com.example.motolock.data

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.delay
import java.io.BufferedReader
import java.io.InputStreamReader

class BluetoothService(private val context: Context) {
    private val bluetoothManager: BluetoothManager = context.getSystemService(BluetoothManager::class.java)
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter
    private var bluetoothSocket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    // Standard SPP UUID for Bluetooth Serial
    private val MY_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    @SuppressLint("MissingPermission")
    suspend fun connectToDevice(macAddress: String): Boolean = withContext(Dispatchers.IO) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) return@withContext false

        try {
            val device: BluetoothDevice = bluetoothAdapter.getRemoteDevice(macAddress)
            bluetoothSocket = device.createRfcommSocketToServiceRecord(MY_UUID)
            bluetoothSocket?.connect()
            inputStream = bluetoothSocket?.inputStream
            outputStream = bluetoothSocket?.outputStream
            true
        } catch (e: Exception) {
            e.printStackTrace()
            disconnect()
            false
        }
    }

    suspend fun sendProvisionCommand(secret: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        try {
            outputStream?.write("PROVISION:$secret\n".toByteArray())
            outputStream?.flush()
            val reader = BufferedReader(InputStreamReader(inputStream))
            
            return@withContext kotlinx.coroutines.withTimeoutOrNull(5000L) {
                while (true) {
                    val line = reader.readLine()?.trim()
                    if (line == "OK_PROVISIONED") return@withTimeoutOrNull Pair(true, "Success")
                    if (line == "ERR_ALREADY_PROVISIONED") return@withTimeoutOrNull Pair(false, "Device is already paired to a phone. Please clear ESP32 memory.")
                    if (line == "ERR_PROVISIONING_NOT_ACTIVE") return@withTimeoutOrNull Pair(false, "Hold the physical pairing button on the ESP32 for 3 seconds first.")
                }
                Pair(false, "Unknown response")
            } ?: Pair(false, "Timeout waiting for ESP32 response.")
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext Pair(false, e.message ?: "Bluetooth error")
        }
    }

    suspend fun sendUnlockCommand(deviceSecret: String): Boolean = withContext(Dispatchers.IO) {
        try {
            // 1. Send auth request
            outputStream?.write("AUTH_REQ\n".toByteArray())
            outputStream?.flush()
            
            // 2. Wait for nonce from ESP32
            val reader = BufferedReader(InputStreamReader(inputStream))
            
            val nonce = kotlinx.coroutines.withTimeoutOrNull(2000L) {
                while (true) {
                    val line = reader.readLine()
                    if (line?.startsWith("NONCE:") == true) {
                        return@withTimeoutOrNull line.substringAfter("NONCE:").trim()
                    }
                }
                ""
            }
            
            if (nonce.isNullOrEmpty()) return@withContext false
            
            // 3. Compute HMAC-SHA256 of the nonce
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            val secretKey = javax.crypto.spec.SecretKeySpec(deviceSecret.toByteArray(), "HmacSHA256")
            mac.init(secretKey)
            val hash = mac.doFinal(nonce.toByteArray())
            val hexHash = hash.joinToString("") { "%02x".format(it) }
            
            // 4. Send signed unlock command
            outputStream?.write("UNLOCK:$hexHash\n".toByteArray())
            outputStream?.flush()
            
            // 5. Check if successful
            return@withContext kotlinx.coroutines.withTimeoutOrNull(2000L) {
                while (true) {
                    val line = reader.readLine()?.trim()
                    if (line == "OK_UNLOCKED") return@withTimeoutOrNull true
                }
                false
            } ?: false
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext false
        }
    }

    fun writeCommand(command: String) {
        try {
            outputStream?.write(command.toByteArray())
            outputStream?.flush()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun readDataStream(): Flow<String> = flow {
        val reader = BufferedReader(InputStreamReader(inputStream))
        while (true) {
            try {
                if (reader.ready()) {
                    val line = reader.readLine()
                    if (line != null) {
                        emit(line.trim())
                    }
                } else {
                    delay(100) // Polling delay
                }
            } catch (e: Exception) {
                e.printStackTrace()
                break
            }
        }
    }

    fun disconnect() {
        try {
            inputStream?.close()
            outputStream?.close()
            bluetoothSocket?.close()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
