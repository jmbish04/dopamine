import { Printer, Sparkles, RefreshCw, TimerReset, CheckCircle2, ThumbsUp, ThumbsDown, Loader2, Copy, AlertCircle } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@frontend/lib/api";
import { cn } from "@frontend/lib/utils";
import { useScanner } from "@frontend/hooks/useScanner";
import type { CreateTaskInput, OpenApiDocument, Task, TaskStatus, TaskAnalytics } from "@frontend/types/api";
import { Alert, AlertDescription, AlertTitle } from "@frontend/components/ui/alert";
import { Badge } from "@frontend/components/ui/badge";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Input } from "@frontend/components/ui/input";
import { Progress } from "@frontend/components/ui/progress";
import { Textarea } from "@frontend/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@frontend/components/ui/dialog";
import { TaskAnalyticsChart } from "./TaskAnalyticsChart";
import { TaskManager } from "../TaskManager";

function fireError(summary: string, detail: unknown) {
  const message = detail instanceof Error ? detail.message
    : typeof detail === "string" ? detail
    : JSON.stringify(detail, null, 2);
  toast.error(summary, {
    description: message,
    duration: 12000,
    action: {
      label: "Copy",
      onClick: () => navigator.clipboard.writeText(`${summary}\n\n${message}`),
    },
  });
  return message;
}

const strategyCards = [
  {
    title: "Time Blindness Lab",
    description: "Use printer receipts as external anchors. Every fresh task becomes a physical breadcrumb back into the flow.",
  },
  {
    title: "Deep Planning",
    description: "Keep five layers max. Layer 1 is the visible next move. Layer 5 is the scary abstract blob that does not belong in your face.",
  },
  {
    title: "Dopamine Rewards",
    description: "Attach XP to completion so the small boring tasks still pay out immediately instead of only living in future guilt.",
  },
];

