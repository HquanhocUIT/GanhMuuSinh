"""Frozen SigLIP 2 image features. No paid API and no weight fine-tuning."""

import os
import json
from pathlib import Path
from config import ROOT, MODEL_ID, MODEL_REVISION
os.environ.setdefault("HF_HOME", str(ROOT / ".reference" / "hf-vision"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

import numpy as np
from PIL import Image, ImageOps
import timm
import torch
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file

class FoodEncoder:
    def __init__(self, allow_download=False):
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        config_path = hf_hub_download(MODEL_ID, "config.json", revision=MODEL_REVISION,
                                      local_files_only=not allow_download)
        weights_path = hf_hub_download(MODEL_ID, "model.safetensors", revision=MODEL_REVISION,
                                       local_files_only=not allow_download)
        config = json.loads(Path(config_path).read_text())
        # Meta construction + safetensors assignment avoids keeping two full
        # weight copies in RAM while Ollama occupies the GPU and host memory.
        self.model = timm.create_model(config["architecture"], pretrained=False,
                                      num_classes=0, global_pool=config["global_pool"],
                                      pretrained_cfg=config["pretrained_cfg"], device="meta")
        self.model.load_state_dict(load_file(weights_path), assign=True)
        self.model.eval()
        self.transform = timm.data.create_transform(
            **timm.data.resolve_model_data_config(self.model), is_training=False
        )

    def encode(self, images):
        # Average full-frame and standard model views. Labels and file names are
        # never inputs to the encoder, and the model weights remain frozen.
        batch = []
        for image in images:
            rgb = ImageOps.exif_transpose(image).convert("RGB")
            square = ImageOps.pad(rgb, (max(rgb.size), max(rgb.size)), color=(255, 255, 255))
            batch.extend([self.transform(rgb), self.transform(square)])
        with torch.inference_mode():
            vectors = self.model(torch.stack(batch))
            vectors = torch.nn.functional.normalize(vectors, dim=-1)
            vectors = vectors.reshape(len(images), 2, -1).mean(dim=1)
            vectors = torch.nn.functional.normalize(vectors, dim=-1)
        return vectors.numpy().astype(np.float32)
