"""Audit shipped TFLite contracts without executing any training checkpoint.
Run from repository root: python3 tools/model-evaluation/audit.py
"""
from pathlib import Path
import hashlib
import json
import pickletools
import subprocess
import zipfile

root = Path(__file__).resolve().parents[2]
models = []
for name in ('helmet.tflite', 'mobilefacenet.tflite'):
    asset = root / 'MotoLock_Native/app/src/main/assets' / name
    model = json.loads(subprocess.check_output(['node', str(Path(__file__).with_name('inspect-tflite.cjs')), str(asset)], text=True))
    model['sha256'] = hashlib.sha256(asset.read_bytes()).hexdigest()
    model['same_as_root_copy'] = asset.read_bytes() == (root / name).read_bytes()
    model['bytes'] = asset.stat().st_size
    models.append(model)
checkpoint = root / '.work/native-verification/AdvHelmet.reference.pt'
reference = None
if checkpoint.exists():
    with zipfile.ZipFile(checkpoint) as archive:
        data = archive.read(next(n for n in archive.namelist() if n.endswith('/data.pkl')))
    # Inspect pickle opcodes only. Never unpickle/execute an untrusted checkpoint.
    operations = list(pickletools.genops(data))
    for index, (_, value, _) in enumerate(operations):
        if value == 'names':
            labels = [arg for op, arg, _ in operations[index+1:index+18] if op.name == 'BINUNICODE']
            reference = {'path': str(checkpoint), 'names_observed': labels,
                         'note': 'Reference has 3 labels; shipped helmet tensor has 2 class channels. Provenance/mapping is unverified.'}
            break
report = {'accuracy_measured': False, 'models': models, 'reference_checkpoint': reference}
output = root / 'build/model-evaluation'
output.mkdir(parents=True, exist_ok=True)
(output / 'static-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(output / 'static-audit.json')
