"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Mic, Volume2, CheckCircle2, XCircle } from "lucide-react";

interface DeviceCheckProps {
  onReady: () => void;
}

export function DeviceCheck({ onReady }: DeviceCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraPermission, setCameraPermission] = useState<
    "pending" | "granted" | "denied"
  >("pending");
  const [micPermission, setMicPermission] = useState<
    "pending" | "granted" | "denied"
  >("pending");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");

  useEffect(() => {
    async function requestPermissions() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        setCameraPermission("granted");
        setMicPermission("granted");

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Get device list
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        const audioDevices = devices.filter((d) => d.kind === "audioinput");
        setCameras(videoDevices);
        setMics(audioDevices);

        if (videoDevices.length > 0) setSelectedCamera(videoDevices[0].deviceId);
        if (audioDevices.length > 0) setSelectedMic(audioDevices[0].deviceId);
      } catch {
        setCameraPermission("denied");
        setMicPermission("denied");
      }
    }

    requestPermissions();

    return () => {
      // Cleanup: stop tracks when unmounting
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const allReady = cameraPermission === "granted" && micPermission === "granted";

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <h3 className="text-lg font-semibold">Device Check</h3>

        {/* Camera Preview */}
        <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
          {cameraPermission === "granted" ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : cameraPermission === "denied" ? (
            <div className="flex h-full items-center justify-center text-white">
              <div className="text-center">
                <XCircle className="mx-auto h-8 w-8 text-red-400" />
                <p className="mt-2 text-sm">Camera access denied</p>
                <p className="text-xs text-gray-400 mt-1">
                  Please allow camera access in your browser settings
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-white">
              <p className="text-sm">Requesting camera access...</p>
            </div>
          )}
        </div>

        {/* Device Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Camera</span>
            </div>
            {cameraPermission === "granted" ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : cameraPermission === "denied" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <span className="text-xs text-muted-foreground">Checking...</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Microphone</span>
            </div>
            {micPermission === "granted" ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : micPermission === "denied" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <span className="text-xs text-muted-foreground">Checking...</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Speakers</span>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
        </div>

        {/* Device Selectors */}
        {cameras.length > 1 && (
          <div>
            <label className="text-xs text-muted-foreground">Camera</label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((cam) => (
                  <SelectItem key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mics.length > 1 && (
          <div>
            <label className="text-xs text-muted-foreground">Microphone</label>
            <Select value={selectedMic} onValueChange={setSelectedMic}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mics.map((mic) => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Mic ${mics.indexOf(mic) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          className="w-full"
          onClick={onReady}
          disabled={!allReady}
        >
          {allReady ? "Devices Ready — Continue" : "Waiting for permissions..."}
        </Button>
      </CardContent>
    </Card>
  );
}
