"""Private JSON-lines worker launched by Node; it exposes no network port."""

import base64
import io
import json
import sys
import numpy as np
from PIL import Image
from encoder import FoodEncoder, MODEL_ID, MODEL_REVISION, ROOT
from retrieval import ReferenceIndex

Image.MAX_IMAGE_PIXELS = 40_000_000
index_path = sys.argv[1] if len(sys.argv) > 1 else ROOT / ".reference/vision-index.npz"
data = np.load(index_path, allow_pickle=False)
metadata = json.loads(str(data["metadata"]))
if metadata["model"] != MODEL_ID or metadata["revision"] != MODEL_REVISION:
    raise RuntimeError("Reference index encoder does not match the installed encoder")
if metadata.get("preprocessing") != "standard-and-padded-v1":
    raise RuntimeError("Reference index preprocessing does not match the encoder")
records, vectors = metadata["records"], data["vectors"]
index = ReferenceIndex(vectors, records)
reference_ids = [i for i, r in enumerate(records) if r["split"] == "reference"]
reference_only = ReferenceIndex(vectors[reference_ids], [records[i] for i in reference_ids])
encoder = FoodEncoder()
print(json.dumps({"ready": True, "references": len(records), "model": MODEL_ID}), flush=True)
for line in sys.stdin:
    request_id = None
    try:
        request = json.loads(line)
        request_id = request.get("id")
        payload = request["image"]["base64"]
        if not isinstance(payload, str) or len(payload) > 7_000_000:
            raise ValueError("Image payload is too large")
        with Image.open(io.BytesIO(base64.b64decode(payload, validate=True))) as image:
            if min(image.size) < 224 or image.width * image.height > 40_000_000:
                raise ValueError("Invalid image dimensions")
            vector = encoder.encode([image])[0]
        active = reference_only if request.get("referenceOnly") else index
        candidates = active.rank(vector, excluded_group=request.get("excludeGroup"))
        margin = candidates[0]["similarity"] - candidates[1]["similarity"]
        result = {"id": request_id, "candidates": candidates, "margin": margin}
    except Exception:
        result = {"id": request_id, "error": "Reference image comparison failed"}
    print(json.dumps(result), flush=True)
    # Release the last visitor image as soon as inference completes.
    request = payload = vector = line = None
