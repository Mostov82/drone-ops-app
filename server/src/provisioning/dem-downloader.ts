import * as fs from "node:fs";
import * as path from "node:path";
import { fromFile } from "geotiff";
import { resolveMapPaths } from "../map/paths.js";

export const DEM_TILES = [
  "N29_00_E034_00",
  "N29_00_E035_00",
  "N30_00_E034_00",
  "N30_00_E035_00",
  "N31_00_E034_00",
  "N31_00_E035_00",
  "N32_00_E034_00",
  "N32_00_E035_00",
  "N33_00_E034_00",
  "N33_00_E035_00",
];

export interface DemDownloadStatus {
  status: "idle" | "pending" | "downloading" | "done" | "failed" | "offline-missing";
  downloaded: number;
  total: number;
  progress: number; // 0 to 100 progress of current tile
  currentFile: string | null;
  error: string | null;
}

export async function validateDemFile(filePath: string): Promise<boolean> {
  let tiff;
  try {
    tiff = await fromFile(filePath);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    const width = image.getWidth();
    const height = image.getHeight();
    return Boolean(bbox && width > 0 && height > 0);
  } catch (err) {
    console.error(`[dem-downloader] Validation failed for ${path.basename(filePath)}:`, err);
    return false;
  } finally {
    if (tiff) {
      try {
        await tiff.close();
      } catch {
        // ignore
      }
    }
  }
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    await fetch("https://copernicus-dem-30m.s3.amazonaws.com/", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

export class DemDownloaderService {
  private status: DemDownloadStatus = {
    status: "pending",
    downloaded: 0,
    total: DEM_TILES.length,
    progress: 0,
    currentFile: null,
    error: null,
  };

  private abortController: AbortController | null = null;
  private demDir: string;
  private isRunning = false;

  constructor(demDir?: string) {
    this.demDir = demDir ?? resolveMapPaths().demDir;
    fs.mkdirSync(this.demDir, { recursive: true });
  }

  getStatus(): DemDownloadStatus {
    return { ...this.status };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.status.status = "pending";
    this.status.error = null;
    this.abortController = new AbortController();
    this.runDownloadLoop().catch((err) => {
      console.error("[dem-downloader] Loop crashed:", err);
    });
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    if (this.status.status === "downloading" || this.status.status === "pending") {
      this.status.status = "idle";
      this.status.error = "Download aborted.";
    }
  }

  private async scanAndValidateExisting(): Promise<number> {
    let validCount = 0;
    for (const tile of DEM_TILES) {
      const filename = `Copernicus_DSM_COG_10_${tile}_DEM.tif`;
      const filepath = path.join(this.demDir, filename);
      if (fs.existsSync(filepath)) {
        if (await validateDemFile(filepath)) {
          validCount++;
        } else {
          console.warn(`[dem-downloader] Deleting invalid/corrupt tile: ${filename}`);
          try {
            fs.unlinkSync(filepath);
          } catch {}
        }
      }
    }
    return validCount;
  }

  private async runDownloadLoop(): Promise<void> {
    try {
      const initialValid = await this.scanAndValidateExisting();
      this.status.downloaded = initialValid;

      if (initialValid === DEM_TILES.length) {
        this.status.status = "done";
        this.status.progress = 100;
        this.status.currentFile = null;
        this.isRunning = false;
        return;
      }

      console.log("[dem-downloader] Checking connectivity...");
      const online = await checkConnectivity();
      if (!online) {
        this.status.status = "offline-missing";
        this.status.error = "No internet connection. DEM download will resume automatically when connected.";
        this.isRunning = false;
        return;
      }

      this.status.status = "downloading";

      for (let i = 0; i < DEM_TILES.length; i++) {
        if (!this.isRunning || this.abortController?.signal.aborted) break;

        const tile = DEM_TILES[i];
        const filename = `Copernicus_DSM_COG_10_${tile}_DEM.tif`;
        const filepath = path.join(this.demDir, filename);

        // Check if already exists and is valid
        if (fs.existsSync(filepath) && (await validateDemFile(filepath))) {
          continue;
        }

        this.status.currentFile = filename;
        this.status.progress = 0;
        await this.downloadTile(tile);

        // Recheck and update count
        if (fs.existsSync(filepath) && (await validateDemFile(filepath))) {
          this.status.downloaded = await this.scanAndValidateExisting();
        }
      }

      const finalValid = await this.scanAndValidateExisting();
      this.status.downloaded = finalValid;
      if (finalValid === DEM_TILES.length) {
        this.status.status = "done";
        this.status.progress = 100;
        this.status.currentFile = null;
        this.status.error = null;
      } else {
        this.status.status = "failed";
        this.status.error = "Not all DEM tiles could be downloaded.";
      }
    } catch (err: unknown) {
      console.error("[dem-downloader] Download failed:", err);
      this.status.status = "failed";
      this.status.error = err instanceof Error ? err.message : "Download failed.";
    } finally {
      this.isRunning = false;
    }
  }

  private async downloadTile(tile: string): Promise<void> {
    const filename = `Copernicus_DSM_COG_10_${tile}_DEM.tif`;
    const targetPath = path.join(this.demDir, filename);
    const partPath = `${targetPath}.part`;
    const folder = `Copernicus_DSM_COG_10_${tile}_DEM`;
    const url = `https://copernicus-dem-30m.s3.amazonaws.com/${folder}/${filename}`;

    let startByte = 0;
    if (fs.existsSync(partPath)) {
      startByte = fs.statSync(partPath).size;
    }

    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers["Range"] = `bytes=${startByte}-`;
    }

    const signal = this.abortController?.signal;
    const response = await fetch(url, { headers, signal });

    if (response.status === 416) {
      // Range not satisfiable, start over
      console.warn(`[dem-downloader] Range 416 for ${filename}, restarting download from 0.`);
      try {
        fs.unlinkSync(partPath);
      } catch {}
      await this.downloadTile(tile);
      return;
    }

    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to fetch tile: ${response.statusText} (${response.status})`);
    }

    const isPartial = response.status === 206;
    const totalBytesHeader = response.headers.get("content-length");
    const totalBytesToDownload = totalBytesHeader ? parseInt(totalBytesHeader, 10) : 0;
    const totalFileSize = isPartial ? startByte + totalBytesToDownload : totalBytesToDownload;

    const fileStream = fs.createWriteStream(partPath, { flags: isPartial ? "a" : "w" });

    if (!response.body) {
      fileStream.close();
      throw new Error("Response body is empty.");
    }

    const reader = response.body.getReader();
    let downloadedBytes = isPartial ? startByte : 0;

    try {
      while (true) {
        if (signal?.aborted) {
          throw new Error("Aborted");
        }
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        downloadedBytes += value.length;

        if (totalFileSize > 0) {
          this.status.progress = Math.round((downloadedBytes / totalFileSize) * 100);
        }
      }
    } finally {
      fileStream.end();
      await new Promise<void>((resolve) => {
        fileStream.on("finish", () => resolve());
      });
    }

    // Validate the temporary file
    console.log(`[dem-downloader] Validating completed tile ${filename}...`);
    const isValid = await validateDemFile(partPath);
    if (isValid) {
      fs.renameSync(partPath, targetPath);
      console.log(`[dem-downloader] Tile ${filename} downloaded and activated.`);
    } else {
      try {
        fs.unlinkSync(partPath);
      } catch {}
      throw new Error(`Downloaded file ${filename} was corrupt or invalid.`);
    }
  }
}

// Global instance
export const demDownloader = new DemDownloaderService();
