import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Line, LineChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@frontend/components/ui/chart";
import type { TaskAnalytics } from "@frontend/types/api";

const chartConfig = {
  xpEarned: {
    label: "XP Earned (Dopamine)",
    color: "oklch(0.696 0.17 162.48)", // onion-cyan roughly
  },
  completed: {
    label: "Tasks Done",
    color: "oklch(0.645 0.246 16.439)", // emerald
  },
  added: {
    label: "Tasks Added",
    color: "oklch(0.488 0.243 264.376)", // onion-blue
  },
} satisfies ChartConfig;

export function TaskAnalyticsChart({ data }: { data: TaskAnalytics }) {
  if (!data || data.length === 0) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/10 bg-black/20 h-[350px] animate-pulse flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading Momentum Data...</p>
        </Card>
        <Card className="border-white/10 bg-black/20 h-[350px] animate-pulse flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading Action Metrics...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle>Momentum & Dopamine</CardTitle>
          <CardDescription>XP earned validates the completed effort. Follow the dopamine.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" strokeWidth={3} dataKey="xpEarned" stroke="var(--color-xpEarned)" dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle>Action vs Scope</CardTitle>
          <CardDescription>See if you're taking on more tasks than you're clearing.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="added" fill="var(--color-added)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
