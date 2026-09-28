import android.graphics.Bitmap
import android.graphics.Rect
import com.example.motolock.data.IntegratedLogoDetector
import java.awt.Color
import java.awt.geom.AffineTransform
import java.awt.image.ConvolveOp
import java.awt.image.Kernel
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

fun main(args: Array<String>) {
    val expectedId = args.getOrNull(4) ?: "MOTO-01D44"
    val logo = ImageIO.read(File(args[0]))
    val output = File(args[1]).apply { mkdirs() }
    val results = mutableListOf("scenario,expected,actual,result")
    fun check(name: String, image: BufferedImage, expected: String?, box: Rect = Rect(0, 0, image.width, image.height)) {
        val actual = IntegratedLogoDetector().extractIdentity(Bitmap(image), box)
        val result = if (actual == expected) "PASS" else "FAIL"
        results.add("$name,${expected ?: "null"},${actual ?: "null"},$result")
        ImageIO.write(image, "png", File(output, "$name.png"))
        println(results.last())
    }
    check("png-as-whole-helmet-box", logo, expectedId)
    // Assume an already-correct 800x800 helmet bounding box: this isolates logo detection.
    for (bg in listOf(0, 32, 128, 240, 255)) {
        for (size in listOf(100, 160, 240)) {
            for (angle in listOf(0, 10)) {
                val image = BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB)
                val g = image.createGraphics()
                g.color = Color(bg, bg, bg); g.fillRect(0, 0, 800, 800)
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
                val h = size * logo.height / logo.width
                g.rotate(Math.toRadians(angle.toDouble()), 400.0, 210.0)
                g.drawImage(logo, 400 - size / 2, 210 - h / 2, size, h, null)
                g.dispose()
                check("bg${bg}-width${size}-rotation${angle}", image, expectedId)
            }
        }
    }
    for (bg in listOf(0, 32, 128, 240, 255)) {
        val image = BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB)
        val g = image.createGraphics()
        g.color = Color(bg, bg, bg); g.fillRect(0, 0, 800, 800); g.dispose()
        check("blank-bg${bg}", image, null)
    }
    fun scene(sticker: BufferedImage, angle: Int = 0, x: Int = 310, y: Int = 120, w: Int = 180, h: Int = 212): BufferedImage {
        val image = BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB)
        val g = image.createGraphics()
        g.color = Color(50, 50, 50); g.fillRect(0, 0, 800, 800)
        // Unrelated vents/edges previously contaminated the combined edge bounds.
        g.color = Color.WHITE; g.fillRect(190, 80, 30, 180); g.fillOval(560, 110, 55, 90)
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
        g.rotate(Math.toRadians(angle.toDouble()), x + w / 2.0, y + h / 2.0)
        g.drawImage(sticker, x, y, w, h, null); g.dispose()
        return image
    }
    for (angle in listOf(-30, -17, 23, 35)) check("clutter-rotation$angle", scene(logo, angle), expectedId)
    check("off-center", scene(logo, x = 180, y = 80), expectedId)
    check("horizontal-compression", scene(logo, w = 140), expectedId)
    val blurred = ConvolveOp(Kernel(3, 3, FloatArray(9) { 1f / 9 }), ConvolveOp.EDGE_NO_OP, null).filter(scene(logo), null)
    check("mild-blur", blurred, expectedId)
    val dim = scene(logo)
    for (y in 0 until dim.height) for (x in 0 until dim.width) {
        val c = Color(dim.getRGB(x, y))
        dim.setRGB(x, y, Color((c.red * 0.75).toInt(), (c.green * 0.75).toInt(), (c.blue * 0.75).toInt()).rgb)
    }
    check("dim-75-percent", dim, expectedId)
    if (args.getOrNull(3) == "true") {
        File(output, "results.csv").writeText(results.joinToString("\n") + "\n")
        check(results.drop(1).none { it.endsWith(",FAIL") }) { "Supplied image failed; see results.csv" }
        return
    }
    // Use artwork positions but independently encode different payloads and corruptions.
    val svg = File(args[2]).readText()
    val positions = Regex("translate\\(([0-9.]+) ([0-9.]+)\\) rotate\\(([0-9.-]+)\\)").findAll(svg).toList()
    require(positions.size == 32)
    fun patched(payload: Int, flip: Int = -1): BufferedImage {
        val image = BufferedImage(logo.width, logo.height, BufferedImage.TYPE_INT_ARGB)
        val g = image.createGraphics(); g.drawImage(logo, 0, 0, null)
        val checksum = (((payload and 255) + ((payload ushr 8) and 255) + ((payload ushr 16) and 255)) xor 0xAA) and 255
        val bits = listOf(1,0,1,0,1,1) + (17 downTo 0).map { (payload ushr it) and 1 } + (7 downTo 0).map { (checksum ushr it) and 1 }
        for ((i, match) in positions.withIndex()) {
            g.transform = AffineTransform()
            g.scale(logo.width / 396.0, logo.height / 466.7143)
            g.translate(match.groupValues[1].toDouble() - 48, match.groupValues[2].toDouble() - 12)
            g.rotate(Math.toRadians(match.groupValues[3].toDouble()))
            val bit = bits[i] xor (if (i == flip) 1 else 0)
            g.color = if (bit == 1) Color(20, 20, 20) else Color.WHITE
            g.fillRect(-6, -9, 12, 18)
        }
        g.dispose(); return image
    }
    check("different-valid-id", scene(patched(0x2ABCD)), "MOTO-2ABCD")
    check("zero-valid-id", scene(patched(0)), "MOTO-00000")
    check("max-valid-id", scene(patched(0x3FFFF)), "MOTO-3FFFF")
    for (slot in 0 until 32) check("corrupted-slot$slot", scene(patched(0x1D44, slot)), null)
    val unrelated = BufferedImage(180, 212, BufferedImage.TYPE_INT_RGB)
    val ug = unrelated.createGraphics()
    ug.color = Color(128, 255, 128); ug.fillRect(0, 0, 180, 212)
    ug.color = Color.BLACK; ug.fillOval(20, 20, 140, 172); ug.dispose()
    check("unrelated-green-sticker", scene(unrelated), null)
    val occluded = scene(logo)
    val og = occluded.createGraphics(); og.color = Color.GRAY; og.fillRect(310, 200, 90, 70); og.dispose()
    check("occluded", occluded, null)
    // Background removal must not make registration depend on the PNG canvas bounds.
    val padded = BufferedImage(logo.width + 120, logo.height + 80, BufferedImage.TYPE_INT_ARGB)
    val pg = padded.createGraphics(); pg.drawImage(logo, 70, 20, null); pg.dispose()
    check("transparent-padding", scene(padded, w = 240, h = 260), expectedId)
    val distractors = scene(logo)
    val dg = distractors.createGraphics(); dg.color = Color.RED
    dg.fillOval(60, 70, 55, 40); dg.fillRect(620, 95, 70, 80); dg.dispose()
    check("red-distractors", distractors, expectedId)
    val highResolution = BufferedImage(1600, 1600, BufferedImage.TYPE_INT_RGB)
    val hg = highResolution.createGraphics(); hg.drawImage(scene(logo), 0, 0, 1600, 1600, null); hg.dispose()
    check("downsampled-camera", highResolution, expectedId)
    val redShapes = BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB)
    val rg = redShapes.createGraphics(); rg.color = Color.GRAY; rg.fillRect(0, 0, 800, 800)
    rg.color = Color.RED; rg.fillOval(320, 100, 80, 50); rg.fillRect(315, 180, 90, 90); rg.dispose()
    check("unrelated-red-shapes", redShapes, null)
    val random = java.util.Random(44)
    val noise = BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB)
    for (y in 0 until 800) for (x in 0 until 800) noise.setRGB(x, y, random.nextInt(0x1000000))
    check("random-color-noise", noise, null)
    check("offset-helmet-box", scene(logo), expectedId, Rect(150, 40, 650, 600))
    val ambiguous = scene(logo, x = 180)
    val ag = ambiguous.createGraphics(); ag.drawImage(patched(if (expectedId == "MOTO-2ABCD") 0x1D44 else 0x2ABCD), 450, 120, 180, 212, null); ag.dispose()
    check("two-conflicting-ids", ambiguous, null)
    check("invalid-box", scene(logo), null, Rect(900, 900, 850, 850))
    check("outside-box", scene(logo), null, Rect(-100, -100, -10, -10))
    File(output, "results.csv").writeText(results.joinToString("\n") + "\n")
    check(results.drop(1).none { it.endsWith(",FAIL") }) { "Detector regression failed; see results.csv" }
}
