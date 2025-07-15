import { WebTeleoperator } from "./teleoperators/base-teleoperator";
import * as parquet from 'parquet-wasm';
import * as arrow from 'apache-arrow';

// declare a type leRobot action that's basically an array of numbers
interface LeRobotAction {
    [key: number]: number;
}

interface LeRobotDatasetRow {
    timestamp: number;
    action: LeRobotAction;
    "observation.state": LeRobotAction;
    episode_index: number;
    task_index: number;
    frame_index: number;
    index: number;
}

/**
 * A mechanism to store and record, the video of all associated cameras
 * as well as the teleoperator data
 * 
 * follows the lerobot dataset format https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/README.md#the-lerobotdataset-format
 */
export class LeRobotDatasetRecorder {
    teleoperators: WebTeleoperator[];
    videoStreams: { [key: string]: MediaStream };
    mediaRecorders: { [key: string]: MediaRecorder };
    videoChunks: { [key: string]: Blob[] };
    videoBlobs: { [key: string]: Blob };
    teleoperatorData: any;
    private _isRecording: boolean;
    fps : number;

    constructor(teleoperators: WebTeleoperator[], videoStreams: { [key: string]: MediaStream }, fps : number) {
        this.teleoperators = teleoperators;
        this.videoStreams = videoStreams;
        this.mediaRecorders = {};
        this.videoChunks = {};
        this.videoBlobs = {};
        this.teleoperatorData = [];
        this._isRecording = false;
        this.fps = fps;
    }

    get isRecording() : boolean {
        return this._isRecording;
    }

    /**
     * Starts recording for all teleoperators and video streams
     */
    startRecording() {
        if (this._isRecording) {
            console.warn('Recording already in progress');
            return;
        }

        this._isRecording = true;
        
        // Start recording teleoperator data
        this.teleoperators.forEach((teleoperator) => {
            teleoperator.startRecording();
        });
        
        // Start recording video streams
        Object.entries(this.videoStreams).forEach(([key, stream]) => {
            // Initialize empty array for video chunks
            this.videoChunks[key] = [];
            
            // Create a media recorder for this stream
            try {
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'video/webm;codecs=vp9', // High quality codec
                    videoBitsPerSecond: 5000000 // 5 Mbps for good quality
                });
                
                // Handle data available events
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.videoChunks[key].push(event.data);
                    }
                };
                
                // Save the recorder and start recording
                this.mediaRecorders[key] = mediaRecorder;
                mediaRecorder.start(1000); // Capture in 1-second chunks
                
