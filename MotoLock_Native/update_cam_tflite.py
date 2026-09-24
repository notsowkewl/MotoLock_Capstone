# coding=utf-8
with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

imports_old = """import androidx.core.content.ContextCompat
import com.example.motolock.data.BluetoothService
import com.example.motolock.data.DualAiAnalyzer
import kotlinx.coroutines.launch
import java.util.concurrent.Executors"""
imports_new = """import androidx.core.content.ContextCompat
import com.example.motolock.data.BluetoothService
import com.example.motolock.data.DualAiAnalyzer
import kotlinx.coroutines.launch
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.Executors"""
code = code.replace(imports_old, imports_new)

init_old = """    val bluetoothService = remember { BluetoothService(context) }"""
init_new = """    val bluetoothService = remember { BluetoothService(context) }
    
    // Load TFLite Model
    val faceNetInterpreter = remember {
        try {
            val assetFileDescriptor = context.assets.openFd("mobilefacenet.tflite")
            val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
            val fileChannel = fileInputStream.channel
            val startOffset = assetFileDescriptor.startOffset
            val declaredLength = assetFileDescriptor.declaredLength
            val buffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
            
            val options = Interpreter.Options().apply {
                setNumThreads(4)
            }
            Interpreter(buffer, options)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }"""
code = code.replace(init_old, init_new)

analyzer_old = """                            val imageAnalysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()

                            imageAnalysis.setAnalyzer(executor, DualAiAnalyzer(null, null) { success, message ->"""
analyzer_new = """                            val imageAnalysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()

                            imageAnalysis.setAnalyzer(executor, DualAiAnalyzer(faceNetInterpreter, null) { success, message ->"""
code = code.replace(analyzer_old, analyzer_new)

with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)

