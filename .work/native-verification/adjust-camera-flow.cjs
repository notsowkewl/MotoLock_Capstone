const fs = require('fs');
const root = __dirname + '/project/app/src/main/java/com/example/motolock/';
function replace(s, a, b) { if (!s.includes(a)) throw Error('Missing: '+a.slice(0,100)); return s.replace(a,b); }
let s = fs.readFileSync(root+'UnlockScreen.kt','utf8').replace(/\r\n/g,'\n');
s = replace(s,'import com.example.motolock.data.DualAiAnalyzer','import com.example.motolock.data.DualAiAnalyzer\nimport com.example.motolock.data.FaceData');
s = replace(s,'    // Flags for Stage 2 (Face + Helmet + IR)',`    var aiReady by remember { mutableStateOf(false) }
    val cameraWorker = remember { Executors.newSingleThreadExecutor() }
    var cameraAnalysis by remember { mutableStateOf<ImageAnalysis?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var activeAnalyzer by remember { mutableStateOf<DualAiAnalyzer?>(null) }
    val disposed = remember { java.util.concurrent.atomic.AtomicBoolean(false) }

    // Camera-only status; no hardware sensor is simulated.`);
s = s.replace(/    var isIrSensorPositive[^\n]*\n[\s\S]*?    \/\/ Init Models and Embedding/, '    // Init Models and Embedding');
s = replace(s,`                if (faceDesc is JsonArray) {
                    registeredEmbedding = FloatArray(faceDesc.size) { i ->
                        (faceDesc[i] as JsonPrimitive).content.toFloat()
                    }
                }`, `                registeredEmbedding = FaceData.decode(faceDesc)`);
s = replace(s,'            }\n        } catch (e: Exception) {','            } else error("Sign in to load your Face ID")\n            aiReady = true\n            statusMessage = "Position your face in the camera."\n        } catch (e: Exception) {');
s = replace(s,'statusMessage = "Error loading AI models: ${e.message}"','statusMessage = e.message ?: "Unable to load your saved Face ID"');
s = replace(s,'        // Mock IR sensor being positive so camera tests can proceed\n        isIrSensorPositive = true','        // IR/alcohol integration is deferred until hardware is available.');
s = replace(s,`            bluetoothService?.disconnect()
            faceNetInterpreter?.close()
            helmetInterpreter?.close()`, `            disposed.set(true)
            cameraAnalysis?.clearAnalyzer()
            cameraAnalysis?.let { cameraProvider?.unbind(it) }
            activeAnalyzer?.stop()
            bluetoothService?.disconnect()
            cameraWorker.execute {
                activeAnalyzer?.close()
                faceNetInterpreter?.close()
                helmetInterpreter?.close()
            }
            cameraWorker.shutdown()`);
s = replace(s,'&& hasCameraPermission) {','&& hasCameraPermission && aiReady) {');
s = replace(s,'                            val cameraProvider = cameraProviderFuture.get()', '                            if (disposed.get()) return@addListener\n                            val provider = cameraProviderFuture.get()\n                            cameraProvider = provider');
const start = s.indexOf('                                    it.setAnalyzer(Executors.newSingleThreadExecutor(), DualAiAnalyzer(');
const end = s.indexOf('\n                                }', start);
if(start<0||end<0) throw Error('analyzer missing');
s = s.slice(0,start)+`                                    cameraAnalysis = it
                                    val analyzer = DualAiAnalyzer(faceNetInterpreter, helmetInterpreter, registeredEmbedding) { success, msg ->
                                        isFaceAndHelmetDetected = success
                                        currentStep = UnlockStep.FACE_HELMET_CHECK
                                        statusMessage = msg
                                    }
                                    activeAnalyzer = analyzer
                                    it.setAnalyzer(cameraWorker, analyzer)`+s.slice(end);
s=s.replace('cameraProvider.unbindAll()','provider.unbindAll()').replace('cameraProvider.bindToLifecycle(','provider.bindToLifecycle(');
fs.writeFileSync(root+'UnlockScreen.kt',s);

