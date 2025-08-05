/**
 * Class to train a model using runpod
 */
class LeRobotRunpodTrainer extends EventTarget {
    api_token: string;
    constructor(api_token: string) {
        super();
        this.api_token = api_token;
    }

    async _startPod(api_token: string) {
        const podOptions = {
            allowedCudaVersions: ["12.8"],
            cloudType: "SECURE",
            computeType: "GPU",
            containerDiskInGb: 50,
            countryCodes: ["<string>"],
            cpuFlavorIds: ["cpu3c"],
            cpuFlavorPriority: "availability",
            dataCenterIds: ["EU-RO-1","CA-MTL-1"],
            dataCenterPriority: "availability",
            dockerEntrypoint: [],
            dockerStartCmd: [],
            env: {"ENV_VAR":"value"},
            globalNetworking: true,
            gpuCount: 1,
            gpuTypeIds: ["NVIDIA GeForce RTX 4090"],
            gpuTypePriority: "availability",
            imageName: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04",
            interruptible: false,
            locked: false,
            minDiskBandwidthMBps: 123,
            minDownloadMbps: 123,
            minRAMPerGPU: 8,
            minUploadMbps: 123,
            minVCPUPerGPU: 2,
            name: "my pod",
            ports: ["8888/http","22/tcp"],
            supportPublicIp: true,
            templateId: null,
            vcpuCount: 2,
            volumeInGb: 20,
            volumeMountPath: "/workspace"
        }
        const options = {
            method: 'POST',
            headers: {Authorization: 'Bearer ' + api_token, 'Content-Type': 'application/json'},
            body: JSON.stringify(podOptions)
        };
          
        const response = await fetch('https://rest.runpod.io/v1/pods', options);
        const data = await response.json();
        return data;
    }

    async start() {
        await this._startPod(this.api_token);
        this.dispatchEvent(new CustomEvent("deployed_training_pod"));
    }
}