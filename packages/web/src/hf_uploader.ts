import * as hub from "@huggingface/hub";
import type { RepoDesignation } from "@huggingface/hub";
import type { ContentSource } from "@huggingface/hub";

type FileArray = Array<URL | File | { path: string; content: ContentSource }>;
/**
 * Uploads a leRobot dataset to huggingface
 */

export class LeRobotHFUploader extends EventTarget {
  private _repoDesignation: RepoDesignation;
  private _uploaded: boolean;
  private _created_repo: boolean;

  constructor(username: string, repoName: string) {
    super();
    this._repoDesignation = {
      name: `${username}/${repoName}`,
      type: "dataset",
    };

    this._uploaded = false;
    this._created_repo = false;
  }

  /**
   * Returns whether the repository has been successfully created
   */
  get createdRepo(): boolean {
    return this._created_repo;
  }

  get uploaded(): boolean {
    return this._uploaded;
  }

  /**
   * Uploads the dataset to huggingface
   *
   * A referenceId is used to be able to track progress of the upload,
   * this provides a progressEvent from huggingface.js (see : https://github.com/huggingface/huggingface.js/blob/main/packages/hub/README.md#usage)
   *
   * both this and huggingface.js have pretty bad documentation, some exploration will be required (sorry!, I have university, and work and I already feel guilty procastinating those to to write this)
   *
   * @param dataset The dataset to upload
   * @param accessToken The access token for huggingface
   * @param referenceId The reference id for the upload, to track it (optional)
   */
  async createRepoAndUploadFiles(
    files: FileArray,
    accessToken: string,
    referenceId: string = "",
    privateRepo: boolean = false
  ) {
    // Try to create repo; if it already exists (409), continue and upload
    try {
      await hub.createRepo({
        repo: this._repoDesignation,
        accessToken: accessToken,
        license: "mit",
        private: privateRepo,
      });
      this._created_repo = true;
      this.dispatchEvent(
        new CustomEvent("repoCreated", { detail: this._repoDesignation })
      );
    } catch (error: any) {
      const message = (error && (error.message || `${error}`)) as string;
      const isConflict =
        message?.includes("409") ||
        message?.toLowerCase()?.includes("already created") ||
        message?.toLowerCase()?.includes("already exists");
      if (!isConflict) {
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
        throw error;
      }
      // Repo exists: proceed as created
      this._created_repo = true;
      this.dispatchEvent(
        new CustomEvent("repoCreated", { detail: this._repoDesignation })
      );
    }

    try {
      await this.uploadFilesWithProgress(files, accessToken, referenceId);
      this._uploaded = true;
      this.dispatchEvent(
        new CustomEvent("finished", { detail: this._repoDesignation })
      );
    } catch (error) {
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
      throw error;
    }
  }

  /**
   * Uploads files to huggingface with progress events
   *
   * @param files The files to upload
   * @param accessToken The access token for huggingface
   * @param referenceId The reference id for the upload, to track it (optional)
   */
  async uploadFilesWithProgress(
    files: FileArray,
    accessToken: string,
    referenceId: string = ""
  ) {
    // Pre-compute total bytes (best-effort) for aggregate progress
    const getSize = (f: any): number => {
      try {
        if (f instanceof Blob) return f.size;
        if (f && typeof f === "object") {
          if (f.content instanceof Blob) return (f.content as Blob).size;
          if (f instanceof File) return f.size;
        }
      } catch (_) {}
      return 0;
    };
    const getKey = (f: any): string => {
      try {
        if (f && typeof f === "object") {
          if (typeof (f as any).path === "string") return (f as any).path;
          if (typeof (f as any).name === "string") return (f as any).name;
        }
      } catch (_) {}
      return "";
    };

    const totalBytes = (files as any[]).reduce(
      (sum: number, f: any) => sum + getSize(f),
      0
    );
    const loadedByKey = new Map<string, number>();

    for await (const progressEvent of hub.uploadFilesWithProgress({
      repo: this._repoDesignation,
      accessToken: accessToken,
      files: files,
    })) {
      const ev: any = progressEvent as any;
      const fileObj: any = ev.file;
      const key = getKey(fileObj);
      const loaded = typeof ev.loaded === "number" ? ev.loaded : 0;
      if (key) {
        loadedByKey.set(key, loaded);
      }
      const aggregateLoaded = Array.from(loadedByKey.values()).reduce(
        (a, b) => a + b,
        0
      );
      const aggregateProgress =
        totalBytes > 0 ? aggregateLoaded / totalBytes : 0;

      this.dispatchEvent(
        new CustomEvent("progress", {
          detail: {
            progressEvent,
            repoDesignation: this._repoDesignation,
            referenceId,
            aggregate: {
              loaded: aggregateLoaded,
              total: totalBytes,
              progress: aggregateProgress,
            },
          },
        })
      );
    }
  }
}