                console.log(`Started recording video stream: ${key}`);
            } catch (error) {
                console.error(`Failed to start recording for stream ${key}:`, error);
            }
        });
    }

    setEpisodeIndex(index: number): void {
        this.teleoperators.forEach((teleoperator) => {
            teleoperator.setEpisodeIndex(index);
        });
    }

    setTaskIndex(index: number): void {
        this.teleoperators.forEach((teleoperator) => {
            teleoperator.setTaskIndex(index);
        });
    }

    /**
     * Stops recording for all teleoperators and video streams
     * @returns An object containing teleoperator data and video blobs
     */
    async stopRecording() {
        if (!this._isRecording) {
            console.warn('No recording in progress');
            return { teleoperatorData: [], videoBlobs: {} };
        }
        
        this._isRecording = false;
        
        // Stop teleoperator recording and collect data
        this.teleoperatorData = [];
        this.teleoperators.forEach((teleoperator) => {
            this.teleoperatorData.push(...teleoperator.stopRecording());
        });
        
        // Stop all media recorders
        const stopPromises = Object.entries(this.mediaRecorders).map(([key, recorder]) => {
            return new Promise<void>((resolve) => {
                // Only do this if the recorder is active
                if (recorder.state === 'inactive') {
                    resolve();
                    return;
                }
                
                // When the recorder stops, create a blob
                recorder.onstop = () => {
                    // Combine all chunks into a single blob
                    const chunks = this.videoChunks[key] || [];
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    this.videoBlobs[key] = blob;
                    resolve();
                };
                
                // Stop the recorder
                recorder.stop();
            });
        });
        
        // Wait for all recorders to stop
        await Promise.all(stopPromises);        
        return {
            teleoperatorData: this.teleoperatorData,
            videoBlobs: this.videoBlobs
        };
    }

    /**
     * Action is a dictionary of motor positions, timestamp1 and timestamp2 are when the actions occurred
     * reqTimestamp must be between timestamp1 and timestamp2
     * 
     * the keys in action1 and action2 must match, this will loop through the dictionary
     * and interpolate each action to the required timestamp
     * 
     * @param action1 Motor positions at timestamp1
     * @param action2 Motor positions at timestamp2
     * @param timestamp1 The timestamp of action1
     * @param timestamp2 The timestamp of action2
     * @param reqTimestamp The timestamp at which to interpolate
     * @returns The interpolated action
     */
    _actionInterpolatate(action1 : any, action2 : any, timestamp1 : number, timestamp2 : number, reqTimestamp : number) : any {
        if(reqTimestamp < timestamp1 || reqTimestamp > timestamp2) throw new Error("reqTimestamp must be between timestamp1 and timestamp2");
        if(timestamp2 < timestamp1) throw new Error("timestamp2 must be greater than timestamp1");

        const numActions = Object.keys(action1).length;
        const interpolatedAction : any = {};
        const timeRange = timestamp2 - timestamp1;

        for(let i = 0; i < numActions; i++){
            const key = Object.keys(action1)[i];
            interpolatedAction[key] = action1[key] + (action2[key] - action1[key]) * (reqTimestamp - timestamp1) / timeRange;
        }

        return interpolatedAction;
    }

    /**
     * Converts an action object to an array of numbers
     * follows the same pattern as https://huggingface.co/datasets/lerobot/svla_so100_pickplace
     * I am not really sure if the array can be in a different order
     * but I am not going to risk it tbh 😛
     * 
     * @param action The action object to convert
     * @returns An array of numbers
     */
    convertActionToArray(action : any) : number[] {
        return [
            action["shoulder_pan"], 
            action["shoulder_lift"],
            action["elbow_flex"],
            action["wrist_flex"],
            action["wrist_roll"],
            action["gripper"]
        ]
    }

    /**
     * Finds the closest timestamp to the target timestamp
     * 
     * the data must have timestamps in ascending order
     * uses binary search to get the closest timestamp
     * 
     * @param data The data to search through
     * @param targetTimestamp The target timestamp
     * @returns The closest timestamp in the data's index
     */
    _findClosestTimestampBefore(data : any[], targetTimestamp : number): number{
        let firstIndex = 0;
        let lastIndex = data.length - 1;

        while (firstIndex <= lastIndex) {
            const middleIndex = Math.floor((firstIndex + lastIndex) / 2);
            const middleTimestamp = data[middleIndex].timestamp;

            if (middleTimestamp === targetTimestamp) {
                return middleIndex;
            } else if (middleTimestamp < targetTimestamp) {
                firstIndex = middleIndex + 1;
            } else {
                lastIndex = middleIndex - 1;
            }
        }

        return lastIndex;
    }

    /**
     * Takes non-regularly spaced lerobot-ish data and interpolates it to a regularly spaced dataset
     * also adds additional
     * - frame_index
     * - episode_index
     * - index columns
     * 
     * to match lerobot dataset requirements
     */
    async _interpolateAndCompleteLerobotData(fps : number, roughData : any[]){
        const interpolatedData : any[] = [];
        let minTimestamp = roughData[0].timestamp;
        let maxTimestamp = roughData[roughData.length - 1].timestamp;
        const numFrames = Math.floor((maxTimestamp - minTimestamp) * fps);
        let currentEpisode = 0;
        let frameIndex = 0;

        console.log("frames", numFrames, roughData[0].timestamp, roughData[roughData.length - 1].timestamp, fps)

        for(let i = 0; i < numFrames; i++){
            const timestamp = i / fps;
            const closestIndex = this._findClosestTimestampBefore(roughData, timestamp);
            const nextIndex = closestIndex + 1;
            const closestItemData = roughData[closestIndex];
            const nextItemData = roughData[nextIndex];
            const action = this._actionInterpolatate(closestItemData.action, nextItemData.action, closestItemData.timestamp, nextItemData.timestamp, timestamp);
            const observation_state = this._actionInterpolatate(closestItemData["observation.state"], nextItemData["observation.state"], closestItemData.timestamp, nextItemData.timestamp, timestamp);

            if(closestItemData.episode_index > currentEpisode){
                currentEpisode = closestItemData.episode_index;
                frameIndex = 0;
            }

            interpolatedData.push({
                timestamp: timestamp,
                action: this.convertActionToArray(action),
                "observation.state": this.convertActionToArray(observation_state),
                episode_index: closestItemData.episode_index,
                task_index: closestItemData.task_index,
                frame_index : frameIndex,
                index: i
            });

            frameIndex++;
        }

        return interpolatedData;
    }

    /**
     * Processes the data into lerobot format
     */
    async convertActionDataToLeRobotFormat(){
        if(this._isRecording) throw new Error("This can only be called, after recording has stopped!");

        // sort the data by timestamp first
        let data = this.teleoperatorData.sort((a : any, b : any) => a.commandSentTimestamp - b.commandSentTimestamp);

        const roughData : any[] = [];

        const firstTimestamp = data[0].commandSentTimestamp;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            roughData.push({
                timestamp: row.commandSentTimestamp - firstTimestamp, //timestamps start from 0
                action: row.previousMotorConfigsNormalized,
                "observation.state": row.newMotorConfigsNormalized,
                episode_index: row.episodeIndex,
                task_index: row.taskIndex
            });
        }

        return this._interpolateAndCompleteLerobotData(this.fps, roughData);
    }

    /**
     * exports the teleoperator data in lerobot format, 
     * returns an array of the entire
     * Teleoperator data structure
     */
    async exportTeleoperatorData(){
        if(this._isRecording) throw new Error("This can only be called, after recording has stopped!");
        const data = await this.convertActionDataToLeRobotFormat();
        return data
    }

    /**
     * exports all the data in a zip file for lerobot format
     * (caution heavy)
     * 
     * This converts to apache-arrow by wasm first, then to parquet,
     * so it is slow
     */
    async exportForLeRobot(){
        const data = await this.exportTeleoperatorData();
        const { tableFromArrays, vectorFromArray } = arrow;

        const timestamps = data.map((row : any) => row.timestamp);
        const actions = data.map((row : any) => row.action);
        const observationStates = data.map((row : any) => row["observation.state"]);
        const episodeIndexes = data.map((row : any) => row.episode_index);
        const taskIndexes = data.map((row : any) => row.task_index);
        const frameIndexes = data.map((row : any) => row.frame_index);
        const indexes = data.map((row : any) => row.index);

        const table = tableFromArrays({
            timestamp: timestamps,
            // @ts-ignore, this works, idk why
            action: vectorFromArray(actions, new arrow.List(new arrow.Field("item", new arrow.Float32()))),

            // @ts-ignore, this works, idk why
            "observation.state": vectorFromArray(observationStates, new arrow.List(new arrow.Field("item", new arrow.Float32()))),
            episode_index: episodeIndexes,
            task_index: taskIndexes,
            frame_index: frameIndexes,
            index: indexes
        });

        const wasmUrl = "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/esm/parquet_wasm_bg.wasm";
        const initWasm = parquet.default
        await initWasm(wasmUrl)

        const wasmTable = parquet.Table.fromIPCStream(arrow.tableToIPC(table, "stream"));
        const writerProperties = new parquet.WriterPropertiesBuilder()
            .setCompression(parquet.Compression.ZSTD)
            .build();
        const parquetUint8Array = parquet.writeParquet(wasmTable, writerProperties);

        // Create a blob from the parquet data
        const blob = new Blob([parquetUint8Array], { type: 'application/octet-stream' });
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Create a download link and trigger the download
        const link = document.createElement('a');
        link.href = url;
        link.download = `lerobot_dataset_${new Date().toISOString().replace(/[:.]/g, '-')}.parquet`;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }
}