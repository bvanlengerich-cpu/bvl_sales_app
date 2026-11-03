import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { extractBusinessCardFields } from './business-card-fields.mjs';

export const MAX_CARD_IMAGE_BYTES = 250 * 1024;
const MAX_WORKER_RESPONSE = 1024 * 1024;

export class BusinessCardOcrError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const unavailable = () => new BusinessCardOcrError(503, 'Die Server-Texterkennung ist noch nicht verfügbar. Bitte später erneut versuchen.');
const aborted = () => new BusinessCardOcrError(499, 'Texterkennung abgebrochen.');

export async function validateCardImage(image) {
  if (!Buffer.isBuffer(image) || !image.length || image.length > MAX_CARD_IMAGE_BYTES) {
    throw new BusinessCardOcrError(413, 'Bitte das Foto zuerst automatisch auf höchstens 250 KB verkleinern.');
  }
  if (image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
    throw new BusinessCardOcrError(415, 'Bitte ein JPEG-Foto verwenden.');
  }
  try {
    const metadata = await sharp(image, { limitInputPixels: 1600 * 1600, failOn: 'warning' }).metadata();
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || metadata.pages > 1) throw new Error('image');
    if (metadata.width > 1600 || metadata.height > 1600) {
      throw new BusinessCardOcrError(413, 'Bitte das Foto zuerst automatisch auf höchstens 1600 Pixel verkleinern.');
    }
  } catch (error) {
    if (error instanceof BusinessCardOcrError) throw error;
    throw new BusinessCardOcrError(415, 'Das Foto konnte nicht gelesen werden. Bitte eine neue Aufnahme verwenden.');
  }
}

function resultFromWorker(value) {
  if (!Array.isArray(value.lines) || value.lines.length > 400) throw new Error('invalid worker result');
  const lines = value.lines.map(line => {
    if (!line || typeof line.text !== 'string' || line.text.length > 1000 ||
        !Number.isFinite(line.score) || line.score < 0 || line.score > 1 ||
        !Array.isArray(line.box) || line.box.length !== 4 || line.box.some(point =>
          !Array.isArray(point) || point.length !== 2 || point.some(coordinate => !Number.isFinite(coordinate) || coordinate < 0 || coordinate > 64000))) {
      throw new Error('invalid worker line');
    }
    return { text: line.text, score: line.score, box: line.box };
  });
  const { fields, warnings } = extractBusinessCardFields(lines);
  return {
    fields, warnings,
    text: lines.map(line => line.text).join('\n').slice(0, 40000),
    engine: 'RapidOCR / PP-OCRv5 Latin / ONNX CPU',
    elapsedMs: Number.isFinite(value.elapsedMs) ? Math.max(0, Math.round(value.elapsedMs)) : null
  };
}

