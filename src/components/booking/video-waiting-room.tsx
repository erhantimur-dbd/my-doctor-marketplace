"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, Clock, User } from "lucide-react";
import { DeviceCheck } from "./device-check";

interface VideoWaitingRoomProps {
  videoRoomUrl: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  doctorName: string;
  doctorAvatarUrl: string | null;
  specialty: string;
}

export function VideoWaitingRoom({
  videoRoomUrl,
  appointmentDate,
  startTime,
  endTime,
  doctorName,
  doctorAvatarUrl,
  specialty,
}: VideoWaitingRoomProps) {
  const [deviceReady, setDeviceReady] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [canJoin, setCanJoin] = useState(false);

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const start = new Date(`${appointmentDate}T${startTime}`);
      const diffMs = start.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);

      // Can join from 10 min before to 60 min after
      const joinEnabled = diffMins <= 10 && diffMins >= -60;
      setCanJoin(joinEnabled);

      if (diffMs <= 0) {
        setCountdown("Your appointment has started");
      } else if (diffMins > 60) {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setCountdown(`Starts in ${hours}h ${mins}m`);
      } else if (diffMins > 0) {
        setCountdown(
          `Starts in ${diffMins}m ${diffSecs.toString().padStart(2, "0")}s`
        );
      } else {
        setCountdown("Starting now...");
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [appointmentDate, startTime]);

  function joinCall() {
    window.open(videoRoomUrl, "_blank");
  }

  const formattedDate = new Date(
    `${appointmentDate}T00:00:00`
  ).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedStartTime = startTime.slice(0, 5);
  const formattedEndTime = endTime.slice(0, 5);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Appointment Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {doctorAvatarUrl && (
                <AvatarImage src={doctorAvatarUrl} alt={doctorName} />
              )}
              <AvatarFallback>
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{doctorName}</h2>
              <p className="text-sm text-muted-foreground">{specialty}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formattedDate}
                </div>
                <span>
                  {formattedStartTime} — {formattedEndTime}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="mt-6 rounded-lg bg-primary/5 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{countdown}</p>
            {!canJoin && (
              <p className="mt-1 text-sm text-muted-foreground">
                You can join the call 10 minutes before the start time
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Device Check */}
      {!deviceReady && (
        <DeviceCheck onReady={() => setDeviceReady(true)} />
      )}

      {/* Join Button */}
      {deviceReady && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Video className="h-5 w-5" />
              <span className="font-medium">Devices ready</span>
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={joinCall}
              disabled={!canJoin}
            >
              <Video className="h-5 w-5" />
              {canJoin ? "Join Video Call" : "Waiting for start time..."}
            </Button>
            {canJoin && (
              <p className="text-xs text-muted-foreground">
                The call will open in a new tab
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card>
        <CardContent className="p-6">
          <h3 className="mb-3 font-medium">Tips for your video appointment</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Find a quiet, well-lit room with a stable internet connection
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Close unnecessary browser tabs and applications
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Have any relevant documents or test results ready
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Use headphones for better audio quality
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
