package com.example.motolock.data

import java.nio.ByteBuffer
import java.nio.ByteOrder

object TensorPixels {
    fun rgb(pixels:IntArray,channelsFirst:Boolean,offset:Float=0f,divisor:Float=255f):ByteBuffer {
        val result=ByteBuffer.allocateDirect(pixels.size*12).order(ByteOrder.nativeOrder())
        fun put(pixel:Int,shift:Int) {result.putFloat((((pixel shr shift) and 255)-offset)/divisor)}
        if(channelsFirst) for(shift in intArrayOf(16,8,0)) for(pixel in pixels) put(pixel,shift)
        else for(pixel in pixels) for(shift in intArrayOf(16,8,0)) put(pixel,shift)
        result.rewind()
        return result
    }
}
