import { Pause, Play, Square, Timer, Zap } from "lucide-react";
import { useState, useEffect } from "react";

import { Badge } from "@frontend/components/ui/badge";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@frontend/components/ui/dialog";

export function FocusModePanel() {
  const DEFAULT_TIME = 45 * 60; // 45 minutes
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(DEFAULT_TIME);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="w-full">
      <Card className="overflow-hidden border-onion-cyan/20 bg-gradient-to-br from-onion-cyan/10 via-card to-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <Badge className="w-fit border-onion-cyan/20 bg-onion-cyan/10 text-onion-cyan">Active Focus Mode</Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-onion-cyan hover:bg-onion-cyan/10 hover:text-onion-cyan h-8 rounded-full border border-onion-cyan/20">
                  <Timer className="size-4 mr-2" />
                  Focus Ritual
                </Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-black/95">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Timer className="size-5 text-onion-cyan" /> Focus ritual</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground pt-4">
                  <div className="rounded-2xl border border-white/10 bg-background/50 p-4">Receipt on desk, phone face down, one visible browser tab.</div>
                  <div className="rounded-2xl border border-white/10 bg-background/50 p-4">Timer starts only after the first sentence or first commit exists.</div>
                  <div className="rounded-2xl border border-white/10 bg-background/50 p-4">If the brain stalls, reduce scope, not self-respect.</div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <CardTitle className="mt-3 text-4xl">Deep work receipt in progress</CardTitle>
          <CardDescription className="mt-2 max-w-2xl text-base">
            This view translates the Stitch focus screen into the shadcn shell: one clear objective, one timer, and zero extra cognitive branches.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="relative flex size-[260px] md:size-[300px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-background/50 shadow-cyan">
              <div className="absolute inset-4 rounded-full border border-onion-cyan/20"></div>
              <div className="text-center z-10">
                <p className="text-5xl md:text-6xl font-semibold tracking-tight text-white">{timeString}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.4em] text-onion-cyan">focus time</p>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Button size="icon" variant="outline" onClick={resetTimer}><Square className="size-4" /></Button>
              {isRunning ? (
                 <Button size="icon" variant="outline" onClick={toggleTimer}><Pause className="size-4" /></Button>
              ) : (
                 <Button size="icon" variant="outline" onClick={toggleTimer}><Play className="size-4" /></Button>
              )}
              <Button className="rounded-2xl px-6" variant="secondary"><Zap className="mr-2 size-4" /> Complete sprint</Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-background/45 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current focus</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Draft the executive summary</h2>
              <p className="mt-3 text-base text-muted-foreground">
                Do not perfect it. Produce a rough doc with Q3 metrics, slack the link, and let future-you edit from a base.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-onion-cyan/20 bg-onion-cyan/10 p-5">
              <div className="flex items-center gap-3">
                <Zap className="size-5 text-onion-cyan" />
                <div>
                  <p className="font-medium text-white">Minimal deliverable</p>
                  <p className="text-sm text-muted-foreground">One page shared in Slack beats a perfect doc trapped in your head.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-background/45 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Session streak</p>
                <p className="mt-3 text-3xl font-semibold text-white">4 loops</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background/45 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Reward on finish</p>
                <p className="mt-3 text-3xl font-semibold text-white">+120 XP</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
