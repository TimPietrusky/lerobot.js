"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Disc as Record, 
  Download, 
  Upload, 
  PlusCircle,
  Square,
  Camera,
  Trash2
} from "lucide-react";
import { LeRobotDatasetRecorder } from "@lerobot/web";

interface RecorderProps {
  teleoperators: any[];
  videoStreams?: { [key: string]: MediaStream };
}

interface Episode {
  id: number;
  frames: number;
  duration: string;
  status: "complete" | "recording" | "pending";
}

export function Recorder({ teleoperators }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [huggingfaceApiKey, setHuggingfaceApiKey] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [additionalCameras, setAdditionalCameras] = useState<{[key: string]: MediaStream}>({});
  const [hasRecordedFrames, setHasRecordedFrames] = useState(false);
  const recorderRef = useRef<LeRobotDatasetRecorder | null>(null);
  const { toast } = useToast();


  // Initialize the recorder
  useEffect(() => {
    if (teleoperators.length > 0) {
      recorderRef.current = new LeRobotDatasetRecorder(
        teleoperators,
        additionalCameras,
        30, // fps
        "Robot teleoperation recording"
      );
    }
  }, [teleoperators, additionalCameras]);

  const handleStartRecording = () => {
    if (!recorderRef.current) {
      toast({
        title: "Recording Error",
        description: "Recorder not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      // Set the episode index
      recorderRef.current.setEpisodeIndex(currentEpisode);
      recorderRef.current.setTaskIndex(0); // Default task index
      
      // Start recording
      recorderRef.current.startRecording();
      setIsRecording(true);
      setHasRecordedFrames(true);
      
      // Add a new episode to the list
      setEpisodes(prev => [
        ...prev, 
        { 
          id: currentEpisode, 
          frames: 0, 
          duration: "00:00", 
          status: "recording" 
        }
      ]);

      toast({
        title: "Recording Started",
        description: `Episode ${currentEpisode} is now recording`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start recording";
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) {
      return;
    }

    try {
      const result = await recorderRef.current.stopRecording();
      setIsRecording(false);
      
      // Update the episode status
      setEpisodes(prev => prev.map(ep => 
        ep.id === currentEpisode 
          ? { 
              ...ep, 
              status: "complete", 
              frames: result.teleoperatorData.length,
              duration: formatDuration(result.teleoperatorData.length / 30) // Assuming 30fps
            } 
          : ep
      ));

      toast({
        title: "Recording Stopped",
        description: `Episode ${currentEpisode} completed with ${result.teleoperatorData.length} frames`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to stop recording";
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleNextEpisode = () => {
    // Make sure we're not recording
    if (isRecording) {
      handleStopRecording();
    }
    
    // Increment episode counter
    setCurrentEpisode(prev => prev + 1);
    
    toast({
      title: "New Episode",
      description: `Ready to record episode ${currentEpisode + 1}`,
    });
  };

  // Reset frames by clearing the recorder data
  const handleResetFrames = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    }

    if (recorderRef.current) {
      // @ts-ignore
      recorderRef.current.clearRecording();
      setHasRecordedFrames(false);
      
      // Clear the old episodes
      setEpisodes([]);

      toast({
        title: "Frames Reset",
        description: "All recorded frames have been cleared",
      });
    }
  }, [isRecording, toast]);

  // Add a new camera to the recorder
  const handleAddCamera = useCallback(() => {
    if (!cameraName.trim()) {
      toast({
        title: "Camera Error",
        description: "Please enter a camera name",
        variant: "destructive",
      });
      return;
    }

    if (hasRecordedFrames) {
      toast({
        title: "Camera Error",
        description: "Cannot add cameras after recording has started",
        variant: "destructive",
      });
      return;
    }

    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        // Add the new camera to our state
        setAdditionalCameras(prev => ({
          ...prev,
          [cameraName]: stream
        }));

        setCameraName(""); // Clear the input

        toast({
          title: "Camera Added",
          description: `Camera "${cameraName}" has been added to the recorder`,
        });
      })
      .catch(error => {
        toast({
          title: "Camera Error",
          description: `Failed to access camera: ${error.message}`,
          variant: "destructive",
        });
      });
  }, [cameraName, hasRecordedFrames, toast]);

  // Remove a camera from the recorder
  const handleRemoveCamera = useCallback((name: string) => {
    if (hasRecordedFrames) {
      toast({
        title: "Camera Error",
        description: "Cannot remove cameras after recording has started",
        variant: "destructive",
      });
      return;
    }

    setAdditionalCameras(prev => {
      const newCameras = { ...prev };
      if (newCameras[name]) {
        // Stop the stream tracks
        newCameras[name].getTracks().forEach(track => track.stop());
        delete newCameras[name];
      }
      return newCameras;
    });

    toast({
      title: "Camera Removed",
      description: `Camera "${name}" has been removed`,
    });
  }, [hasRecordedFrames, toast]);

  const handleDownloadZip = async () => {
    if (!recorderRef.current) {
      toast({
        title: "Download Error",
        description: "Recorder not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      await recorderRef.current.exportForLeRobot('zip-download');
      toast({
        title: "Download Started",
        description: "Your dataset is being downloaded as a ZIP file",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to download dataset";
      toast({
        title: "Download Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUploadToHuggingFace = async () => {
    if (!recorderRef.current) {
      toast({
        title: "Upload Error",
        description: "Recorder not initialized",
        variant: "destructive",
      });
      return;
    }

    if (!huggingfaceApiKey) {
      toast({
        title: "Upload Error",
        description: "Please enter your HuggingFace API key",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Upload Started",
        description: "Uploading dataset to HuggingFace...",
      });

      // Generate a unique repository name
      const repoName = `lerobot-recording-${Date.now()}`;
      
      const uploader =await recorderRef.current.exportForLeRobot('huggingface', {
        repoName,
        accessToken: huggingfaceApiKey
      });

      uploader.addEventListener("progress", (event : any) => {
        console.log(event);
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload to HuggingFace";
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="mt-6 p-6 backdrop-blur-sm border-white/10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-black">Robot Movement Recorder</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleResetFrames}
              disabled={isRecording || !hasRecordedFrames}
            >
              <Trash2 className="w-5 h-5" />
              Reset Frames
            </Button>
            <Button 
              variant={isRecording ? "destructive" : "default"}
              size="lg"
              className="gap-2"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
            >
              {isRecording ? (
                <>
                  <Square className="w-5 h-5" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Record className="w-5 h-5" />
                  Start Recording
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleNextEpisode}
              disabled={isRecording}
            >
              <PlusCircle className="w-5 h-5" />
              Next Episode
            </Button>
          </div>
        </div>

        <div className="border border-white/10 rounded-md overflow-hidden">
          <Table>
            <TableCaption>List of recorded episodes</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Episode ID</TableHead>
                <TableHead>Frames</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.length > 0 ? (
                episodes.map((episode) => (
                  <TableRow key={episode.id}>
                    <TableCell className="font-mono">{episode.id}</TableCell>
                    <TableCell>
                      {episode.status === "recording" ? "Recording..." : episode.frames}
                    </TableCell>
                    <TableCell>
                      {episode.status === "recording" ? "Recording..." : episode.duration}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          episode.status === "recording" ? "destructive" :
                          episode.status === "complete" ? "default" : "outline"
                        }
                      >
                        {episode.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No episodes recorded yet. Click "Start Recording" to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Camera Management Section */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-3">Camera Management</h3>
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Camera Name"
              value={cameraName}
              onChange={(e) => setCameraName(e.target.value)}
              className="flex-1 bg-black/20 border-white/10"
              disabled={hasRecordedFrames}
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleAddCamera}
              disabled={hasRecordedFrames || !cameraName.trim()}
            >
              <Camera className="w-4 h-4" />
              Add Camera
            </Button>
          </div>
          
          {/* Display added cameras */}
          {Object.keys(additionalCameras).length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-muted-foreground">Added Cameras:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(additionalCameras).map(name => (
                  <Badge key={name} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                    {name}
                    <button 
                      onClick={() => handleRemoveCamera(name)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      disabled={hasRecordedFrames}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadZip}
              disabled={episodes.length === 0 || isRecording}
            >
              <Download className="w-4 h-4" />
              Download as ZIP
            </Button>
            
            {/* Reset Frames button moved to top bar */}
          </div>
          
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleUploadToHuggingFace}
              disabled={episodes.length === 0 || isRecording || !huggingfaceApiKey}
            >
              <Upload className="w-4 h-4" />
              Upload to HuggingFace
            </Button>
            
            <Input
              placeholder="HuggingFace API Key"
              value={huggingfaceApiKey}
              onChange={(e) => setHuggingfaceApiKey(e.target.value)}
              className="flex-1 bg-black/20 border-white/10"
              type="password"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
