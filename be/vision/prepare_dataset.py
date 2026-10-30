"""Audit dimensions/duplicates and freeze group-disjoint reference/dev/test splits."""

import hashlib
import json
import argparse
from collections import defaultdict
import numpy as np
from PIL import Image, ImageOps
from config import ROOT, MODEL_ID, MODEL_REVISION


def hashes(path):
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert("L")
        small = np.asarray(image.resize((32, 32)), dtype=np.float64)
        basis = np.cos(np.pi * np.arange(8)[:, None] * (2 * np.arange(32) + 1) / 64)
        coefficients = basis @ small @ basis.T
        bits = coefficients.flatten()[1:] > np.median(coefficients.flatten()[1:])
        phash = int("".join("1" if x else "0" for x in bits), 2)
        tiny = np.asarray(image.resize((9, 8)), dtype=np.int16)
        bits = (tiny[:, 1:] > tiny[:, :-1]).flatten()
        dhash = int("".join("1" if x else "0" for x in bits), 2)
    return phash, dhash


def prepare(reset_splits=False):
    source = ROOT / ".reference/dataset-feature-records.json"
    records = json.loads(source.read_text(encoding="utf8"))["records"]
    review_path = ROOT / "be/eval/dataset-labels.json"
    reviews = json.loads(review_path.read_text(encoding="utf8")) if review_path.exists() else {}

    def apply_reviews(rows):
        for row in rows:
            original = {"che_dau_xanh": "che"}.get(row["folder"], row["folder"]).replace("_", "-")
            label = reviews.get(row["path"], {}).get("expectedVendorId", original)
            row["expectedVendorId"] = row["selectedVendorId"] = label
            if label != original:
                row["originalExpectedVendorId"] = original
                row["labelReview"] = reviews[row["path"]]["reason"]
        return rows

    apply_reviews(records)
    destination = ROOT / "be/eval/dataset-manifest.json"
    if destination.exists() and not reset_splits:
        saved = json.loads(destination.read_text(encoding="utf8"))
        previous_files = {(r["path"], r["sha256"]) for r in saved["records"]}
        current_files = {(r["path"], r["sha256"]) for r in records}
        if previous_files != current_files:
            raise RuntimeError("Dataset changed. Review the added/replaced photos and run prepare_dataset.py --reset-splits.")
        apply_reviews(saved["records"])
        destination.write_text(json.dumps(saved, indent=2), encoding="utf8")
        print("Existing group-disjoint dataset splits preserved; label reviews applied.")
        return saved
    previous = ROOT / ".reference/user-dataset-smoke.json"
    known_dev = {x["path"] for x in json.loads(previous.read_text(encoding="utf8"))} if previous.exists() else set()
    known_dev.update(["dataset/goi_kho_bo/1.jpg", "dataset/bot_chien/3.jpg"])
    parents = list(range(len(records)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    fingerprints = [hashes(ROOT / row["path"]) for row in records]
    duplicate_pairs = []
    for i, a in enumerate(records):
        for j in range(i):
            b = records[j]
            ph = (fingerprints[i][0] ^ fingerprints[j][0]).bit_count()
            dh = (fingerprints[i][1] ^ fingerprints[j][1]).bit_count()
            ratio = abs(np.log((a["width"] / a["height"]) / (b["width"] / b["height"])))
            if a["sha256"] == b["sha256"] or (ph <= 8 and dh <= 10 and ratio < 0.16):
                parents[find(i)] = find(j)
                duplicate_pairs.append({"a": a["path"], "b": b["path"], "phashDistance": ph, "dhashDistance": dh})
    groups = defaultdict(list)
    for i, row in enumerate(records):
        groups[find(i)].append(row)
    by_class = defaultdict(list)
    for group in groups.values():
        key = min(row["sha256"] for row in group)[:12]
        for row in group:
            row["group"] = key
            row["warnings"] = ["below-224px"] if min(row["width"], row["height"]) < 224 else []
            row["split"] = "excluded" if row["warnings"] else "reference"
        if len({row["expectedVendorId"] for row in group}) > 1:
            for row in group:
                row["warnings"].append("duplicate-label-conflict")
                row["split"] = "excluded"
        else:
            by_class[group[0]["expectedVendorId"]].append(group)
    for label, class_groups in by_class.items():
        eligible = [g for g in class_groups if any(r["split"] != "excluded" for r in g)]
        dev = [g for g in eligible if any(r["path"] in known_dev for r in g)]
        if not dev:
            dev = sorted(eligible, key=lambda g: g[0]["group"])[:1]
        for group in dev:
            for row in group:
                if row["split"] != "excluded": row["split"] = "development"
        available = sorted((g for g in eligible if g not in dev), key=lambda g: hashlib.sha256(("20261030" + g[0]["group"]).encode()).hexdigest())
        target = max(1, round(sum(len(g) for g in eligible) * 0.2))
        count = 0
        for group in available:
            if count >= target or len(available) <= 1: break
            for row in group:
                if row["split"] != "excluded": row["split"] = "test"
            count += len(group)
            # Always leave at least one reference group in each class.
            available = [g for g in available if g != group]
    output = {"schemaVersion": 1, "seed": 20261030, "encoder": MODEL_ID,
              "encoderRevision": MODEL_REVISION, "records": records, "duplicatePairs": duplicate_pairs}
    destination.write_text(json.dumps(output, indent=2), encoding="utf8")
    for label in sorted(by_class):
        rows = [r for r in records if r["expectedVendorId"] == label]
        print(label, {s: sum(r["split"] == s for r in rows) for s in ["reference", "development", "test", "excluded"]})
    print("Duplicate pairs:", duplicate_pairs)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset-splits", action="store_true")
    prepare(parser.parse_args().reset_splits)