export function DashboardExperience() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [spec, setSpec] = useState<OpenApiDocument | null>(null);
  const [analytics, setAnalytics] = useState<TaskAnalytics>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState("1");
  const [xp, setXp] = useState("25");
  const [dueDate, setDueDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>("Welcome back to the useful layer...");
  const [heroImage, setHeroImage] = useState<{ id: string; prompt: string; url: string } | null>(null);
  const [loadingHero, setLoadingHero] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);

  const openCount = tasks.filter((task) => task.status !== "done").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const dopamineLevel = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 18;

  const load = async () => {
    const [nextTasks, document, nextAnalytics, heroData] = await Promise.all([
      api.listTasks(), 
      api.getOpenApiDocument(),
      api.getTaskAnalytics(),
      fetch("/api/session/hero").then(res => res.json() as any).catch(() => ({ greeting: "Welcome back to the useful layer...", image: null }))
    ]);
    setTasks(nextTasks);
    setSelectedTask((current) => current ?? nextTasks[0] ?? null);
    setSpec(document);
    setAnalytics(nextAnalytics);
    if (heroData?.greeting) setGreeting(heroData.greeting);
    if (heroData?.image) setHeroImage(heroData.image);
    setLoadingHero(false);
  };

  const handleFeedback = async (rating: "up" | "down") => {
    if (!heroImage || feedbackSent) return;
    setFeedbackSent(rating);
    try {
      await fetch("/api/session/hero/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: heroImage.id, rating })
      });
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard state.");
    });
  }, []);

  useScanner((taskId) => {
    startTransition(() => {
      api
        .getTask(taskId)
        .then((task) => {
          setSelectedTask(task);
          setTasks((current) => {
            const withoutTask = current.filter((entry) => entry.id !== task.id);
            return [task, ...withoutTask];
          });
          setScanNotice(`Scanner opened receipt ${task.id}.`);
        })
        .catch((scanError) => {
          setError(scanError instanceof Error ? scanError.message : "Scanner lookup failed.");
        });
    });
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setBusy(true);
    setError(null);

    const payload: CreateTaskInput = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      layer: Number(layer),
      xp: Number(xp),
      dueDate: dueDate || undefined,
    };

    try {
      const created = await api.createTask(payload);
      setTasks((current) => [created, ...current]);
      setSelectedTask(created);
      const notice = created.printer.ok
        ? `Receipt ${created.id} sent to the Epson printer.`
        : `Task ${created.id} saved, but the print bridge reported a failure.`;
      setScanNotice(notice);
      toast.success("Task created", { description: notice });
      setTitle("");
      setNotes("");
      setLayer("1");
      setXp("25");
      setDueDate("");
      setIsModalOpen(false);
      api.getTaskAnalytics().then(setAnalytics);
    } catch (createError) {
      const msg = fireError("Task creation failed", createError);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    setBusy(true);
    setError(null);

    try {
      const updated = await api.updateTaskStatus(task.id, status);
      setTasks((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setSelectedTask((current) => (current?.id === updated.id ? updated : current));
    } catch (updateError) {
      fireError("Task update failed", updateError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6">
        <Card className="relative onion-grid overflow-hidden rounded-[2rem] border-white/10 bg-background shadow-2xl">
          
          {/* Dynamic AI Hero Image */}
          {loadingHero && (
            <div className="absolute inset-x-0 top-0 bottom-[160px] z-0 overflow-hidden pointer-events-none rounded-t-[2rem]">
              <div className="w-full h-full bg-slate-800/20 animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-l from-background/60 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
            </div>
          )}
          {!loadingHero && heroImage && (
            <div className="absolute inset-x-0 top-0 bottom-[160px] z-0 overflow-hidden pointer-events-none rounded-t-[2rem]">
              <img
                src={heroImage.url}
                alt={heroImage.prompt}
                className="w-full h-full object-cover opacity-90 transition-opacity duration-1000"
              />
              {/* Fade edges into card background */}
              <div className="absolute inset-0 bg-gradient-to-l from-background/60 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
              
              {/* SD XL Badge */}
              <div className="absolute bottom-4 right-8 z-20 pointer-events-auto">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-2xl rounded-full px-4 py-1.5 border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)] text-white text-xs text-white/60 whitespace-nowrap">
                  Stable Diffusion XL
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-full size-7 hover:bg-green-500/30 hover:text-green-300 transition-colors ml-1",
                      feedbackSent === 'up' && "text-green-300 bg-green-500/30"
                    )}
                    onClick={() => handleFeedback('up')}
                    disabled={!!feedbackSent}
                  >
                    <ThumbsUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-full size-7 hover:bg-red-500/30 hover:text-red-300 transition-colors",
                      feedbackSent === 'down' && "text-red-300 bg-red-500/30"
                    )}
                    onClick={() => handleFeedback('down')}
                    disabled={!!feedbackSent}
                  >
                    <ThumbsDown className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <CardHeader className="p-8 relative z-10 flex flex-col justify-between min-h-[440px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl bg-black/40 p-6 rounded-[2rem] backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                <CardTitle className="text-4xl lg:text-5xl font-extrabold tracking-tight drop-shadow-lg text-white">{greeting}</CardTitle>
                <CardDescription className="mt-3 text-base text-white/80 drop-shadow font-medium leading-relaxed">
                  Capture the task, print the receipt, and let the scanner pull you back to the right card when your brain drifts.
                </CardDescription>
              </div>

              <div className="flex flex-col items-end gap-4 z-20">
                <div className="flex items-center justify-end gap-3">
                  <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-2xl shadow-lg border border-white/5" variant="secondary">
                        <Sparkles className="mr-2 size-4" />
                        New Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-white/10 bg-black/95">
                      <DialogHeader>
                        <DialogTitle>Capture</DialogTitle>
                        <DialogDescription>Dump the next useful move.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {error && (
                          <Alert variant="destructive" className="border-red-500/40 bg-red-950/60">
                            <AlertCircle className="size-4" />
                            <AlertTitle className="font-semibold">Creation failed</AlertTitle>
                            <AlertDescription className="mt-1 font-mono text-xs break-all">
                              {error}
                            </AlertDescription>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 h-7 gap-1.5 text-xs text-red-300 hover:text-red-100"
                              onClick={() => navigator.clipboard.writeText(error)}
                            >
                              <Copy className="size-3" />
                              Copy error
                            </Button>
                          </Alert>
                        )}
                        <Input
                          placeholder="Write proposal intro, pay electric bill..."
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                        />
                        <Textarea
                          placeholder="Optional context for the receipt."
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-muted-foreground">
                            <span>Task layer</span>
                            <Input max="5" min="1" type="number" value={layer} onChange={(event) => setLayer(event.target.value)} />
                          </label>
                          <label className="space-y-2 text-sm text-muted-foreground">
                            <span>XP reward</span>
                            <Input max="500" min="5" type="number" value={xp} onChange={(event) => setXp(event.target.value)} />
                          </label>
                          <label className="space-y-2 text-sm text-muted-foreground col-span-2">
                            <span>Due date (optional)</span>
                            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                          </label>
                        </div>
                        <Button disabled={busy} onClick={handleCreate} variant="secondary" className="mt-2">
                          {busy ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Printer className="mr-2 size-4" />}
                          Create and print
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl px-5 py-2.5 sm:block shadow-lg text-white">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-primary/80 font-bold">Streak</p>
                    <p className="mt-0.5 text-xl font-bold drop-shadow">{Math.max(3, doneCount + 3)} days</p>
                  </div>
                </div>
              </div>
            </div>

            {loadingHero && (
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-2xl rounded-full p-2 w-max border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)] mb-6">
                <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                <span className="text-xs text-white/50 pr-2">Constructing reality...</span>
              </div>
            )}
            <div className="mt-auto pt-12">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-white/10 bg-black/20 shadow-none text-left backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider text-slate-400">Dopamine meter</CardDescription>
                    <CardTitle className="text-4xl font-semibold text-primary">{dopamineLevel}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress className="h-2 w-full bg-white/10" value={dopamineLevel} />
                    <p className="mt-3 text-xs text-slate-400 font-medium">
                      {doneCount ? `${doneCount} completed today.` : "Print one tiny task to kick-start the loop."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-black/20 shadow-none text-left backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider text-slate-400">Open Tasks</CardDescription>
                    <CardTitle className="text-4xl font-semibold text-white">{openCount}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-400 font-medium mt-3">Tasks waiting in the queue.</p>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-black/20 shadow-none text-left backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider text-slate-400">Printed</CardDescription>
                    <CardTitle className="text-4xl font-semibold text-white">{tasks.filter((task) => task.printStatus === "sent").length}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-400 font-medium mt-3">Physical receipts mapped to reality.</p>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-black/20 shadow-none text-left backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider text-slate-400">Scanner</CardDescription>
                    <CardTitle className="text-4xl font-semibold text-white">Ready</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-400 font-medium mt-3">USB wedge listening for code.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <TaskManager />
        <TaskAnalyticsChart data={analytics} />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-onion-orange/20 bg-gradient-to-br from-onion-orange/12 via-card/95 to-card/70">
            <CardHeader>
              <p className="onion-kicker">Receipt spotlight</p>
              <CardTitle className="mt-3">Scanner target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTask ? (
                <>
                  <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Receipt id</p>
                    <p className="mt-3 text-4xl font-semibold tracking-[0.18em] text-white">{selectedTask.id}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/10 text-white">{selectedTask.status}</Badge>
                      <Badge className="border-white/10 bg-white/10 text-white">{selectedTask.printStatus}</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">{selectedTask.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedTask.notes ?? "No extra notes on this slip."}</p>
                  </div>
                  <div className="grid gap-2">
                    <Button variant="secondary" onClick={() => handleStatusChange(selectedTask, "in_progress")}>
                      <TimerReset className="size-4" />
                      Start focus loop
                    </Button>
                    <Button variant="outline" onClick={() => handleStatusChange(selectedTask, "done")}>
                      <CheckCircle2 className="size-4" />
                      Mark complete
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs text-muted-foreground">
                    QR deep link: <span className="text-white">{selectedTask.receiptQrValue}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Create or scan a task to populate the receipt spotlight.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="onion-kicker">ADHD system notes</p>
              <CardTitle className="mt-3">Why the physical loop matters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {strategyCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-white/10 bg-background/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-onion-cyan">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{card.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}