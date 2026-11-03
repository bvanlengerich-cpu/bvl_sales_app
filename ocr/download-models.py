"""Download the public, pinned CPU OCR models once; no account or API key."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import sys
import urllib.request


BASE = "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx"
MODELS = (
    ("det.onnx", f"{BASE}/PP-OCRv5/det/ch_PP-OCRv5_det_mobile.onnx", "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae"),
    ("rec-latin.onnx", f"{BASE}/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile.onnx", "b20bd37c168a570f583afbc8cd7925603890efbcdc000a59e22c269d160b5f5a"),
    ("cls.onnx", f"{BASE}/PP-OCRv4/cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx", "e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c"),
)
MAX_MODEL_BYTES = 64 * 1024 * 1024


def checksum(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def download(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name, url, expected in MODELS:
        target = directory / name
        if target.is_file() and checksum(target) == expected:
            print(f"{name}: verified", file=sys.stderr)
            continue
        temporary = directory / f".{name}.partial"
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "BvL-Sales-OCR-Setup/1.0"})
            total = 0
            digest = hashlib.sha256()
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as destination:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_MODEL_BYTES:
                        raise RuntimeError("Model download exceeded its size limit")
                    digest.update(chunk)
                    destination.write(chunk)
            if digest.hexdigest() != expected:
                raise RuntimeError(f"Model integrity check failed: {name}")
            temporary.replace(target)
            print(f"{name}: downloaded and verified ({total} bytes)", file=sys.stderr)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, required=True)
    args = parser.parse_args()
    download(args.models_dir.resolve())
