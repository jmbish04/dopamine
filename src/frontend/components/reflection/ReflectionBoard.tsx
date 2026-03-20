import { NotebookPen, PartyPopper, Send, SunMedium, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

import { api } from "@frontend/lib/api";
import type { Reflection } from "@frontend/types/api";

import { Badge } from "@frontend/components/ui/badge";
import { Button } from "@frontend/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { Textarea } from "@frontend/components/ui/textarea";

const DEFAULT_PROMPTS = [
  "What made momentum easier today?",
  "What caused friction?",
  "What is the smallest useful start for tomorrow?"
];

export function ReflectionBoard() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function fetchReflections() {
      try {
        const data = await api.listReflections();
        setReflections(data);
      } catch (err) {
        console.error("Failed to load reflections", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReflections();
  }, []);

  const handleAnswerChange = (prompt: string, value: string) => {
    setAnswers({ ...answers, [prompt]: value });
  };

  const handleSubmit = async () => {
    const filledPrompts = Object.keys(answers).filter(k => answers[k] && answers[k].trim() !== "");
    if (filledPrompts.length === 0) return;
    
    setSubmitting(true);

    try {
      const results = await Promise.all(
        filledPrompts.map(prompt => api.createReflection({ prompt, answer: answers[prompt] }))
      );
      // results might come back out of order compared to reflections, but it's fine.
      setReflections([...results, ...reflections]);
      setAnswers({});
    } catch (err) {
      console.error("Failed to submit reflection", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="overflow-hidden border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-card to-card flex flex-col h-full">
        <CardHeader>
          <Badge className="w-fit border-emerald-400/20 bg-emerald-400/10 text-emerald-300">End-of-day reflection</Badge>
          <CardTitle className="mt-3 text-4xl">Close the loop before the next spiral starts</CardTitle>
          <CardDescription className="mt-2 text-base">
            Reflection is for preserving wins and reducing overnight guilt, not for writing a self-indictment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-white/10 bg-background/45 p-5">
            <div className="flex items-center gap-3">
              <PartyPopper className="size-5 text-emerald-300" />
              <div>
                <p className="font-medium text-white">Three wins</p>
                <p className="text-sm text-muted-foreground mt-1">Finished a receipt loop, handled the admin task, and protected one focus block.</p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-background/45 p-5">
            <div className="flex items-center gap-3">
              <SunMedium className="size-5 text-onion-orange" />
              <div>
                <p className="font-medium text-white">Tomorrow anchor</p>
                <p className="text-sm text-muted-foreground mt-1">Print the first task before opening Slack.</p>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-6 pt-4 border-t border-white/10">
            <h3 className="font-semibold text-lg text-white">Journal Prompts</h3>
            {DEFAULT_PROMPTS.map((prompt, idx) => (
              <div key={idx} className="space-y-3">
                <p className="text-sm font-medium text-emerald-300">{prompt}</p>
                <div className="relative">
                  <Textarea 
                    value={answers[prompt] || ""}
                    onChange={(e) => handleAnswerChange(prompt, e.target.value)}
                    placeholder="Write your thoughts..." 
                    className="min-h-24 resize-none"
                  />
                </div>
              </div>
            ))}
            
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSubmit}
                disabled={submitting || Object.values(answers).every(v => !v.trim())}
                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Save Reflections
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col h-full border-white/10 bg-black/20 max-h-[800px]">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NotebookPen className="size-5 text-emerald-300" /> 
              Previous Logs
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {loading ? (
             <div className="p-8 text-center text-sm text-muted-foreground flex justify-center items-center h-full">
               <Loader2 className="mr-2 size-4 animate-spin" /> Loading entries...
             </div>
          ) : reflections.length === 0 ? (
             <div className="p-8 text-center text-sm text-muted-foreground">
               No reflections recorded yet. Your mind is a blank slate.
             </div>
          ) : (
            <div className="divide-y divide-white/5">
              {reflections.map((ref) => (
                <div key={ref.id} className="p-6 space-y-3 hover:bg-white/5 transition-colors">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                    {new Date(ref.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-sm font-medium text-white">{ref.prompt}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ref.answer}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
