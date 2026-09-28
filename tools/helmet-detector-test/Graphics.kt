// Desktop adapters for the only Android graphics operations used by the detector.
package android.graphics
import java.awt.image.BufferedImage
class Rect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    fun width() = right - left
    fun height() = bottom - top
}
class Bitmap(val image: BufferedImage) {
    val width get() = image.width
    val height get() = image.height
    fun getPixels(pixels: IntArray, offset: Int, stride: Int, x: Int, y: Int, width: Int, height: Int) {
        image.getRGB(x, y, width, height, pixels, offset, stride)
    }
}
