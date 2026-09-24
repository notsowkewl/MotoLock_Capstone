# coding=utf-8
import torch
import ultralytics
from ultralytics import YOLO
import os

print("Applying PyTorch safe_globals bypass...")
try:
    torch.serialization.add_safe_globals([ultralytics.nn.tasks.DetectionModel])
    # Also sometimes requires extra globals for ultralytics
    from ultralytics.utils.loss import v8DetectionLoss, BboxLoss
    from ultralytics.utils.tal import TaskAlignedAssigner
    torch.serialization.add_safe_globals([v8DetectionLoss, BboxLoss, TaskAlignedAssigner])
except AttributeError:
    pass # PyTorch version might not have this, which means the error was something else, but we know it does.

pt_path = "C:/Users/OEM/.gemini/antigravity-ide/brain/1869fd97-6c53-4b2f-9a0e-2730bb415093/scratch/Helmet-Detection-using-YOLO-v8/AdvHelmet.pt"
print(f"Loading {pt_path}...")
model = YOLO(pt_path)

print("Exporting to TFLite...")
model.export(format="tflite")
print("Export complete!")
