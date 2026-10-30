import unittest
import numpy as np
from retrieval import ReferenceIndex


def record(name, group, label):
    return {"id": name, "group": group, "expectedVendorId": label, "path": name, "sha256": "0" * 64}


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.records = [record("a", "same-photo", "a"), record("a-crop", "same-photo", "a"),
                        record("b", "other-a", "a"), record("c", "other-b", "b")]
        self.vectors = np.array([[1.0000002, 0], [1, 0], [.8, .6], [0, 1]], dtype=np.float32)
        self.index = ReferenceIndex(self.vectors, self.records)

    def test_cosines_are_bounded_for_identical_float32_vectors(self):
        candidate = self.index.rank(np.array([1, 0], dtype=np.float32))[0]
        self.assertLessEqual(candidate["nearestSimilarity"], 1)
        self.assertLessEqual(candidate["similarity"], 1)

    def test_a_crop_cannot_count_as_a_second_independent_reference(self):
        candidate = self.index.rank(np.array([1, 0], dtype=np.float32))[0]
        self.assertEqual(candidate["referenceIds"], ["a", "b"])

    def test_entire_query_group_is_excluded(self):
        ranked = self.index.rank(np.array([1, 0], dtype=np.float32), excluded_group="same-photo")
        identifiers = [identifier for row in ranked for identifier in row["referenceIds"]]
        self.assertNotIn("a", identifiers)
        self.assertNotIn("a-crop", identifiers)


if __name__ == "__main__":
    unittest.main()
