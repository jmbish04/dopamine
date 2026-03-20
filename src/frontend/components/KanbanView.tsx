import React, { useState } from "react";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "./kibo-ui/kanban";
import { api } from "@frontend/lib/api";
import type { TaskStatus } from "@frontend/types/api";

// Mock data definitions matching the kibo-ui format
type KanbanColumn = {
  id: string;
  name: string;
};

type KanbanItem = {
  id: string;
  name: string;
  column: TaskStatus;
};

const initialColumns: KanbanColumn[] = [
  { id: "open", name: "Planned" },
  { id: "in_progress", name: "In Progress" },
  { id: "paused", name: "Paused" },
  { id: "done", name: "Done" },
];

export const KanbanView = () => {
  const [data, setData] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScannedTask, setActiveScannedTask] = useState<{ id: string; action: string } | null>(null);

  const fetchTasks = () => {
    api.listTasks().then((tasks) => {
      tasks.sort((a, b) => {
        if (a.position === b.position) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return a.position - b.position;
      });
      
      const items: KanbanItem[] = tasks.map((t) => ({
        id: t.id,
        name: t.title,
        column: t.status,
      }));
      setData(items);
      setLoading(false);
    });
  };

  React.useEffect(() => {
    // 1) Fetch initial tasks
    fetchTasks();

    // 2) Establish Scanner WebSocket from Hardware Hub DO
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/printer/ws?client=ui`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "scan_event" && payload.taskId) {
          console.log("Hardware Barcode Scanner Triggered Task ID:", payload.taskId);
          
          setActiveScannedTask({ id: payload.taskId, action: "focus" });
          
          setTimeout(() => {
            setActiveScannedTask(null);
          }, 5000);
        } else if (payload.type === "ui_sync" && payload.taskId) {
          console.log("Tactile Control Pad Sync:", payload);
          setActiveScannedTask({ id: payload.taskId, action: payload.action });
          
          setTimeout(() => {
            setActiveScannedTask(null);
          }, 5000);
          
          // Refresh the board to grab updated in_progress, paused, timestamps
          fetchTasks();
        }
      } catch (err) {
        console.error("Failed to parse websocket hardware payload", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleDataChange = async (newData: KanbanItem[]) => {
    // Optimistically update UI
    setData(newData);

    // Map newData back to the sync payload shape needed
    const payload = newData.map((item, index) => ({
      id: item.id,
      status: item.column,
      position: index,
    }));

    try {
      await api.updateTaskOrder(payload);
    } catch (e) {
      console.error("Failed to sync task order", e);
    }
  };

  if (loading) {
    return <div className="w-full p-4 flex justify-center text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] p-4 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Kanban</h2>
          <p className="text-muted-foreground text-sm">
            Manage your project schedule and track tasks. Hardware scanners sync real-time here.
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
              <KanbanCards id={column.id} className="bg-muted/10">
                {(item) => (
                  <KanbanCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    column={item.column}
                    className={`transition-all duration-300 shadow-sm border border-border ${
                      activeScannedTask?.id === item.id 
                        ? activeScannedTask.action === "play" ? "ring-2 ring-emerald-500 bg-emerald-500/20 scale-[1.02]"
                        : activeScannedTask.action === "pause" ? "ring-2 ring-amber-500 bg-amber-500/20 scale-[1.02]"
                        : activeScannedTask.action === "done" ? "ring-2 ring-blue-500 bg-blue-500/20 scale-[1.02]"
                        : "ring-2 ring-primary bg-primary/20 scale-[1.02]" 
                        : "hover:border-primary/50 bg-card text-card-foreground"
                    }`}
                  />
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  );
};

export default KanbanView;
