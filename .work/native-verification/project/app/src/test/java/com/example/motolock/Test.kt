import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import java.io.File

fun main() = runBlocking {
    try {
        val res = SupabaseClientManager.client.postgrest["emergency_contacts"].select().decodeList<JsonObject>()
        File("C:\\Users\\OEM\\Downloads\\MotoLock_Native\\scratch_output.txt").writeText(res.toString())
    } catch(e: Exception) {
        File("C:\\Users\\OEM\\Downloads\\MotoLock_Native\\scratch_output.txt").writeText(e.toString())
    }
}
