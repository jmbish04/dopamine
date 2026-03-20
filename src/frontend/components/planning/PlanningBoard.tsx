import { Brain, CheckCircle2, Circle, GitBranchPlus, Hourglass, Loader2, Plus, SplitSquareVertical, Target } from "lucide-react";
import { useState } from "react";

import { Badge } from "@frontend/components/ui/badge";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Textarea } from "@frontend/components/ui/textarea";
import { Input } from "@frontend/components/ui/input";

const INITIAL_STEPS = [
  { title: "Open laptop lid", xp: 10, done: true },
  { title: "Create one blank proposal doc", xp: 15, done: true },
  { title: "Paste the three metrics that matter", xp: 20, done: false },
  { title: "Write a rough heading for each section", xp: 25, done: false },
];

export function PlanningBoard() {
  const [goal, setGoal] = useState("Break down 'Write project proposal' into tiny actions that can survive executive dysfunction.");
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [newStepLabel, setNewStepLabel] = useState("");

  const handleDecompose = () => {
    setIsDecomposing(true);
    setTimeout(() => {
      setSteps([
        { title: "Define the core objective plainly", xp: 15, done: false },
        { title: "List immediate blockers", xp: 20, done: false },
        { title: "Write the ugliest possible first draft", xp: 50, done: false },
        { title: "Send to one person for feedback", xp: 25, done: false }
      ]);
      setIsDecomposing(false);
    }, 1200);
  };

  const toggleStep = (index: number) => {
    const next = [...steps];
    next[index].done = !next[index].done;
    setSteps(next);
  };

  const handleAddStep = () => {
    if (!newStepLabel.trim()) return;
    setSteps([...steps, { title: newStepLabel.trim(), xp: 20, done: false }]);
    setNewStepLabel("");
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="flex flex-col border-onion-blue/20 bg-gradient-to-br from-onion-blue/10 via-card to-card shadow-none">
        <CardHeader>
          <Badge className="w-fit border-onion-blue/20 bg-onion-blue/10 text-onion-blue">Deep Planning</Badge>
          <CardTitle className="mt-3 text-3xl">Break the blob into moves</CardTitle>
          <CardDescription className="mt-2 text-base">
            Decompose giant terrifying tasks into micro-steps that require zero thinking to execute.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-6">
          <div className="space-y-4">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <Target className="size-4 text-onion-cyan" /> 
              Giant Terrifying Task
            </label>
            <Textarea
              className="resize-none h-28"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What feels impossible right now?"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDecompose} disabled={isDecomposing} variant="secondary" className="rounded-xl">
              {isDecomposing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Brain className="mr-2 size-4" />}
              AI Decompose
            </Button>
            <Button variant="outline" className="rounded-xl"><Hourglass className="mr-2 size-4" /> Slice under 5 mins</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col shadow-none border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <SplitSquareVertical className="size-5 text-onion-blue" />
            Execution Ladder
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center justify-between rounded-xl border p-4 transition-colors cursor-pointer ${
                  step.done ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-background/50 hover:bg-white/5"
                }`}
                onClick={() => toggleStep(index)}
              >
                <div className="flex items-start gap-4">
                  <button className="flex-shrink-0 mt-0.5 focus:outline-none">
                    {step.done ? (
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>
                  <div>
                    <p className={`font-medium ${step.done ? "text-emerald-50 line-through opacity-70" : "text-white"}`}>
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.done ? "Completed" : "Next visible move"}
                    </p>
                  </div>
                </div>
                <Badge variant={step.done ? "outline" : "secondary"} className={step.done ? "text-emerald-500 border-emerald-500/30" : ""}>
                  +{step.xp} XP
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-white/10 mt-auto">
            <Input 
              placeholder="Add a new micro-step..." 
              value={newStepLabel}
              onChange={(e) => setNewStepLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
            />
            <Button size="icon" variant="secondary" onClick={handleAddStep}>
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
