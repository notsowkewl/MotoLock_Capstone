package com.example.motolock.data

import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*

object FaceProfiles {
    fun decode(value:JsonElement?):FloatArray {
        require(value!=null && value !is JsonNull) {"No saved Face ID. Register your face first."}
        val decoded=if(value is JsonPrimitive && value.isString) Json.parseToJsonElement(value.content) else value
        val array=decoded as? JsonArray ?: error("Saved Face ID is not a valid face profile. Register again.")
        return VerificationPolicy.normalize(array.map {it.jsonPrimitive.float}.toFloatArray())
    }

    fun isUsable(value:JsonElement?)=runCatching {decode(value)}.isSuccess

    private suspend fun currentProfile():JsonObject {
        val user=SupabaseClientManager.client.auth.currentSessionOrNull()?.user ?: error("Sign in to load your Face ID")
        var rows=SupabaseClientManager.client.postgrest["users"].select {filter {eq("id",user.id)}}.decodeList<JsonObject>()
        // Existing registrations may use a separate public profile ID. Match only the signed-in account's email.
        if(rows.isEmpty() && !user.email.isNullOrBlank()) {
            rows=SupabaseClientManager.client.postgrest["users"].select {filter {eq("email",user.email!!)}}.decodeList<JsonObject>()
        }
        check(rows.size==1) {"Cannot identify a unique rider profile for this account"}
        val profile=rows.single()
        check(profile["status"]?.jsonPrimitive?.content?.lowercase()=="active") {"Your rider account is not active"}
        return profile
    }

    suspend fun load():FloatArray=withTimeout(10000) {decode(currentProfile()["face_descriptor"])}

    suspend fun saveAndVerify(embedding:FloatArray)=withTimeout(10000) {
        val normalized=VerificationPolicy.normalize(embedding)
        val profile=currentProfile(); val id=profile.getValue("id").jsonPrimitive.content
        val descriptor=JsonArray(normalized.map {JsonPrimitive(it)})
        val updated=SupabaseClientManager.client.postgrest["users"].update({set("face_descriptor",descriptor)}) {
            filter {eq("id",id)}; select()
        }.decodeList<JsonObject>()
        check(updated.size==1) {"Face ID was not saved. Check your account's database access."}
        val saved=load()
        check(VerificationPolicy.distance(saved,normalized)<0.001f) {"Saved Face ID could not be verified. Please retry."}
    }
}
