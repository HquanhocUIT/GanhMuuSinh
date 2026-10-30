"""Cosine nearest-reference retrieval; similarities are not probabilities."""

import numpy as np


class ReferenceIndex:
    def __init__(self, vectors, records):
        self.vectors = np.asarray(vectors, dtype=np.float32)
        self.records = records
        self.labels = sorted({row["expectedVendorId"] for row in records})

    def rank(self, vector, excluded_group=None, limit=3):
        # Float32 dot products of identical unit vectors can exceed 1 by a few
        # ulps. Bound cosine values before passing them through the API schema.
        similarities = np.clip(self.vectors @ vector, -1.0, 1.0)
        result = []
        for label in self.labels:
            indices = [i for i, row in enumerate(self.records)
                       if row["expectedVendorId"] == label and row["group"] != excluded_group]
            if not indices: continue
            nearest = sorted(indices, key=lambda i: float(similarities[i]), reverse=True)
            # Two different examples reduce a single misleading photo's influence.
            top, groups = [], set()
            for i in nearest:
                if self.records[i]["group"] in groups: continue
                top.append(i)
                groups.add(self.records[i]["group"])
                if len(top) == 2: break
            score = float(np.mean(similarities[top]))
            result.append({"dishKey": label, "similarity": score,
                           "nearestSimilarity": float(similarities[nearest[0]]),
                           "referenceIds": [self.records[i]["id"] for i in top],
                           "referencePaths": [self.records[i]["path"] for i in top],
                           "referenceHashes": [self.records[i]["sha256"] for i in top]})
        return sorted(result, key=lambda row: row["similarity"], reverse=True)[:limit]
