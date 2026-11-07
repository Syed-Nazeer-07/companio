const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { app } = require('electron');

const AVAILABLE_MODELS = {
  'llama3.2-1b': {
    id: 'llama3.2-1b',
    name: 'Llama 3.2 1B Instruct (Recommended)',
    desc: 'Smartest ultra-light model by Meta. Excellent conversational intelligence & intent reasoning.',
    sizeBytes: 808 * 1024 * 1024,
    sizeDisplay: '808 MB',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf'
  },
  'smollm2-360m': {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct (Instant Download)',
    desc: 'Ultra-lightweight model. Downloads in under 30 seconds with near-zero RAM footprint.',
    sizeBytes: 229 * 1024 * 1024,
    sizeDisplay: '229 MB',
    filename: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf'
  },
  'qwen2.5-0.5b': {
    id: 'qwen2.5-0.5b',
    name: 'Qwen 2.5 0.5B Instruct (Fast & Sharp)',
    desc: 'Excellent reasoning and multilingual capabilities in an ultra-compact footprint.',
    sizeBytes: 398 * 1024 * 1024,
    sizeDisplay: '398 MB',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf'
  }
};

class ModelDownloader {
  constructor() {
    this.activeRequest = null;
    this.currentDownload = null;
  }

  getModelsDir() {
    const dir = path.join(app.getPath('userData'), 'models');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getModelStatus(modelId) {
    const meta = AVAILABLE_MODELS[modelId] || AVAILABLE_MODELS['llama3.2-1b'];
    const filePath = path.join(this.getModelsDir(), meta.filename);
    const exists = fs.existsSync(filePath);
    let size = 0;
    if (exists) {
      try {
        size = fs.statSync(filePath).size;
      } catch (e) {}
    }
    return {
      id: meta.id,
      name: meta.name,
      filename: meta.filename,
      filePath,
      installed: exists && size > 10 * 1024 * 1024,
      fileSize: size,
      sizeDisplay: meta.sizeDisplay,
      isDownloading: this.currentDownload?.modelId === modelId
    };
  }

  listModels() {
    return Object.keys(AVAILABLE_MODELS).map((id) => this.getModelStatus(id));
  }

  downloadModel(modelId, onProgress) {
    if (this.currentDownload) {
      return Promise.reject(new Error('A download is already in progress.'));
    }

    const meta = AVAILABLE_MODELS[modelId];
    if (!meta) {
      return Promise.reject(new Error(`Unknown model: ${modelId}`));
    }

    const targetPath = path.join(this.getModelsDir(), meta.filename);
    const tempPath = targetPath + '.download';

    return new Promise((resolve, reject) => {
      this.currentDownload = { modelId, progress: 0 };
      const fileStream = fs.createWriteStream(tempPath);
      let receivedBytes = 0;
      let totalBytes = meta.sizeBytes;
      let startTime = Date.now();

      const downloadFromUrl = (url) => {
        const client = url.startsWith('https') ? https : http;
        this.activeRequest = client.get(url, { headers: { 'User-Agent': 'Companio-Desktop/1.0' } }, (response) => {
          // Handle 301, 302, 307 redirects (common on Hugging Face / GitHub)
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            return downloadFromUrl(response.headers.location);
          }

          if (response.statusCode !== 200) {
            fileStream.close();
            try { fs.unlinkSync(tempPath); } catch (e) {}
            this.currentDownload = null;
            return reject(new Error(`Server returned HTTP ${response.statusCode}: ${response.statusMessage}`));
          }

          const headerLen = parseInt(response.headers['content-length'], 10);
          if (!isNaN(headerLen) && headerLen > 0) {
            totalBytes = headerLen;
          }

          response.on('data', (chunk) => {
            receivedBytes += chunk.length;
            fileStream.write(chunk);

            const elapsedSec = (Date.now() - startTime) / 1000;
            const speedBytesPerSec = elapsedSec > 0 ? (receivedBytes / elapsedSec) : 0;
            const speedMbps = ((speedBytesPerSec * 8) / (1024 * 1024)).toFixed(1);
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));

            if (onProgress) {
              onProgress({
                modelId,
                percent,
                receivedBytes,
                totalBytes,
                speedMbps,
                status: 'downloading'
              });
            }
          });

          response.on('end', () => {
            fileStream.end(async () => {
              try {
                if (fs.existsSync(targetPath)) {
                  fs.unlinkSync(targetPath);
                }
                fs.renameSync(tempPath, targetPath);
                this.currentDownload = null;
                this.activeRequest = null;

                if (onProgress) {
                  onProgress({
                    modelId,
                    percent: 100,
                    receivedBytes: totalBytes,
                    totalBytes,
                    speedMbps: '0',
                    status: 'completed'
                  });
                }

                resolve({
                  success: true,
                  filePath: targetPath,
                  modelId,
                  message: `Model ${meta.name} successfully installed!`
                });
              } catch (err) {
                this.currentDownload = null;
                reject(err);
              }
            });
          });

          response.on('error', (err) => {
            fileStream.close();
            try { fs.unlinkSync(tempPath); } catch (e) {}
            this.currentDownload = null;
            this.activeRequest = null;
            reject(err);
          });
        });

        this.activeRequest.on('error', (err) => {
          fileStream.close();
          try { fs.unlinkSync(tempPath); } catch (e) {}
          this.currentDownload = null;
          this.activeRequest = null;
          reject(err);
        });
      };

      downloadFromUrl(meta.url);
    });
  }

  cancelDownload() {
    if (this.activeRequest) {
      this.activeRequest.destroy();
      this.activeRequest = null;
    }
    if (this.currentDownload) {
      const meta = AVAILABLE_MODELS[this.currentDownload.modelId];
      if (meta) {
        const tempPath = path.join(this.getModelsDir(), meta.filename + '.download');
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
      this.currentDownload = null;
    }
    return { success: true, message: 'Download cancelled' };
  }
}

module.exports = new ModelDownloader();
