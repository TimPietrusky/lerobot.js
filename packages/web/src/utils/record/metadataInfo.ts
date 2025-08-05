export interface VideoInfo {
    height: number;
    width: number;
    channels: number;
    codec: string;
    pix_fmt: string;
    is_depth_map: boolean;
    has_audio: boolean;
}

/**
 * Metadata parameters interface
 */
interface MetadataParams {
    total_episodes: number;
    total_frames: number;
    total_tasks: number;
    chunks_size: number;
    fps: number;
    splits: { [key: string]: string };
    features: { [key: string]: any };
    videos_info: VideoInfo[];
    data_files_size_in_mb: number;
    video_files_size_in_mb: number;
}

/**
 * Generates and returns a metadata information dictionary
 * Needs some named parameters passed as parameters
 */
function getMetadataInfo(params: MetadataParams) {
    return {
        "codebase_version": "v2.1",
        "robot_type": "so100",
        "total_episodes": params.total_episodes,
        "total_frames": params.total_frames,
        "total_tasks": params.total_tasks,
        "total_videos": params.videos_info.length,
        "total_chunks": 1,
        "chunks_size": params.chunks_size,
        "fps": params.fps,
        "splits": {
            "train": `0:${params.total_episodes}`
        },
        "data_path": "data/chunk-{episode_chunk:03d}/episode_{episode_index:06d}.parquet",
        "video_path": "videos/chunk-{episode_chunk:03d}/{video_key}/episode_{episode_index:06d}.mp4",
        "features": {
            "action": {
                "dtype": "float32",
                "shape": [
                    6
                ],
                "names": [
                    "main_shoulder_pan",
                    "main_shoulder_lift",
                    "main_elbow_flex",
                    "main_wrist_flex",
                    "main_wrist_roll",
                    "main_gripper"
                ],
                "fps": params.fps
            },
            "observation.state": {
                "dtype": "float32",
                "shape": [
                    6
                ],
                "names": [
                    "main_shoulder_pan",
                    "main_shoulder_lift",
                    "main_elbow_flex",
                    "main_wrist_flex",
                    "main_wrist_roll",
                    "main_gripper"
                ],
                "fps": params.fps
            },
            "observation.images.front": {
                "dtype": "video",
                "shape": [
                    480,
                    640,
                    3
                ],
                "names": [
                    "height",
                    "width",
                    "channels"
                ],
                "info": {
                    "video.fps": params.fps,
                    "video.height": 480,
                    "video.width": 640,
                    "video.channels": 3,
                    "video.codec": "av1",
                    "video.pix_fmt": "yuv420p",
                    "video.is_depth_map": false,
                    "has_audio": false
                }
            },
            "timestamp": {
                "dtype": "float32",
                "shape": [
                    1
                ],
                "names": null,
                "fps": params.fps
            },
            "frame_index": {
                "dtype": "int64",
                "shape": [
                    1
                ],
                "names": null,
                "fps": params.fps
            },
            "episode_index": {
                "dtype": "int64",
                "shape": [
                    1
                ],
                "names": null,
                "fps": params.fps
            },
            "index": {
                "dtype": "int64",
                "shape": [
                    1
                ],
                "names": null,
                "fps": params.fps
            },
            "task_index": {
                "dtype": "int64",
                "shape": [
                    1
                ],
                "names": null,
                "fps": params.fps
            }
        },
        "data_files_size_in_mb": 100,
        "video_files_size_in_mb": 500
    }
}

export function getVideoInfo(width: number, height: number): VideoInfo {
    return {
        height,
        width, 
        channels: 3,
        codec: "h264",
        pix_fmt: "yuv420p",
        is_depth_map: false,
        has_audio: false
    };
}

export default getMetadataInfo;
