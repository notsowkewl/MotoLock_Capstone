package com.example.motolock.data

import org.json.JSONObject

data class HardwareStatus(val worn:Boolean,val test:String,val authorized:Boolean,val locked:Boolean,val session:String,val protocol:Int,val sensorFresh:Boolean) {
    companion object {
        fun parse(line:String):HardwareStatus? {
            if(!line.startsWith("STATUS:")) return null
            val j=JSONObject(line.removePrefix("STATUS:"))
            return HardwareStatus(j.getBoolean("irDetected"),j.getString("testStatus"),j.getBoolean("startAuthorized"),
                j.getBoolean("locked"),j.optString("verificationSession"),j.optInt("verificationProtocol",0),j.optBoolean("helmetDataFresh",false))
        }
    }
}
