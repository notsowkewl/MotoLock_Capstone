# coding=utf-8
from ultralytics import YOLO

# Attempt export
try:
    model = YOLO("C:/Users/OEM/.gemini/antigravity-ide/brain/1869fd97-6c53-4b2f-9a0e-2730bb415093/scratch/Helmet-Detection-using-YOLO-v8/AdvHelmet.pt")
    model.export(format="tflite")
    print("Export successful!")
except Exception as e:
    print(f"Export failed: {e}")
