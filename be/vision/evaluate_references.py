import json
import numpy as np
from config import ROOT
from retrieval import ReferenceIndex

manifest = json.loads((ROOT / "be/eval/dataset-manifest.json").read_text(encoding="utf8"))
records = manifest["records"]
vectors = np.load(ROOT / ".reference/dataset-features.npz")["vectors"]
selected = [i for i, row in enumerate(records) if row["split"] == "reference"]
index = ReferenceIndex(vectors[selected], [records[i] for i in selected])
results = []
for i, row in enumerate(records):
    ranked = index.rank(vectors[i], excluded_group=row["group"])
    results.append({"id": row["id"], "path": row["path"], "split": row["split"],
                    "expected": row["expectedVendorId"], "candidates": ranked,
                    "correct": ranked[0]["dishKey"] == row["expectedVendorId"],
                    "margin": ranked[0]["similarity"] - ranked[1]["similarity"]})
for split in ["development", "test"]:
    rows = [x for x in results if x["split"] == split]
    print(split, sum(x["correct"] for x in rows), "/", len(rows))
    for r in rows:
        print(r["path"],r["correct"],[(c["dishKey"],round(c["similarity"],3)) for c in r["candidates"]],round(r["margin"],3))
output = ROOT / ".reference/reference-evaluation.json"
output.write_text(json.dumps({"results": results}, indent=2), encoding="utf8")
similarities = vectors @ vectors.T
for i in range(len(records)):
    for j in range(i):
        if similarities[i,j] > .97:
            print("NEAR DUPLICATE",round(float(similarities[i,j]),4),records[i]["path"],records[j]["path"])
