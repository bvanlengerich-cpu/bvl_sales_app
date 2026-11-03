"""Local CPU OCR trial. Inference uses local models and never calls an API.

CLI: worker.py --models-dir PATH --image PATH
Persistent: worker.py --models-dir PATH --stdio
Stdio input is one JSON object per line: {"id":"...","imageBase64":"..."}.
The service protocol deliberately accepts image bytes, never remote URLs or paths.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import contextlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import time


MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_PIXELS = 64_000_000
MAX_REQUEST_BYTES = ((MAX_IMAGE_BYTES + 2) // 3) * 4 + 1024
ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")


class InputError(Exception):
    """A bounded, non-sensitive error that can be returned to the caller."""


def bounded_image(data: bytes):
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise InputError("image_size")
    from PIL import Image, ImageOps
    import numpy as np

    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.width < 1 or source.height < 1 or source.width * source.height > MAX_PIXELS:
                raise InputError("image_dimensions")
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise InputError("image_format")
            # Apply orientation before dropping metadata. Keep alpha images
            # legible by compositing them onto a white business-card background.
            oriented = ImageOps.exif_transpose(source)
            if oriented.mode in {"RGBA", "LA"} or "transparency" in oriented.info:
                rgba = oriented.convert("RGBA")
                rgb = Image.new("RGB", rgba.size, "white")
                rgb.paste(rgba, mask=rgba.getchannel("A"))
            else:
                rgb = oriented.convert("RGB")
            return np.asarray(rgb).copy()
    except InputError:
        raise
    except Exception as error:
        raise InputError("image_decode") from error


class CpuOcr:
    def __init__(self, models_dir: Path, threads: int = 2, classify_rotation: bool = False):
        directory = models_dir.resolve()
        paths = {name: directory / filename for name, filename in {
            "det": "det.onnx", "rec": "rec-latin.onnx", "cls": "cls.onnx"
        }.items()}
        for name in ("det", "rec", *( ("cls",) if classify_rotation else () )):
            if not paths[name].is_file():
                raise InputError("models_missing")
        # Cap native parallelism before importing numerical runtimes. This
        # process shares a VPS with the Sales App and other applications.
        threads = min(2, max(1, threads))
        for key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
            os.environ[key] = str(threads)
        with contextlib.redirect_stdout(sys.stderr):
            import cv2
            from rapidocr import RapidOCR, EngineType, ModelType, OCRVersion, LangRec
            cv2.setNumThreads(threads)
            self.engine = RapidOCR(params={
                "Global.log_level": "error",
                "Global.use_det": True,
                "Global.use_rec": True,
                "Global.use_cls": classify_rotation,
                "Global.return_word_box": True,
                "Global.text_score": 0.45,
                "Global.max_side_len": 2200,
                "Global.model_root_dir": str(directory),
                "Det.engine_type": EngineType.ONNXRUNTIME,
                "Det.ocr_version": OCRVersion.PPOCRV5,
                "Det.model_type": ModelType.MOBILE,
                "Det.model_path": str(paths["det"]),
                "Det.limit_side_len": 1280,
                "Det.limit_type": "max",
                "Rec.engine_type": EngineType.ONNXRUNTIME,
                "Rec.ocr_version": OCRVersion.PPOCRV5,
                "Rec.model_type": ModelType.MOBILE,
                "Rec.lang_type": LangRec.LATIN,
                "Rec.model_path": str(paths["rec"]),
                "Cls.model_path": str(paths["cls"]),
                "EngineConfig.onnxruntime.intra_op_num_threads": threads,
                "EngineConfig.onnxruntime.inter_op_num_threads": 1,
                "EngineConfig.onnxruntime.use_cuda": False,
                "EngineConfig.onnxruntime.use_dml": False,
            })

    def recognize(self, data: bytes) -> dict:
        started = time.perf_counter()
        rgb = bounded_image(data)
        height, width = rgb.shape[:2]
        # RapidOCR's ndarray input uses OpenCV BGR channel order.
        with contextlib.redirect_stdout(sys.stderr):
            result = self.engine(rgb[:, :, ::-1].copy())
        boxes = getattr(result, "boxes", None)
        texts = getattr(result, "txts", None)
        scores = getattr(result, "scores", None)
        lines = []
        if boxes is not None and texts is not None and scores is not None:
            for text, score, box in zip(texts, scores, boxes):
                score = float(score)
                if not isinstance(text, str) or not text.strip() or not math.isfinite(score):
                    continue
                points = [[round(max(0, min(width, float(point[0]))), 2),
                           round(max(0, min(height, float(point[1]))), 2)] for point in box]
                if len(points) != 4 or not all(math.isfinite(coordinate) for point in points for coordinate in point):
                    continue
                lines.append({"text": text.strip()[:1000], "score": round(max(0, min(1, score)), 6), "box": points})
                if len(lines) >= 400:
                    break
        return {"engine": "RapidOCR 3.10.0 / PP-OCRv5 Latin / ONNX CPU", "width": width, "height": height,
                "elapsedMs": round((time.perf_counter() - started) * 1000), "lines": lines}


def write_json(value: dict) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def request_image(value: object) -> tuple[str, bytes]:
    if not isinstance(value, dict) or set(value) - {"id", "imageBase64"}:
        raise InputError("invalid_request")
    request_id = value.get("id", "")
    encoded = value.get("imageBase64")
    if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
        raise InputError("invalid_id")
    if not isinstance(encoded, str) or len(encoded) > MAX_REQUEST_BYTES:
        raise InputError("image_size")
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise InputError("image_base64") from error
    if not decoded or len(decoded) > MAX_IMAGE_BYTES:
        raise InputError("image_size")
    return request_id, decoded


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--image", type=Path)
    mode.add_argument("--stdio", action="store_true")
    parser.add_argument("--threads", type=int, choices=(1, 2), default=2)
    parser.add_argument("--classify-rotation", action="store_true")
    args = parser.parse_args()
    try:
        engine = CpuOcr(args.models_dir, args.threads, args.classify_rotation)
    except Exception as error:
        write_json({"ok": False, "error": str(error) if isinstance(error, InputError) else "engine_initialization"})
        print(f"OCR initialization failed ({type(error).__name__}).", file=sys.stderr)
        return 1
    if args.image is not None:
        try:
            with args.image.open("rb") as source:
                content = source.read(MAX_IMAGE_BYTES + 1)
            write_json({"ok": True, **engine.recognize(content)})
            return 0
        except Exception as error:
            write_json({"ok": False, "error": str(error) if isinstance(error, InputError) else "inference_failed"})
            return 1
    while True:
        raw = sys.stdin.buffer.readline(MAX_REQUEST_BYTES + 1)
        if not raw:
            return 0
        if len(raw) > MAX_REQUEST_BYTES:
            write_json({"ok": False, "error": "request_size"})
            return 1
        request_id = None
        try:
            request_id, image = request_image(json.loads(raw))
            write_json({"id": request_id, "ok": True, **engine.recognize(image)})
        except Exception as error:
            write_json({"id": request_id, "ok": False, "error": str(error) if isinstance(error, InputError) else "invalid_request"})


if __name__ == "__main__":
    raise SystemExit(main())
