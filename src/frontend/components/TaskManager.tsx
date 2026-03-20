import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Badge } from "@frontend/components/ui/badge";

export function TaskManager() {
  const [activeTask, setActiveTask] = useState<any>(null);
  const [liveTimer, setLiveTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Determine WSS URL dynamically
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/printer/ws`;
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "ui_sync" && data.task) {
        setActiveTask(data.task);
      }
    };

    return () => ws.close();
  }, []);

  // Handle live ticking if task is in_progress
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeTask && activeTask.status === "in_progress" && activeTask.lastStartedAt) {
      const startSecs = activeTask.lastStartedAt;
      const initialSpent = activeTask.timeSpent || 0;
      
      timerRef.current = setInterval(() => {
        const nowSecs = Math.floor(Date.now() / 1000);
        setLiveTimer(initialSpent + (nowSecs - startSecs));
      }, 1000);
    } else if (activeTask) {
      setLiveTimer(activeTask.timeSpent || 0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTask]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!activeTask) {
    return (
      <Card className="w-full max-w-md bg-zinc-950 text-zinc-50 border-zinc-800">
        <CardContent className="flex flex-col items-center justify-center h-48 text-zinc-500">
          <p>Scan a Task Receipt to begin focus session...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md bg-zinc-950 text-zinc-50 border-zinc-800 transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">{activeTask.title}</CardTitle>
        <Badge variant={activeTask.status === "in_progress" ? "default" : "secondary"}>
          {activeTask.status.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4 mt-4">
          <div className="text-4xl font-mono tracking-wider text-center text-emerald-400">
            {formatTime(liveTimer)}
          </div>
          <p className="text-sm text-zinc-400 text-center">
            {activeTask.status === "in_progress" 
              ? "Session Active. Scan PAUSE or DONE when finished." 
              : "Session Paused. Scan PLAY to resume."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
