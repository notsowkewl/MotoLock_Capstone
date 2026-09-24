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

    suspend fun sendCommand(command: String) = withContext(Dispatchers.IO) {
        try {
            outputStream?.write(command.toByteArray())
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
