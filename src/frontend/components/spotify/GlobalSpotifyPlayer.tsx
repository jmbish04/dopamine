import React, { useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@frontend/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator } from "@frontend/components/ui/dropdown-menu";
import { Slider } from "@frontend/components/ui/slider";

interface SpotifyState {
  is_playing: boolean;
  progress_ms: number;
  item?: {
    id: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: {
      images: { url: string }[];
    };
  };
  device?: {
    id: string;
    volume_percent: number;
  };
}

export function GlobalSpotifyPlayer() {
  const [playbackState, setPlaybackState] = useState<SpotifyState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch("/api/spotify/playback");
      if (res.status === 204 || !res.ok) {
        setIsVisible(false);
        return;
      }
      
      const data = await res.json() as any;
      if (!data || Object.keys(data).length === 0) {
        setIsVisible(false);
        setPlaybackState(null);
        return;
      }

      setPlaybackState(data);
      setIsVisible(!!data.item); 
    } catch (e) {
      console.error("Global player fetch err", e);
      setIsVisible(false);
    }
  };

  useEffect(() => {
    fetchState();
    
    // Connect WebSocket
    const wsUrl = new URL("/api/spotify/ws/sync", window.location.href);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    
    const ws = new WebSocket(wsUrl.toString());
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "SYNC_PLAYBACK_STATE") {
           // We do a fast optimistic merge if it's just an action
           if (playbackState && data.state && data.state._action) {
               const st = data.state;
               setPlaybackState(prev => prev ? {
                 ...prev,
                 is_playing: typeof st.is_playing === "boolean" ? st.is_playing : prev.is_playing,
                 device: st._action === "volume" && st.volume_percent !== undefined 
                           ? { ...prev.device!, volume_percent: st.volume_percent } 
                           : prev.device
               } : null);
               
               // Invalidate and fetch full state slowly just to be safe
               setTimeout(fetchState, 1500);
           } else {
             // Or we just re-fetch to guarantee accuracy 
             fetchState();
           }
        }
      } catch (err) {}
    };

    // Still keep a slow fallback poll just in case WS drops silently
    const int = setInterval(fetchState, 15000);
    
    return () => {
        clearInterval(int);
        ws.close();
    };
  }, []);

  const handleAction = async (action: "play" | "pause" | "next" | "previous") => {
    // Optimistic UI updates are safe here natively, WS broadcasts will follow
    if (action === "play" && playbackState) setPlaybackState({ ...playbackState, is_playing: true });
    if (action === "pause" && playbackState) setPlaybackState({ ...playbackState, is_playing: false });
    
    await fetch(`/api/spotify/${action}`, { method: "POST" });
  };

  const handleVolume = async (value: number[]) => {
    const newVol = value[0];
    if (!playbackState?.device) return;
    
    setPlaybackState({
        ...playbackState,
        device: { ...playbackState.device, volume_percent: newVol }
    });

    await fetch("/api/spotify/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volumePercent: newVol })
    });
  };

  if (!isVisible || !playbackState?.item) return null;

  const track = playbackState.item;
  const albumUrl = track.album?.images?.[0]?.url || "/placeholder.svg";
  const progressPercent = track.duration_ms ? (playbackState.progress_ms / track.duration_ms) * 100 : 0;

  return (
    <div
      key="1"
      className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-[#0a0f10]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0f10]/80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 px-6 py-3 transition-all duration-500"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex-shrink-0 group relative overflow-hidden rounded-md shadow-md bg-white/5">
          <img
            alt="Album Cover"
            className="rounded-md object-cover transition-transform duration-500 group-hover:scale-110"
            height={48}
            src={albumUrl}
            style={{ aspectRatio: "48/48", objectFit: "cover" }}
            width={48}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-bold text-white text-sm md:text-base leading-tight truncate hover:underline cursor-pointer">
            {track.name}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs md:text-sm truncate hover:underline cursor-pointer">
            {track.artists.map(a => a.name).join(", ")}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 md:gap-4 flex-1">
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-10 w-10 text-slate-300 hover:text-white hover:bg-white/5 rounded-full"
          onClick={() => handleAction("previous")}
        >
          <SkipBack className="w-5 h-5" fill="currentColor" />
        </Button>
        <Button 
          size="icon" 
          variant="default" 
          className="h-12 w-12 rounded-full bg-white text-black hover:scale-105 transition-transform"
          onClick={() => handleAction(playbackState.is_playing ? "pause" : "play")}
        >
          {playbackState.is_playing ? (
            <Pause className="w-5 h-5 fill-black" />
          ) : (
            <Play className="w-5 h-5 fill-black ml-1" />
          )}
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-10 w-10 text-slate-300 hover:text-white hover:bg-white/5 rounded-full"
          onClick={() => handleAction("next")}
        >
          <SkipForward className="w-5 h-5" fill="currentColor" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="hidden sm:flex text-slate-400 hover:text-white hover:bg-white/5 h-10 w-10 rounded-full ml-2">
              <Volume2 className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-12 flex flex-col items-center py-4 bg-[#0a0f10] border-white/10 p-2">
            <Slider
              className="h-24 [&>span:first-child]:w-1 [&>span:first-child]:bg-gray-200 dark:[&>span:first-child]:bg-gray-700 [&_[role=slider]]:bg-primary [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-primary [&_[role=slider]:focus-visible]:ring-0 [&_[role=slider]:focus-visible]:ring-offset-0 [&_[role=slider]:focus-visible]:scale-105 [&_[role=slider]:focus-visible]:transition-transform cursor-pointer"
              value={[playbackState.device?.volume_percent || 50]}
              onValueChange={handleVolume}
              max={100}
              orientation="vertical"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="hidden sm:flex flex-1 min-w-0 items-center justify-end pl-4">
        {/* Readonly progress slider */}
        <Slider
          className="w-full max-w-[200px] pointer-events-none [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-200 dark:[&>span:first-child]:bg-gray-700 [&_[role=slider]]:hidden [&>span:first-child_span]:bg-white opacity-80"
          value={[progressPercent || 0]}
          max={100}
        />
      </div>
      </div>
    </div>
  );
}
