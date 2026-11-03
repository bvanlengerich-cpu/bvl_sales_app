# Free, self-hosted business-card OCR

This worker is used by the Sales App's authenticated card-recognition endpoint.
The production Dockerfile installs Python and the pinned CPU dependencies and
downloads the verified public models at build time. No cloud OCR API, API key,
additional account or per-request charge is used. The existing VPS supplies
the CPU and memory; its normal hosting costs still apply.

The Node server starts the worker lazily, uses one request at a time with a
bounded queue, and releases the process after a minute of inactivity. It exposes
no extra public port. `OCR_PYTHON` defaults to `/opt/ocr/bin/python` and
`OCR_MODEL_DIR` to `/app/ocr-models`; these paths are set by the Dockerfile.

The Python runtime needs Python 3.11 or newer. Install the pinned dependencies
in an isolated environment:

```powershell
python -m pip install -r ocr/requirements.txt
python ocr/download-models.py --models-dir data/ocr-evaluation/models
python ocr/worker.py --models-dir data/ocr-evaluation/models --image path/to/test-card.jpg
```

The download tool verifies SHA-256 hashes from RapidOCR's versioned model
manifest. Inference accepts only those local model paths and does not download
models. Two CPU threads are used by default; `--threads 1` reduces parallelism.
The Latin recognizer supports German and other Latin-script languages. The
optional 180-degree text-line classifier is downloaded but disabled by default;
enable it with `--classify-rotation` when evaluating rotated cards.

`--stdio` keeps a worker alive for repeated requests. Each request contains an
identifier and Base64 image bytes, never a URL or a server-side filename. Each
response is one JSON line. It contains text regions with confidence scores and
four-point bounding boxes, plus image dimensions and elapsed inference time.
It does not claim that recognized text is already correctly assigned to contact
fields; that requires the separate contact-field extraction and review stage.

The standalone CLI can decode up to 25 MiB / 64 megapixels. The app endpoint is
more restrictive: it accepts only prepared JPEGs up to 250 KiB and 1600 pixels,
requires an authenticated internal employee or admin, and enforces the existing
Origin and CSRF checks. Images are decoded in memory and are not written to disk
by the recognition worker. Recognition results are returned to the review dialog
without saving contact changes, and are not emitted as diagnostic logs.

The separate field extractor uses line positions, confidence scores and bounded
phone-number sections. Ambiguous fields stay empty and generate review hints.
This is not a semantic vision-language model and is not a guarantee for arbitrary
real business-card layouts. Test representative cards and review all suggestions.

Sources: [RapidOCR](https://github.com/RapidAI/RapidOCR),
[versioned model manifest](https://github.com/RapidAI/RapidOCR/blob/v3.10.0/python/rapidocr/default_models.yaml),
[ONNX Runtime](https://pypi.org/project/onnxruntime/1.31.0/).
RapidOCR and the PaddleOCR-derived models are distributed under Apache-2.0;
their upstream licenses and the installed packages' notices apply. Model
licensing details: https://rapidai.github.io/RapidOCRDocs/main/en/model_licenses/
