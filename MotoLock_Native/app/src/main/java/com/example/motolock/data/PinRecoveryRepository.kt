package com.example.motolock.data

import com.example.motolock.network.SupabaseClientManager
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.post
import io.ktor.client.request.header
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

object PinRecoveryRepository {
    private val http = HttpClient(Android)

    suspend fun requestCode(email: String) = invoke(
        buildJsonObject {
            put("action", "request")
            put("email", email.trim())
        }.toString()
    )

    suspend fun complete(email: String, code: String, pin: String) = invoke(
        buildJsonObject {
            put("action", "complete")
            put("email", email.trim())
            put("code", code.trim())
            put("pin", pin)
        }.toString()
    )

    private suspend fun invoke(payload: String) {
        val response = http.post("${SupabaseClientManager.SUPABASE_URL}/functions/v1/rider-pin-recovery") {
            header("apikey", SupabaseClientManager.SUPABASE_ANON_KEY)
            header(HttpHeaders.Accept, ContentType.Application.Json)
            contentType(ContentType.Application.Json)
            setBody(payload)
        }
        val body = response.bodyAsText()
        if (response.status.value !in 200..299) {
            val message = runCatching {
                Json.parseToJsonElement(body).let { (it as kotlinx.serialization.json.JsonObject)["error"]?.toString()?.trim('"') }
            }.getOrNull()
            throw IllegalStateException(message ?: "PIN recovery could not be completed. Try again.")
        }
    }
}
