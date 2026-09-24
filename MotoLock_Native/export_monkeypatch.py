# coding=utf-8
import torch
import ultralytics
from ultralytics import YOLO

print("Monkey-patching torch.load to bypass weights_only PyTorch 2.6 restriction...")
original_load = torch.load

def safe_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return original_load(*args, **kwargs)

torch.load = safe_load

pt_path = "C:/Users/OEM/.gemini/antigravity-ide/brain/1869fd97-6c53-4b2f-9a0e-2730bb415093/scratch/Helmet-Detection-using-YOLO-v8/AdvHelmet.pt"
print(f"Loading {pt_path}...")
model = YOLO(pt_path)

print("Exporting to TFLite...")
model.export(format="tflite")
print("Export complete!")
