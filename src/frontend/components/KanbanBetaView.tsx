import React, { useState, useEffect, startTransition } from "react";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "./kibo-ui/kanban";
import { api } from "@frontend/lib/api";
import { cn } from "@frontend/lib/utils";
import { Badge } from "@frontend/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@frontend/components/ui/dialog";
import { Button } from "@frontend/components/ui/button";
import { Printer, X, Play, Pause, CheckCircle2, History, RotateCcw } from "lucide-react";
import { DateTime } from "luxon";
import { useScanner } from "@frontend/hooks/useScanner";
import type { Task, TaskStatus } from "@frontend/types/api";

type KanbanColumn = {
  id: string;
  name: string;
};

const initialColumns: KanbanColumn[] = [
  { id: "open", name: "Planned" },
  { id: "in_progress", name: "In Progress" },
  { id: "paused", name: "Paused" },
  { id: "done", name: "Done" },
];

export const KanbanBetaView = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScannedTask, setActiveScannedTask] = useState<{ id: string; action: string } | null>(null);
  const [activeDetailTask, setActiveDetailTask] = useState<Task | null>(null);
  const [reprinting, setReprinting] = useState(false);

  const fetchTasks = () => {
    api.listTasks().then((fetchedTasks) => {
      fetchedTasks.sort((a, b) => {
        if (a.position === b.position) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return a.position - b.position;
      });
      setTasks(fetchedTasks);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTasks();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/printer/ws?client=ui`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "scan_event" && payload.taskId) {
          setActiveScannedTask({ id: payload.taskId, action: "focus" });
          setTimeout(() => setActiveScannedTask(null), 5000);
        } else if (payload.type === "ui_sync" && payload.taskId) {
          setActiveScannedTask({ id: payload.taskId, action: payload.action });
          setTimeout(() => setActiveScannedTask(null), 5000);
          fetchTasks();
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, []);

  useScanner((taskId) => {
    startTransition(() => {
      api.getTask(taskId).then((task) => {
        setTasks((current) => {
          const withoutTask = current.filter((entry) => entry.id !== task.id);
          return [task, ...withoutTask];
        });
        setActiveScannedTask({ id: taskId, action: "focus" });
        setTimeout(() => setActiveScannedTask(null), 5000);
      }).catch(() => {});
    });
  });

  const handleDataChange = async (newData: any[]) => {
    // Determine moved tasks
    const updatedTasks = newData.map((item, index) => {
      const originalTask = tasks.find(t => t.id === item.id);
      return {
        ...originalTask,
        status: item.column as TaskStatus,
        position: index,
        id: item.id
      } as Task;
    });

    setTasks(updatedTasks);
    
    try {
      const payload = updatedTasks.map((t) => ({
        id: t.id,
        status: t.status,
        position: t.position
      }));
      await api.updateTaskOrder(payload);
    } catch (e) {
      console.error("Failed to sync task order", e);
    }
  };

  const handleReprint = async (task: Task) => {
    setReprinting(true);
    try {
      // Re-trigger the webhook or recreate as needed? 
      // For now we will update the task to trigger a re-print (or we can just call an api if we had a dedicated print route)
      // Since createTask triggers print, we'll implement a simple status update to queue it.
      await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status })
      });
      // Optionally wait a tick
      fetchTasks();
    } finally {
      setTimeout(() => setReprinting(false), 1000);
    }
  };

  if (loading) {
    return <div className="w-full p-4 flex justify-center text-muted-foreground">Loading tasks...</div>;
  }

  // Format data for kibo-ui
  const data = tasks.map((t) => ({
    id: t.id,
    name: t.title,
    column: t.status,
    taskData: t // pass original data
  }));

  return (
    <div className="w-full h-[calc(100vh-8rem)] p-4 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Kanban Beta</h2>
          <p className="text-muted-foreground text-sm">
            Manage your project schedule with detailed cards and real-time hardware sync.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-background/50 rounded-xl border border-border shadow-sm p-4 backdrop-blur-sm">
        <KanbanProvider
          columns={initialColumns}
          data={data}
          onDataChange={handleDataChange}
        >
          {(column) => (
            <KanbanBoard key={column.id} id={column.id}>
              <KanbanHeader className="bg-muted/50 rounded-t-lg font-bold border-b border-border text-foreground py-3">
                {column.name}
              </KanbanHeader>
              <KanbanCards id={column.id} className="bg-muted/10 p-4 gap-3">
                {(item) => {
                  const task = item.taskData as Task;
                  const isScanned = activeScannedTask?.id === item.id;
                  
                  return (
                    <KanbanCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      column={item.column}
                      className={cn(
                        "transition-all duration-300 shadow-xl border bg-black/40 backdrop-blur-md text-card-foreground rounded-xl p-4 cursor-pointer",
                        isScanned && activeScannedTask.action === "play" && "ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/50 scale-[1.02]",
                        isScanned && activeScannedTask.action === "pause" && "ring-2 ring-amber-500 bg-amber-500/10 border-amber-500/50 scale-[1.02]",
                        isScanned && activeScannedTask.action === "done" && "ring-2 ring-blue-500 bg-blue-500/10 border-blue-500/50 scale-[1.02]",
                        isScanned && activeScannedTask.action === "focus" && "ring-2 ring-primary bg-primary/10 border-primary/50 scale-[1.02]",
                        !isScanned && "border-white/10 hover:border-primary/50 hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex flex-col gap-3" onClick={() => setActiveDetailTask(task)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 w-fit">
                                L{task.layer} Task
                             </span>
                            <p className="font-medium text-slate-100 leading-tight line-clamp-2">{task.title}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {task.id}
                            </p>
                          </div>
                        </div>
                        {task.notes && (
                          <div className="text-xs text-muted-foreground bg-white/5 border border-white/5 p-2 rounded-lg line-clamp-2">
                            {task.notes}
                          </div>
                        )}
                         <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <div className="flex items-center gap-1.5 text-xs text-accent-amber">
                               <span className="text-[10px] font-bold tracking-wider">+{task.xp} XP</span>
                            </div>
                            <Badge
                              className={cn(
                                task.printStatus === "sent" && "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
                                task.printStatus === "failed" && "border-red-400/20 bg-red-400/10 text-red-300",
                                task.printStatus === "queued" && "border-white/10 bg-white/5 text-muted-foreground",
                              )}
                            >
                              {task.printStatus}
                            </Badge>
                         </div>
                      </div>
                    </KanbanCard>
                  );
                }}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>

      <Dialog open={!!activeDetailTask} onOpenChange={(open) => !open && setActiveDetailTask(null)}>
        <DialogContent className="border-white/10 bg-[#0a0f10] text-slate-100 max-w-md p-0 overflow-hidden sm:rounded-[2rem]">
          {activeDetailTask && (
            <div className="flex flex-col max-h-[85vh]">
              {/* Header Section */}
              <div className="sticky top-0 z-10 bg-[#0a0f10]/80 backdrop-blur-md border-b border-primary/20 px-6 py-4 flex items-center justify-between">
                 <div>
                    <h2 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Task Detail</h2>
                    <p className="text-sm font-mono text-primary">#{activeDetailTask.id}</p>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(13,204,242,0.3)]">
                    <span className="size-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      {activeDetailTask.status.replace("_", " ")}
                    </span>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Title & Reward Section */}
                <section>
                  <DialogTitle className="text-3xl font-display font-bold leading-tight mb-4 text-slate-50">
                    {activeDetailTask.title}
                  </DialogTitle>
                  <DialogDescription className="sr-only">{activeDetailTask.title}</DialogDescription>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <span className="text-sm font-bold text-orange-500 uppercase tracking-tighter">XP REWARD: +{activeDetailTask.xp} XP</span>
                  </div>
                </section>
                
                {/* Metadata Grid */}
                <section className="grid grid-cols-2 gap-px bg-primary/10 rounded-xl overflow-hidden border border-primary/20">
                  <div className="bg-[#0a0f10] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Layer</p>
                    <p className="text-sm font-medium">{activeDetailTask.layer}</p>
                  </div>
                  <div className="bg-[#0a0f10] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Due Date</p>
                    <p className="text-sm font-medium">
                      {activeDetailTask.dueDate ? DateTime.fromISO(activeDetailTask.dueDate).toFormat("MMM dd, yyyy") : "None"}
                    </p>
                  </div>
                  <div className="bg-[#0a0f10] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Created</p>
                    <p className="text-sm font-medium text-slate-400">
                       {DateTime.fromISO(activeDetailTask.createdAt).toFormat("MMM dd, HH:mm")}
                    </p>
                  </div>
                  <div className="bg-[#0a0f10] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Time Spent</p>
                    <p className="text-sm font-medium text-slate-400">
                      {Math.floor((activeDetailTask.timeSpent || 0) / 60)} min
                    </p>
                  </div>
                </section>

                {/* Description Area */}
                {activeDetailTask.notes && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 px-1">Notes / Description</h3>
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 min-h-[100px]">
                      <p className="text-sm leading-relaxed text-slate-300 break-words whitespace-pre-wrap">
                        {activeDetailTask.notes}
                      </p>
                    </div>
                  </section>
                )}

                {/* Primary Action */}
                <section>
                  <Button 
                    onClick={() => handleReprint(activeDetailTask)}
                    disabled={reprinting}
                    className="w-full bg-primary hover:bg-primary/90 text-black font-bold h-14 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(13,204,242,0.2)]"
                  >
                    {reprinting ? <RotateCcw className="animate-spin" size={20} /> : <Printer size={20} />}
                    <span className="uppercase tracking-widest text-sm">
                      {reprinting ? "Dispatching..." : "Re-print Receipt"}
                    </span>
                  </Button>
                </section>

                {/* Hardware Activity Timeline (Mock/Simple mapping) */}
                <section className="pb-4">
                  <div className="flex items-center justify-between mb-6 px-1">
                    <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Hardware History</h3>
                    <History className="text-slate-500 size-4" />
                  </div>
                  <div className="space-y-6">
                    {activeDetailTask.printStatus === "sent" && (
                      <div className="flex gap-4 items-start relative">
                         {/* Connecting Line */}
                        <div className="absolute left-[11px] top-6 -bottom-6 w-px bg-white/10"></div>
                        <div className="size-6 rounded-full border-2 border-slate-600 bg-[#0a0f10] flex items-center justify-center z-10 shrink-0 mt-1">
                          <div className="size-2 rounded-full bg-slate-600"></div>
                        </div>
                        <div className="flex-1 bg-white/5 p-3 rounded-lg border-l-2 border-l-slate-600">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[11px] font-bold text-slate-400 uppercase">Printed Receipt</p>
                            <span className="text-[10px] text-slate-500 font-medium tracking-tight">System</span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic mt-1">Thermal Printer dispatched.</p>
                        </div>
                      </div>
                    )}
                    
                    {activeDetailTask.status === "in_progress" && (
                      <div className="flex gap-4 items-start relative">
                        <div className="absolute left-[11px] top-6 -bottom-6 w-px bg-white/10"></div>
                        <div className="size-6 rounded-full border-2 border-emerald-500 bg-[#0a0f10] flex items-center justify-center z-10 shrink-0 mt-1">
                          <div className="size-2 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className="flex-1 bg-emerald-500/5 p-3 rounded-lg border-l-2 border-l-emerald-500">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[11px] font-bold text-emerald-500 uppercase">Scanned as PLAY</p>
                            <span className="text-[10px] text-emerald-500/70 font-medium tracking-tight">Active</span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic mt-1">Physical Scanner Trigger.</p>
                        </div>
                      </div>
                    )}

                    {activeDetailTask.status === "paused" && (
                      <div className="flex gap-4 items-start relative">
                        <div className="size-6 rounded-full border-2 border-amber-500 bg-[#0a0f10] flex items-center justify-center z-10 shrink-0 mt-1">
                          <div className="size-2 rounded-full bg-amber-500"></div>
                        </div>
                        <div className="flex-1 bg-amber-500/5 p-3 rounded-lg border-l-2 border-l-amber-500">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[11px] font-bold text-amber-500 uppercase">Scanned as PAUSE</p>
                            <span className="text-[10px] text-amber-500/70 font-medium tracking-tight">Timer Stopped</span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic mt-1">Session preserved.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
