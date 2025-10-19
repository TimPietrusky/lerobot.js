import { useCallback, useState } from "react";

export interface CameraError {
  name: string;
  message: string;
}

export interface UseCameraStreamResult {
  stream: MediaStream | null;
  isLoading: boolean;
  error: CameraError | null;
  requestCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useCameraStream(): UseCameraStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const requestCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setStream(mediaStream);
    } catch (err) {
      const error = err as Error & { name?: string };
      if (error.name === "NotAllowedError") {
        setError({
          name: "PermissionDenied",
          message: "Camera permission denied",
        });
      } else if (error.name === "NotFoundError") {
        setError({
          name: "NoCamera",
          message: "No camera device found",
        });
      } else if (error.name === "NotReadableError") {
        setError({
          name: "CameraInUse",
          message: "Camera is already in use",
        });
      } else {
        setError({
          name: "CameraError",
          message: error.message || "Failed to access camera",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  return { stream, isLoading, error, requestCamera, stopCamera };
}
