# Desktop detector regression

Run from the repository root:

```sh
python3 tools/helmet-detector-test/run.py
python3 tools/helmet-detector-test/run.py --image public/helmet-logo-MOTO-01D44-green-removebg-preview.png --output build/helmet-detector-test-removebg
```

Compiles production LogoIdentityDetector.kt with desktop Bitmap/Rect adapters. Java, Node, Python and locally cached Gradle Kotlin compiler dependencies are required. The selected PNG supplies the primary fixture; alternate payloads and damaged bits are painted at the generator's slot coordinates while preserving transparency. Add --fixture-only to skip derived fixtures.

Results and test images go to the selected output directory. Any failed expectation causes a nonzero exit. Preserve each PNG's separate output directory when comparing versions.

This checks localization and decoding on synthetic images, not the Android camera pipeline or printed curved-surface performance. Registration supports the red lock/M as well as the optional green rectangular margin. Preserve all red logo shapes and black/white data marks when printing. Red component reference moments in the detector were measured from public/logo.png using the detector's red threshold; remeasure them if the logo artwork changes.
