"""Extract every dataset image once; reusable for grouped evaluation and index building."""

import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
from encoder import FoodEncoder, ROOT, MODEL_ID, MODEL_REVISION

parser = argparse.ArgumentParser()
parser.add_argument("--download", action="store_true")
parser.add_argument("--manifest")
parser.add_argument("--output", default=".reference/dataset-features")
args = parser.parse_args()
if args.manifest:
    source = json.loads((ROOT / args.manifest).read_text(encoding="utf8"))
    manifest = source if isinstance(source, list) else source["records"]
else:
    manifest = []
    for folder in sorted((ROOT / "dataset").iterdir()):
        if not folder.is_dir(): continue
        label = {"che_dau_xanh": "che"}.get(folder.name, folder.name).replace("_", "-")
        files = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"})
        for i, path in enumerate(files, 1):
            manifest.append({"id": f"{label}-{i:03d}", "path": path.relative_to(ROOT).as_posix(),
                             "expectedVendorId": label, "selectedVendorId": label, "folder": folder.name})
    (ROOT / ".reference").mkdir(exist_ok=True)
    (ROOT / ".reference/dataset-all.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")
encoder = FoodEncoder(allow_download=args.download)
vectors, records = [], []
for sample in manifest:
    if not sample.get("path"):
        sample["path"] = f".reference/vision-images/{sample['id']}.jpg"
    path = ROOT / sample["path"]
    try:
        with Image.open(path) as image:
            vector = encoder.encode([image])[0]
            sample.update(width=image.width, height=image.height)
        sample["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        vectors.append(vector)
        records.append(sample)
        print(f"{len(records)}/{len(manifest)} {sample['path']}", flush=True)
    except Exception as error:
        print(f"ERROR {sample['path']}: {error}", flush=True)
np.savez_compressed(ROOT / f"{args.output}.npz", vectors=np.stack(vectors))
# Preserve the original default file name for the dataset audit/index commands.
records_path = ".reference/dataset-feature-records.json" if args.output == ".reference/dataset-features" else f"{args.output}-records.json"
(ROOT / records_path).write_text(
    json.dumps({"model": MODEL_ID, "revision": MODEL_REVISION, "records": records}, indent=2), encoding="utf8"
)
