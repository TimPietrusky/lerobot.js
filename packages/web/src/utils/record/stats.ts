/**
 * Calculates basic statistics (min, max, mean, std, count) for a numeric array
 */
function calculateStats(values: number[]): { min: number[], max: number[], mean: number[], std: number[], count: number[] } {
    const count = values.length;
    if (count === 0) {
        return {
            min: [0],
            max: [0],
            mean: [0],
            std: [0],
            count: [0]
        };
    }

    let min = Infinity;
    let max = -Infinity;

    for(let value of values){
        min = Math.min(min, value);
        max = Math.max(max, value);
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    // Calculate standard deviation
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / count;
    const std = Math.sqrt(avgSquareDiff);

    return {
        min: [min],
        max: [max],
        mean: [mean],
        std: [std],
        count: [count]
    };
}

/**
 * Generates statistics for a dataset
 * @param data The dataset to analyze
 * @param cameraKeys Array of camera keys for dynamic observation.images entries
 */
export function getStats(data: any[], cameraKeys: string[] = []): any {
    // Extract timestamp and episode_index values
    const timestamps = data.map(item => item.timestamp);
    const episodeIndices = data.map(item => item.episode_index);
    
    // Extract other common fields if they exist
    const frameIndices = data.map(item => item.frame_index || 0);
    const taskIndices = data.map(item => item.task_index || 0);
    
    const stats: any = {
        // Standard fields
        "timestamp": calculateStats(timestamps),
        "episode_index": calculateStats(episodeIndices),
        "frame_index": calculateStats(frameIndices),
        "task_index": calculateStats(taskIndices),
    };
    
    // Add observation.images entries for each camera key
    cameraKeys.forEach(key => {
        // In a real implementation, you would calculate actual stats from video data
        // Since we don't have actual video frame data to analyze, we'll use placeholder values
        stats[`observation.images.${key}`] = {
            "min": [[[0.0]], [[0.0]], [[0.0]]],  // R,G,B channels min
            "max": [[[255.0]], [[255.0]], [[255.0]]],  // R,G,B channels max
            "mean": [[[127.5]], [[127.5]], [[127.5]]],  // R,G,B channels mean
            "std": [[[50.0]], [[50.0]], [[50.0]]],  // R,G,B channels std
            "count": [[[data.length * 3]]]  // Number of pixels × 3 channels
        };
    });
    
    return stats;
}

export default getStats;
