import React, { useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, MonitorSpeaker, Loader2, Sparkles, Terminal, LogIn, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@frontend/components/ui/button";
import { Input } from "@frontend/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@frontend/components/ui/alert";

interface SpotifyDevice {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

interface SpotifyState {
  is_playing: boolean;
  item?: {
    name: string;
    artists: { name: string }[];
    album: {
      images: { url: string }[];
    };
  };
}

export function SpotifyPlayer() {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<string>("");
  const [playbackState, setPlaybackState] = useState<SpotifyState | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [djLoading, setDjLoading] = useState(false);
  
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [prompt, setPrompt] = useState("");

  const checkAuthAndFetch = async () => {
    try {
      // First check connection status via the dedicated endpoint
      const statusRes = await fetch("/api/spotify/status");
      if (statusRes.ok) {
        const { connected } = await statusRes.json() as any;
        if (!connected) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }
      }

      const [devReq, stateReq] = await Promise.all([
        fetch("/api/spotify/devices"),
        fetch("/api/spotify/playback")
      ]);

      if (!devReq.ok || !stateReq.ok) {
        let errStr = "";
        if (!devReq.ok) errStr += await devReq.text();
        if (!stateReq.ok) errStr += await stateReq.text();
        
        if (errStr.toLowerCase().includes("not connected") || errStr.includes("spotify/login") || devReq.status === 500) {
          setNeedsLogin(true);
        } else {
          setError(`Spotify API Error: ${devReq.status} ${stateReq.status}`);
        }
        return;
      }

      setNeedsLogin(false);
      setError(null);

      const devData = await devReq.json() as any;
      const devs = devData.devices || [];
      setDevices(devs);
      
      const active = devs.find((d: SpotifyDevice) => d.is_active);
      if (active) {
        setActiveDevice(active.id);
      } else if (devs.length > 0) {
        const webPlayer = devs.find((d: SpotifyDevice) => d.name.includes("Web Player"));
        setActiveDevice(webPlayer ? webPlayer.id : devs[0].id);
      }

      const stateData = await stateReq.json() as any;
      setPlaybackState(Object.keys(stateData).length === 0 ? null : stateData);

    } catch (e: any) {
      console.error("Network or parsing error", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stateRefs = React.useRef({ needsLogin, error });
  useEffect(() => {
    stateRefs.current = { needsLogin, error };
  }, [needsLogin, error]);

  useEffect(() => {
    checkAuthAndFetch();
    
    // Connect WebSocket
    const wsUrl = new URL("/api/spotify/ws/sync", window.location.href);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    
    const ws = new WebSocket(wsUrl.toString());
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "SYNC_PLAYBACK_STATE") {
           if (playbackState && data.state && data.state._action) {
               const st = data.state;
               setPlaybackState(prev => prev ? {
                 ...prev,
                 is_playing: typeof st.is_playing === "boolean" ? st.is_playing : prev.is_playing
               } : null);
               
               setTimeout(checkAuthAndFetch, 1500);
           } else {
             checkAuthAndFetch();
           }
        }
      } catch (err) {}
    };

    const interval = setInterval(() => {
      if (!stateRefs.current.needsLogin && !stateRefs.current.error) checkAuthAndFetch();
    }, 15000);
    
    return () => {
        clearInterval(interval);
        ws.close();
    };
  }, []);

  const handleTransfer = async (deviceId: string) => {

    setActiveDevice(deviceId);
    setActionLoading(true);
    try {
      await fetch("/api/spotify/transfer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId })
      });
      setTimeout(checkAuthAndFetch, 1000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action: "play" | "pause" | "next" | "previous") => {
    setActionLoading(true);
    try {
      if (action === "play" && playbackState) setPlaybackState({ ...playbackState, is_playing: true });
      if (action === "pause" && playbackState) setPlaybackState({ ...playbackState, is_playing: false });
      
      const method = (action === "play" || action === "pause") ? "PUT" : "POST";
      const res = await fetch(`/api/spotify/${action}`, { method });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Spotify] ${action} failed:`, errText);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDjPrompt = async () => {
    if (!prompt.trim()) return;
    setDjLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spotify/dj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as any;
      if (!data.success) {
        setError(data.message || "AI failed to generate a playlist.");
      }
      setPrompt("");
      setTimeout(checkAuthAndFetch, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDjLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground tracking-widest uppercase">Connecting to Neural Audio...</span>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
        <Terminal className="h-10 w-10 text-primary mb-4 opacity-80" />
        <h3 className="text-xl font-bold text-white mb-2 text-center">Spotify Not Connected</h3>
        <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
          Your Dopamine system requires authorization to route music to your physical speakers and command DJ playlists.
        </p>
        <Button 
          className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold px-8 shadow-[0_0_15px_rgba(29,185,84,0.3)] transition-all"
          onClick={() => window.location.href = '/api/spotify/login'}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh OAuth Connection
        </Button>
      </div>
    );
  }

  const currentTrack = playbackState?.item;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-lg shadow-2xl relative">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => window.location.href = '/api/spotify/login'}
        className="absolute top-4 right-4 text-xs text-white/40 hover:text-white/80 hover:bg-white/5"
      >
        <RefreshCw className="h-3 w-3 mr-1" /> Re-Auth
      </Button>

      
      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Audio System Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
             <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/20">Dismiss</Button>
          </AlertAction>
        </Alert>
      )}

      {/* AI DJ Input Section */}
      <div className="flex flex-col gap-3 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Neural DJ Command</h4>
        </div>
        <div className="flex gap-3">
          <Input 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 'Play some dark synthwave for deep coding'"
            className="bg-black/50 border-white/10 focus-visible:ring-primary/50 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleDjPrompt()}
            disabled={djLoading}
          />
          <Button 
            onClick={handleDjPrompt} 
            disabled={djLoading || !prompt.trim()}
            className="bg-primary text-black hover:bg-primary/90 font-bold shrink-0 min-w-[120px]"
          >
            {djLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mix Tracks"}
          </Button>
        </div>
      </div>

      {/* Device Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <MonitorSpeaker className="h-4 w-4 text-primary" />
          <span>Active Output</span>
        </div>
        <div className="w-64">
          <Select 
            value={activeDevice} 
            onValueChange={handleTransfer}
            disabled={devices.length === 0 || actionLoading || djLoading}
          >
            <SelectTrigger className="border-white/10 bg-white/5 text-xs text-white">
              <SelectValue placeholder="Select a device..." />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0a0f10] max-h-[300px]">
              {devices.map((d, i) => {
                const deviceKey = d.id || `unknown-${i}`;
                return (
                  <SelectItem key={deviceKey} value={deviceKey} className="text-xs text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer transition-colors">
                    {d.name} {d.is_active ? "(Active)" : ""} {d.id === null ? "(ID Hidden)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Now Playing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
        <div className="flex items-center gap-4 flex-1 overflow-hidden">
          {currentTrack?.album?.images?.[0]?.url ? (
            <div className="relative group rounded-md overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <img 
                src={currentTrack.album.images[0].url} 
                alt="Album Art" 
                className="h-16 w-16 md:h-20 md:w-20 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ) : (
            <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 shadow-inner">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Idle</span>
            </div>
          )}
          
          <div className="flex flex-col max-w-[200px] md:max-w-[400px]">
            <h3 className="truncate font-bold text-white text-lg md:text-xl tracking-tight">
              {currentTrack?.name || "Awaiting Signal"}
            </h3>
            <p className="truncate text-sm text-primary/80 font-medium">
              {currentTrack?.artists?.map(a => a.name).join(", ") || "System is ready for playback."}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center md:justify-end gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-12 w-12 shrink-0 rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white"
            onClick={() => handleAction("previous")}
            disabled={actionLoading || djLoading || !activeDevice}
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button 
            variant="default" 
            size="icon" 
            className="h-16 w-16 shrink-0 rounded-full bg-primary text-black hover:bg-primary/90 hover:scale-105 transition-all shadow-[0_0_20px_rgba(13,204,242,0.3)] hover:shadow-[0_0_30px_rgba(13,204,242,0.5)]"
            onClick={() => handleAction(playbackState?.is_playing ? "pause" : "play")}
            disabled={actionLoading || djLoading || !activeDevice}
          >
            {playbackState?.is_playing ? (
              <Pause className="h-7 w-7 fill-black" />
            ) : (
              <Play className="h-7 w-7 fill-black ml-1" />
            )}
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className="h-12 w-12 shrink-0 rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white"
            onClick={() => handleAction("next")}
            disabled={actionLoading || djLoading || !activeDevice}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