/** One lazily started local CPU worker; never calls an external OCR service. */
export function createBusinessCardRecognizer({
  python = process.env.OCR_PYTHON || '/opt/ocr/bin/python',
  modelsDir = process.env.OCR_MODEL_DIR || '/app/ocr-models',
  workerPath = resolve(import.meta.dirname, '../ocr/worker.py'),
  timeoutMs = 60000, maxQueued = 3, idleMs = 60000, spawnProcess = spawn
} = {}) {
  let child = null, active = null, closed = false, idleTimer;
  const queue = [];

  function settle(job, error, value) {
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.onAbort);
    if (error) job.reject(error); else job.resolve(value);
  }

  function stopWorker() {
    clearTimeout(idleTimer);
    const process = child;
    child = null;
    try { process?.stdin?.end(); } catch { /* A terminated worker has no input. */ }
    try { process?.kill(); } catch { /* Already stopped. */ }
  }

  function failWorker(error, rejectQueued = true) {
    const job = active;
    active = null;
    stopWorker();
    if (job) settle(job, error);
    if (rejectQueued) for (const waiting of queue.splice(0)) settle(waiting, error);
    queueMicrotask(pump);
  }

  function finish(error, value) {
    const job = active;
    if (!job) return;
    active = null;
    settle(job, error, value);
    pump();
  }

  function startWorker() {
    let process;
    try {
      process = spawnProcess(python, ['-u', workerPath, '--models-dir', resolve(modelsDir), '--threads', '2', '--stdio'], {
        stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        env: { ...globalThis.process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' }
      });
    } catch { throw unavailable(); }
    child = process;
    let pendingOutput = '';
    const streamFailed = () => { if (child === process) failWorker(unavailable()); };
    process.stdin.on('error', streamFailed);
    process.stdout.on('error', streamFailed);
    process.stderr.on('error', streamFailed);
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', chunk => {
      if (child !== process) return;
      pendingOutput += chunk;
      if (Buffer.byteLength(pendingOutput) > MAX_WORKER_RESPONSE) {
        failWorker(new BusinessCardOcrError(502, 'Die Texterkennung hat eine ungültige Antwort geliefert.')); return;
      }
      let end;
      while ((end = pendingOutput.indexOf('\n')) >= 0 && child === process) {
        const raw = pendingOutput.slice(0, end); pendingOutput = pendingOutput.slice(end + 1);
        let message;
        try { message = JSON.parse(raw); } catch {
          failWorker(new BusinessCardOcrError(502, 'Die Texterkennung hat eine ungültige Antwort geliefert.')); return;
        }
        if (!message || message.ok !== true) {
          if (!message?.id || ['models_missing', 'engine_initialization'].includes(message.error)) { failWorker(unavailable()); return; }
          if (message.id !== active?.id) { failWorker(unavailable()); return; }
          finish(new BusinessCardOcrError(422, 'Das Foto konnte nicht ausgewertet werden. Bitte eine schärfere Aufnahme verwenden.'));
          continue;
        }
        if (message.id !== active?.id) { failWorker(unavailable()); return; }
        try { finish(null, resultFromWorker(message)); }
        catch { failWorker(new BusinessCardOcrError(502, 'Die Texterkennung hat eine ungültige Antwort geliefert.')); return; }
      }
    });
    // Drain without collecting or logging image data or recognized text.
    process.stderr.on('data', () => {});
    process.on('error', () => { if (child === process) failWorker(unavailable()); });
    process.on('exit', () => { if (child === process) failWorker(unavailable()); });
    return process;
  }

  function pump() {
    if (closed || active) return;
    if (!queue.length) {
      clearTimeout(idleTimer);
      if (child) { idleTimer = setTimeout(() => { if (!active && !queue.length) stopWorker(); }, idleMs); idleTimer.unref?.(); }
      return;
    }
    clearTimeout(idleTimer);
    active = queue.shift();
    const job = active;
    job.timer = setTimeout(() => failWorker(new BusinessCardOcrError(504, 'Die Texterkennung hat zu lange gedauert. Bitte erneut versuchen.'), false), timeoutMs);
    job.timer.unref?.();
    let process;
    try { process = child || startWorker(); } catch (error) { failWorker(error); return; }
    try {
      process.stdin.write(`${JSON.stringify({ id: job.id, imageBase64: job.image.toString('base64') })}\n`, error => {
        if (error && child === process && active?.id === job.id) failWorker(unavailable());
      });
    } catch { failWorker(unavailable()); }
  }

  function recognize(image, { signal } = {}) {
    if (closed) return Promise.reject(unavailable());
    if (signal?.aborted) return Promise.reject(aborted());
    if (!Buffer.isBuffer(image) || !image.length || image.length > MAX_CARD_IMAGE_BYTES) return Promise.reject(new BusinessCardOcrError(413, 'Foto zu groß.'));
    if (active && queue.length >= maxQueued) return Promise.reject(new BusinessCardOcrError(429, 'Die Texterkennung ist gerade ausgelastet. Bitte kurz warten und erneut versuchen.'));
    return new Promise((resolve, reject) => {
      const job = { id: randomUUID(), image: Buffer.from(image), signal, resolve, reject };
      job.onAbort = () => {
        if (active === job) { failWorker(aborted(), false); return; }
        const index = queue.indexOf(job);
        if (index >= 0) { queue.splice(index, 1); settle(job, aborted()); }
      };
      signal?.addEventListener('abort', job.onAbort, { once: true });
      queue.push(job);
      pump();
    });
  }

  function close() {
    closed = true;
    failWorker(unavailable());
  }

  return { recognize, close };
}