s = fs.readFileSync(root+'CameraScreen.kt','utf8').replace(/\r\n/g,'\n');
s = replace(s,'import com.example.motolock.data.DualAiAnalyzer','import com.example.motolock.data.DualAiAnalyzer\nimport com.example.motolock.data.FaceData');
s = replace(s,'    val rightEyeOpen: Float\n','    val rightEyeOpen: Float,\n    val captureFace: (() -> FloatArray?)? = null\n');
s = replace(s,'    val eyePhaseState     = remember { mutableIntStateOf(0) }', `    val eyePhaseState     = remember { mutableIntStateOf(0) }
    var enrollmentEmbedding by remember { mutableStateOf<FloatArray?>(null) }
    val cameraWorker = remember { Executors.newSingleThreadExecutor() }
    var cameraAnalysis by remember { mutableStateOf<ImageAnalysis?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var unlockAnalyzer by remember { mutableStateOf<DualAiAnalyzer?>(null) }
    var registrationAnalyzer by remember { mutableStateOf<LivenessAnalyzer?>(null) }
    val disposed = remember { java.util.concurrent.atomic.AtomicBoolean(false) }`);
s=replace(s,'    DisposableEffect(Unit) { onDispose { bluetoothService.disconnect() } }',`    DisposableEffect(Unit) { onDispose {
        disposed.set(true)
        cameraAnalysis?.clearAnalyzer()
        cameraAnalysis?.let { cameraProvider?.unbind(it) }
        unlockAnalyzer?.stop()
        registrationAnalyzer?.close()
        bluetoothService.disconnect()
        cameraWorker.execute {
            unlockAnalyzer?.close()
            faceNetInterp?.close()
            helmetInterp?.close()
        }
        cameraWorker.shutdown()
    } }`);
s=replace(s,'            val profile = SupabaseClientManager', '            var profile = SupabaseClientManager');
s=replace(s,'            val faceDescElement = profile?.get("face_descriptor")', `            if (profile == null && !authUser.email.isNullOrBlank()) {
                profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("email", authUser.email!!) } }.decodeSingleOrNull<JsonObject>()
            }
            val faceDescElement = profile?.get("face_descriptor")
            registeredEmb = runCatching { FaceData.decode(faceDescElement) }.getOrNull()`);
s=replace(s,'if (profile != null && faceDescElement != null && faceDescElement !is JsonNull)', 'if (registeredEmb != null)');
const rs=s.indexOf('                    runCatching {');
const re=s.indexOf('                    cameraMode = CameraMode.UNLOCK',rs);
if(rs<0||re<0) throw Error('parse block missing');
s=s.slice(0,rs)+s.slice(re);
s=replace(s,'val ex = Executors.newSingleThreadExecutor()', 'val ex = cameraWorker');
s=replace(s,'                                        val cp = cpf.get()', '                                        if (disposed.get()) return@addListener\n                                        val cp = cpf.get()\n                                        cameraProvider = cp');
s=replace(s,'                                        when (cameraMode) {','                                        cameraAnalysis = ia\n                                        when (cameraMode) {');
s=replace(s,'ia.setAnalyzer(ex, LivenessAnalyzer { frame ->','val analyzer = LivenessAnalyzer(faceNetInterp) { frame ->');
s=replace(s,'if (stepState.value == LivenessStep.FAILED) return@LivenessAnalyzer','if (stepState.value in listOf(LivenessStep.FAILED, LivenessStep.PROCESSING, LivenessStep.SUCCESS)) return@LivenessAnalyzer');
for(const message of ['Multiple faces detected!', 'No face detected']) {
 s=replace(s,`statusText = "${message}"
                                                        eyePhaseState.intValue = 0`, `statusText = "${message}"
                                                        enrollmentEmbedding = null
                                                        livenessStep = LivenessStep.DETECT_FACE
                                                        eyePhaseState.intValue = 0`);
}
s=replace(s,`                                                                    if (open) {
                                                                        livenessStep = LivenessStep.TURN_LEFT`, `                                                                    if (open) {
                                                                        // Capture once after the blink; no extra hold step or inference during blinking.
                                                                        enrollmentEmbedding = frame.captureFace?.invoke()
                                                                        if (enrollmentEmbedding == null) {
                                                                            statusText = "Could not capture face. Face the camera and blink again."
                                                                            eyePhaseState.intValue = 0
                                                                            return@LivenessAnalyzer
                                                                        }
                                                                        livenessStep = LivenessStep.TURN_LEFT`);
