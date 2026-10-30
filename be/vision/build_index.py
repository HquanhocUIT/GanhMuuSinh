import json
import numpy as np
from config import ROOT, MODEL_ID, MODEL_REVISION

manifest = json.loads((ROOT / "be/eval/dataset-manifest.json").read_text(encoding="utf8"))
records = manifest["records"]
vectors = np.load(ROOT / ".reference/dataset-features.npz", allow_pickle=False)["vectors"]
features = json.loads((ROOT / ".reference/dataset-feature-records.json").read_text(encoding="utf8"))["records"]
if [(r["id"], r["sha256"]) for r in features] != [(r["id"], r["sha256"]) for r in records]:
    raise RuntimeError("Feature cache and dataset manifest differ; re-extract and audit the photos.")
selected = [i for i, row in enumerate(records) if row["split"] in {"reference", "development"}]
metadata = {"model": MODEL_ID, "revision": MODEL_REVISION,
            "preprocessing": "standard-and-padded-v1", "records": [records[i] for i in selected]}
destination = ROOT / ".reference/vision-index.npz"
np.savez_compressed(destination, vectors=vectors[selected], metadata=np.array(json.dumps(metadata)))
print(f"Index: {len(selected)} photos, {len({records[i]['expectedVendorId'] for i in selected})} classes. Test photos excluded.")
