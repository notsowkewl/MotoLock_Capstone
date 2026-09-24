package com.example.motolock.data

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

class BluetoothService(context:Context) {
    private val adapter=context.getSystemService(BluetoothManager::class.java)?.adapter
    @Volatile private var socket:BluetoothSocket?=null
    private val writeMutex=Mutex()
    @SuppressLint("MissingPermission")
    suspend fun connectToDevice(macAddress:String):Boolean=withContext(Dispatchers.IO) {
        disconnect()
        try {
            val device=adapter?.getRemoteDevice(macAddress) ?: return@withContext false
            val connection=device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
            socket=connection; connection.connect(); true
        } catch(e:Exception) {if(e is CancellationException) throw e; disconnect(); false}
    }
    suspend fun sendCommand(command:String)=withContext(Dispatchers.IO) {
        require(!command.contains('\n') && !command.contains('\r'))
        writeMutex.withLock {
            val stream=socket?.outputStream ?: error("Bluetooth disconnected")
            stream.write((command+"\n").toByteArray(Charsets.UTF_8)); stream.flush()
        }
    }
    fun readDataStream():Flow<String> = flow {
        val input=socket?.inputStream ?: error("Bluetooth disconnected")
        val pending=StringBuilder(); val bytes=ByteArray(1024)
        while(currentCoroutineContext().isActive) {
            val available=input.available()
            if(available==0) {delay(25); continue}
            val count=input.read(bytes,0,minOf(available,bytes.size)); check(count>=0) {"Bluetooth disconnected"}
            for(i in 0 until count) {
                val c=bytes[i].toInt().toChar()
                if(c=='\n') {emit(pending.toString().trim()); pending.setLength(0)}
                else {pending.append(c); check(pending.length<=4096) {"Invalid hardware message"}}
            }
        }
    }.flowOn(Dispatchers.IO)
    fun disconnect() {runCatching {socket?.close()}; socket=null}
}
