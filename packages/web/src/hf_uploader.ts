import * as hub from "@huggingface/hub";
import type { RepoDesignation } from "@huggingface/hub";
import type { ContentSource } from "@huggingface/hub";

type FileArray = Array<URL | File | { path: string; content: ContentSource }>;
/**
 * Uploads a leRobot dataset to huggingface
 */

export class LeRobotHFUploader extends EventTarget {
    private _repoDesignation: RepoDesignation;
    private _uploaded : boolean;
    private _created_repo : boolean;
    
    constructor(username: string, repoName: string) {
        super();
        this._repoDesignation = {
            name : `${username}/${repoName}`,
            type : "dataset"
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

    get uploaded() : boolean {
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
    async createRepoAndUploadFiles(files : FileArray, accessToken : string, referenceId : string = "") {
        await hub.createRepo({
            repo: this._repoDesignation,
            accessToken: accessToken,
            license: "mit"
        });

        this._created_repo = true;
        this.dispatchEvent(new CustomEvent("repoCreated", { detail: this._repoDesignation }));

        const uploadPromises : Promise<void>[] = [];
        for(const file of files){
            uploadPromises.push(this.uploadFileWithProgress([file], accessToken, referenceId));
        }

        await Promise.all(uploadPromises);
    }

    /**
     * Uploads files to huggingface with progress events
     * 
     * @param files The files to upload
     * @param accessToken The access token for huggingface
     * @param referenceId The reference id for the upload, to track it (optional)
     */
    async uploadFileWithProgress(files : FileArray, accessToken : string, referenceId : string = "") {
        for await (const progressEvent of hub.uploadFilesWithProgress({
            repo: this._repoDesignation,
            accessToken: accessToken,
            files: files,
        })) {
            this.dispatchEvent(new CustomEvent("progress", { detail: {
                progressEvent,
                repoDesignation: this._repoDesignation,
                referenceId
            } }));
        }
    }
}