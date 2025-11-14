import * as hub from "@huggingface/hub";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

type FileArray = Array<{ path: string; content: Blob | Uint8Array }>;

/**
 * Uploads a leRobot dataset to Hugging Face
 *
 * @param files Array of files to upload
 * @param accessToken Hugging Face access token
 * @param repoName Repository name (will be created if it doesn't exist)
 * @param privateRepo Whether the repo should be private (default: false)
 * @returns EventTarget that emits 'repoCreated', 'progress', 'finished', and 'error' events
 */
export async function uploadToHuggingFace(
  files: FileArray,
  accessToken: string,
  repoName: string,
  privateRepo: boolean = false
): Promise<EventTarget> {
  const eventTarget = new EventTarget();

  // Run upload asynchronously so UI can subscribe to events immediately
  (async () => {
    try {
      // Get username from token
      const { name: username } = await hub.whoAmI({ accessToken });

      const repoDesignation = {
        name: `${username}/${repoName}`,
        type: "dataset" as const,
      };

      // Try to create repo; if it already exists (409), continue and upload
      try {
        await hub.createRepo({
          repo: repoDesignation,
          accessToken,
          license: "mit",
          private: privateRepo,
        });
        eventTarget.dispatchEvent(
          new CustomEvent("repoCreated", { detail: repoDesignation })
        );
      } catch (error: any) {
        const message = (error && (error.message || `${error}`)) as string;
        const isConflict =
          message?.includes("409") ||
          message?.toLowerCase()?.includes("already created") ||
          message?.toLowerCase()?.includes("already exists");
        if (!isConflict) {
          eventTarget.dispatchEvent(new CustomEvent("error", { detail: error }));
          throw error;
        }
        // Repo exists: proceed as created
        eventTarget.dispatchEvent(
          new CustomEvent("repoCreated", { detail: repoDesignation })
        );
      }

      // Upload files to v2.1 branch, fallback to main if branch doesn't exist
      let uploadedBranch = "v2.1";
      try {
        await uploadFilesWithProgress(
          files,
          accessToken,
          repoDesignation,
          uploadedBranch,
          eventTarget
        );
      } catch (error: any) {
        const message = (error && (error.message || `${error}`)) as string;
        const invalidRev = message?.toLowerCase()?.includes("invalid rev id");
        if (invalidRev) {
          console.warn(
            "v2.1 branch not available. Falling back to main branch."
          );
          uploadedBranch = "main";
          await uploadFilesWithProgress(
            files,
            accessToken,
            repoDesignation,
            uploadedBranch,
            eventTarget
          );
        } else {
          throw error;
        }
      }

      console.log(
        `Successfully uploaded dataset to ${username}/${repoName} (${uploadedBranch})`
      );
      eventTarget.dispatchEvent(
        new CustomEvent("finished", { detail: { branch: uploadedBranch } })
      );
    } catch (error) {
      console.error("Error uploading to Hugging Face:", error);
      eventTarget.dispatchEvent(new CustomEvent("error", { detail: error }));
    }
  })();

  return eventTarget;
}

/**
 * Uploads a leRobot dataset to Amazon S3
 *
 * @param files Array of files to upload
 * @param bucketName S3 bucket name
 * @param accessKeyId AWS access key ID
 * @param secretAccessKey AWS secret access key
 * @param region AWS region (default: us-east-1)
 * @param prefix Optional prefix/folder for uploaded files
 * @returns EventTarget that emits 'bucketVerified', 'progress', 'finished', and 'error' events
 */
export async function uploadToS3(
  files: FileArray,
  bucketName: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "us-east-1",
  prefix: string = ""
): Promise<EventTarget> {
  const eventTarget = new EventTarget();

  // Run upload asynchronously
  (async () => {
    try {
      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Verify bucket exists
      try {
        await s3Client.send(
          new HeadBucketCommand({ Bucket: bucketName })
        );
        eventTarget.dispatchEvent(
          new CustomEvent("bucketVerified", {
            detail: { bucketName, region },
          })
        );
      } catch (error: any) {
        const message = error?.message || `${error}`;
        if (message.includes("404") || message.includes("NotFound")) {
          throw new Error(
            `S3 bucket "${bucketName}" not found in region "${region}"`
          );
        }
        throw error;
      }

      // Upload files
      for (const file of files) {
        const key = prefix ? `${prefix}/${file.path}` : file.path;

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucketName,
            Key: key,
            Body:
              file.content instanceof Blob
                ? Buffer.from(await file.content.arrayBuffer())
                : Buffer.from(file.content),
          },
        });

        upload.on("httpUploadProgress", (progress) => {
          eventTarget.dispatchEvent(
            new CustomEvent("progress", { detail: { file: file.path, progress } })
          );
        });

        await upload.done();
        console.log(`Uploaded ${key}`);
      }

      console.log(
        `Successfully uploaded dataset to S3 bucket: ${bucketName}${prefix ? `/${prefix}` : ""}`
      );
      eventTarget.dispatchEvent(
        new CustomEvent("finished", {
          detail: { bucketName, prefix, filesCount: files.length },
        })
      );
    } catch (error) {
      console.error("Error uploading to S3:", error);
      eventTarget.dispatchEvent(new CustomEvent("error", { detail: error }));
    }
  })();

  return eventTarget;
}

/**
 * Helper function to upload files to Hugging Face with progress tracking
 */
async function uploadFilesWithProgress(
  files: FileArray,
  accessToken: string,
  repoDesignation: { name: string; type: "dataset" },
  branch: string,
  eventTarget: EventTarget
): Promise<void> {
  const referenceId = `lerobot-upload-${Date.now()}`;

  // Upload each file
  for (const file of files) {
    let blob: Blob;

    if (file.content instanceof Blob) {
      blob = file.content;
    } else {
      blob = new Blob([file.content]);
    }

    await hub.uploadFile({
      repo: repoDesignation,
      credentials: { accessToken },
      file: {
        content: blob,
        path: file.path,
      },
      revision: branch,
    });

    eventTarget.dispatchEvent(
      new CustomEvent("progress", {
        detail: { file: file.path, referenceId },
      })
    );

    console.log(`Uploaded ${file.path}`);
  }
}