s=replace(s,'saveRegisteredFace(context)', 'saveRegisteredFace(enrollmentEmbedding)');
s=replace(s,`                                                })
                                            }

                                            CameraMode.UNLOCK`, `                                                }
                                                registrationAnalyzer = analyzer
                                                ia.setAnalyzer(ex, analyzer)
                                            }

                                            CameraMode.UNLOCK`);
const us=s.indexOf('                                                ia.setAnalyzer(ex, DualAiAnalyzer(');
const ue=s.indexOf('\n                                            else -> {}',us);
if(us<0||ue<0) throw Error('unlock missing');
s=s.slice(0,us)+`                                                val analyzer = DualAiAnalyzer(faceNetInterp, helmetInterp, registeredEmb) { ok, msg ->
                                                    // Re-evaluate continuously; a camera pass never sends hardware commands.
                                                    isSuccess = ok
                                                    statusText = msg
                                                }
                                                unlockAnalyzer = analyzer
                                                ia.setAnalyzer(ex, analyzer)
                                            }`+s.slice(ue);
s=replace(s,'class LivenessAnalyzer(\n', 'class LivenessAnalyzer(\n    private val faceModel: Interpreter?,\n');
s=replace(s,') : ImageAnalysis.Analyzer {', ') : ImageAnalysis.Analyzer, AutoCloseable {');
s=replace(s,'    private var isProcessing = false','    private var isProcessing = false\n    @Volatile private var stopped = false\n    override fun close() { stopped = true; detector.close() }');
s=replace(s,'        if (isProcessing) {', '        if (stopped || isProcessing) {');
s=replace(s,'            .addOnSuccessListener { faces ->\n                when {','            .addOnSuccessListener { faces ->\n                if (stopped) { isProcessing = false; proxy.close(); return@addOnSuccessListener }\n                when {');
s=replace(s,'rightEyeOpen = f.rightEyeOpenProbability ?: 1f',`rightEyeOpen = f.rightEyeOpenProbability ?: 1f,
                            captureFace = {
                                runCatching {
                                    val model = requireNotNull(faceModel) { "Face model not loaded" }
                                    val bitmap = FaceData.uprightBitmap(proxy)
                                    try { FaceData.embed(bitmap, f.boundingBox, model) } finally { bitmap.recycle() }
                                }.getOrNull()
                            }`);
s=replace(s,'private suspend fun saveRegisteredFace(context: Context,', 'private suspend fun saveRegisteredFace(embedding: FloatArray?,');
s=replace(s,'        val emb  = FloatArray(128) { 0.1f }\n        val json = "[" + emb.joinToString(",") + "]"','        val emb = FaceData.normalize(requireNotNull(embedding) { "No face captured. Try again." })\n        val json = JsonArray(emb.map { JsonPrimitive(it) })');
s=replace(s,'faceDescriptor = kotlinx.serialization.json.Json.parseToJsonElement(json)','faceDescriptor = json');
s=replace(s,`        if (verifyById?.faceDescriptor == null && verifyByEmail?.faceDescriptor == null) {
             throw Exception("Verification failed. Data was not persisted in Supabase.")
        }`, `        val saved = FaceData.decode((verifyById ?: verifyByEmail)?.faceDescriptor)
        check(saved.indices.all { kotlin.math.abs(saved[it] - emb[it]) < 0.0001f }) {
            "Saved Face ID did not match the captured face. Please retry."
        }`);
fs.writeFileSync(root+'CameraScreen.kt',s);
