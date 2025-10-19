export interface HandTrackingConfig {
  cameraToControlScale?: number;
  zRangeMin?: number;
  zRangeMax?: number;
  positionSmoothing?: number;
  gestureSmoothing?: number;
  pinchThreshold?: number;
  touchThreshold?: number;
}

export interface HandKeypoint {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

export interface HandKeypoints {
  [key: string]: HandKeypoint;
}

export interface HandTrackingState {
  isActive: boolean;
  detectedGestures: string[];
  handKeypoints: HandKeypoints;
  positionSmoothed: { x: number; y: number; z: number };
}

export const DEFAULT_HAND_TRACKING_CONFIG: HandTrackingConfig = {
  cameraToControlScale: 0.7,
  zRangeMin: 0.4,
  zRangeMax: 2.4,
  positionSmoothing: 0.3,
  gestureSmoothing: 0.2,
  pinchThreshold: 50,
  touchThreshold: 30,
};

export const SO100_HAND_TRACKING_CONFIG: HandTrackingConfig = {
  cameraToControlScale: 0.7,
  zRangeMin: 0.4,
  zRangeMax: 2.4,
  positionSmoothing: 0.3,
  gestureSmoothing: 0.2,
  pinchThreshold: 50,
  touchThreshold: 30,
};
