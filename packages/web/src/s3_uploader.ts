// Note: To use this module, you'll need to install the AWS SDK:
// npm install @aws-sdk/client-s3 @aws-sdk/lib-storage

import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Define ContentSource type locally to avoid HuggingFace dependency
type ContentSource = Blob | ArrayBuffer | Uint8Array | string;
type FileArray = Array<URL | File | { path: string; content: ContentSource }>;

/**
 * Uploads a leRobot dataset to Amazon S3
 */
export class LeRobotS3Uploader extends EventTarget {
    private _bucketName: string;
    private _region: string;
    private _uploaded: boolean;
    private _bucket_exists: boolean;
    private _s3Client: S3Client | null;
    
    constructor(bucketName: string, region: string = "us-east-1") {
        super();
        this._bucketName = bucketName;
        this._region = region;
        this._uploaded = false;
        this._bucket_exists = false;
        this._s3Client = null;
    }
    
    /**
     * Returns whether the bucket has been successfully checked/created
     */
    get bucketExists(): boolean {
        return this._bucket_exists;
    }

    get uploaded(): boolean {
        return this._uploaded;
    }

    /**
     * Initialize the S3 client with credentials
     * 
     * @param accessKeyId AWS access key ID
     * @param secretAccessKey AWS secret access key
     */
    initializeClient(accessKeyId: string, secretAccessKey: string): void {
        this._s3Client = new S3Client({
            region: this._region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });
    }

    /**
     * Checks if the bucket exists and uploads files to it
     * 
     * @param files The files to upload
     * @param accessKeyId AWS access key ID
     * @param secretAccessKey AWS secret access key
     * @param prefix Optional prefix (folder) to upload files to within the bucket
     * @param referenceId The reference id for the upload, to track it (optional)
     */
    async checkBucketAndUploadFiles(
        files: FileArray, 
        accessKeyId: string, 
        secretAccessKey: string, 
        prefix: string = "",
        referenceId: string = ""
    ): Promise<void> {
        // Initialize the client if not already done
        if (!this._s3Client) {
            this.initializeClient(accessKeyId, secretAccessKey);
        }

        // Check if bucket exists
        try {
            await this._s3Client!.send(new HeadBucketCommand({ Bucket: this._bucketName }));
            this._bucket_exists = true;
            this.dispatchEvent(new CustomEvent("bucketExists", { 
                detail: { bucketName: this._bucketName } 
            }));
        } catch (error) {
            throw new Error(`Bucket ${this._bucketName} does not exist or you don't have permission to access it`);
        }

        // Upload files
        const uploadPromises: Promise<void>[] = [];
        for (const file of files) {
            uploadPromises.push(this.uploadFileWithProgress([file], prefix, referenceId));
        }

        await Promise.all(uploadPromises);
        this._uploaded = true;
    }

    /**
     * Uploads files to S3 with progress events
     * 
     * @param files The files to upload
     * @param prefix Optional prefix (folder) to upload files to within the bucket
     * @param referenceId The reference id for the upload, to track it (optional)
     */
    async uploadFileWithProgress(
        files: FileArray, 
        prefix: string = "", 
        referenceId: string = ""
    ): Promise<void> {
        if (!this._s3Client) {
            throw new Error("S3 client not initialized. Call initializeClient first.");
        }

        for (const file of files) {
            let key: string;
            let body: any;

            if (file instanceof URL) {
                const response = await fetch(file);
                body = await response.blob();
                key = `${prefix}${prefix ? '/' : ''}${file.pathname.split('/').pop()}`;
            } else if (file instanceof File) {
                body = file;
                key = `${prefix}${prefix ? '/' : ''}${file.name}`;
            } else {
                body = file.content;
                key = `${prefix}${prefix ? '/' : ''}${file.path}`;
            }

            const upload = new Upload({
                client: this._s3Client,
                params: {
                    Bucket: this._bucketName,
                    Key: key,
                    Body: body,
                },
            });

            // Set up progress tracking
            upload.on('httpUploadProgress', (progress) => {
                this.dispatchEvent(new CustomEvent("progress", { 
                    detail: {
                        progressEvent: progress,
                        bucketName: this._bucketName,
                        key,
                        referenceId
                    } 
                }));
            });

            await upload.done();
        }
    }

    /**
     * Generates a pre-signed URL for downloading a file from S3
     * 
     * @param _key The key (path) of the file in the S3 bucket
     * @param _expiresIn The number of seconds until the URL expires (default: 3600 = 1 hour)
     * @returns A pre-signed URL for downloading the file
     */
    async generatePresignedUrl(_key: string, _expiresIn: number = 3600): Promise<string> {
        if (!this._s3Client) {
            throw new Error("S3 client not initialized. Call initializeClient first.");
        }

        // Note: This requires the @aws-sdk/s3-request-presigner package
        // Implementation would go here
        throw new Error("generatePresignedUrl not implemented. Requires @aws-sdk/s3-request-presigner package.");
    }
}
