import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { Logger } from '../utils/logger.js';

export interface StoredFile {
  filename: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  download_url: string;
  stored_at: string;
}

export class StorageService {
  private localDir: string;
  private baseUrl: string;

  constructor() {
    this.localDir = process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), 'data', 'storage');
    this.baseUrl = process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/+$/, '') : '';

    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }
  }

  /**
   * Save uploaded buffer or stream to storage
   */
  public async saveBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string = 'application/octet-stream'
  ): Promise<StoredFile> {
    const ext = path.extname(originalName) || '.bin';
    const hash = crypto.randomBytes(8).toString('hex');
    const filename = `${Date.now()}_${hash}${ext}`;
    const filePath = path.join(this.localDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const stored: StoredFile = {
      filename,
      original_name: originalName,
      size_bytes: buffer.length,
      mime_type: mimeType,
      download_url: `${this.baseUrl}/api/v1/files/${filename}`,
      stored_at: new Date().toISOString()
    };

    Logger.info(`File stored successfully: ${filename} (${buffer.length} bytes)`, {
      filename,
      size_bytes: buffer.length
    });

    return stored;
  }

  /**
   * Download a remote URL and persist to storage (Integration Standard 7: Inputs accepted as an upload or URL)
   */
  public async saveFromUrl(url: string): Promise<StoredFile> {
    Logger.info(`Downloading input file from URL: ${url}`);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const buffer = Buffer.from(response.data);
    const originalName = path.basename(new URL(url).pathname) || 'remote_asset.png';
    const mimeType = (response.headers['content-type'] as string) || 'application/octet-stream';

    return this.saveBuffer(buffer, originalName, mimeType);
  }

  /**
   * Retrieve file path on disk
   */
  public getFilePath(filename: string): string | null {
    // Prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(this.localDir, safeName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * List all stored files
   */
  public listFiles(): StoredFile[] {
    if (!fs.existsSync(this.localDir)) return [];
    const files = fs.readdirSync(this.localDir);
    return files
      .map((filename: string) => {
        const filePath = path.join(this.localDir, filename);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) return null;
          return {
            filename,
            original_name: filename,
            size_bytes: stats.size,
            mime_type: 'application/octet-stream',
            download_url: `${this.baseUrl}/api/v1/files/${filename}`,
            stored_at: stats.mtime.toISOString()
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as StoredFile[];
  }
}

export const globalStorageService = new StorageService();
