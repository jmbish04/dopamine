import {
  Headphones,
  Trees,
  Palette,
  Trophy,
  Loader2,
  Sparkles,
  Coins,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useState, useEffect } from "react";

import { api } from "@frontend/lib/api";
import type { Reward } from "@frontend/types/api";

import { Badge } from "@frontend/components/ui/badge";
import { Button } from "@frontend/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card";
import { Progress } from "@frontend/components/ui/progress";

export function RewardsStore() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [xp, setXp] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [rewardsData, xpData] = await Promise.all([
          api.listRewards(),
          api.getUserXp(),
        ]);
        setRewards(rewardsData);
        setXp(xpData.xp);
      } catch (err) {
        console.error("Failed to load rewards", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleRedeem = async (id: string, cost: number) => {
    setRedeeming(id);
    try {
      const res = await api.redeemReward(id);
      if (res.success) {
        setXp(res.newXp);
      }
    } catch (err) {
      console.error("Failed to redeem", err);
    } finally {
      setRedeeming(null);
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case "Headphones":
        return Headphones;
      case "Trees":
        return Trees;
      case "Palette":
        return Palette;
      default:
        return Trophy;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground tracking-widest uppercase">
            Syncing XP Ledger...
          </span>
        </div>
      </div>
    );
  }

  // Calculate generic progression against the most expensive unlocked item
  const maxCost = Math.max(...rewards.map((r) => r.cost), 1000);
  const progressRatio = Math.min((xp / maxCost) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-black/40 p-8 pt-10 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="text-center lg:text-left flex-1">
            <Badge className="border-primary/20 bg-primary/10 text-primary mb-6 hover:bg-primary/20 transition-colors uppercase tracking-[0.2em] font-bold px-4 py-1">
              Neural Marketplace
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-none mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              Dopamine{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-600">
                Store
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 font-medium">
              Transform raw focus hours into tangible reality. Close the
              motivation gap by trading execution velocity for immediate
              environmental augmentations.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center shrink-0 rounded-[2rem] border border-white/10 bg-black/60 p-8 shadow-[0_0_50px_rgba(13,204,242,0.15)] backdrop-blur-2xl w-full lg:w-auto relative group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]" />
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80 font-bold mb-2 flex items-center gap-2">
              <Coins className="h-4 w-4" /> Available Balance
            </p>
            <p className="text-7xl font-black text-white tracking-tighter drop-shadow-md">
              {xp}
            </p>
            <div className="w-full mt-6 flex flex-col gap-2">
              <Progress value={progressRatio} className="h-2 bg-white/10" />
              <div className="flex justify-between w-full text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                <span>0 XP</span>
                <span>{maxCost} XP Target</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Rewards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rewards.map((reward) => {
          const Icon = getIcon(reward.icon);
          const canAfford = xp >= reward.cost;
          const isRedeeming = redeeming === reward.id;

          // Compute contextual styling arrays
          const cardBorder =
            canAfford && !reward.locked
              ? "border-primary/30"
              : "border-white/5";
          const cardShadow =
            canAfford && !reward.locked
              ? "shadow-[0_0_30px_rgba(13,204,242,0.1)]"
              : "shadow-lg";
          const iconBg =
            canAfford && !reward.locked
              ? "bg-primary/20 text-primary border-primary/30"
              : "bg-white/5 text-slate-500 border-white/10";
          const highlightOpacity =
            canAfford && !reward.locked ? "opacity-100" : "opacity-0";

          return (
            <Card
              key={reward.id}
              className={`group relative overflow-hidden flex flex-col justify-between rounded-2xl bg-black/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 ${cardBorder} ${cardShadow}`}
            >
              {/* Dynamic Gradient Overlay */}
              <div
                className={`absolute -inset-[100%] bg-gradient-to-br from-primary/10 via-transparent to-transparent ${highlightOpacity} transition-opacity duration-700 pointer-events-none`}
              />

              <CardHeader className="relative z-10 p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-4 rounded-xl border backdrop-blur-sm transition-colors duration-300 ${iconBg}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  {reward.locked ? (
                    <Badge
                      variant="outline"
                      className="bg-black/50 border-white/10 text-slate-400 gap-1 pr-3"
                    >
                      <Lock className="h-3 w-3" /> Locked
                    </Badge>
                  ) : (
                    <Badge
                      className={`px-3 py-1 font-bold ${canAfford ? "bg-primary text-black" : "bg-white/10 text-white"}`}
                    >
                      {reward.cost} XP
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                  {reward.title}
                </CardTitle>
                <CardDescription className="text-sm mt-3 text-slate-400 font-medium leading-relaxed">
                  {reward.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="relative z-10 p-6 pt-4 mt-auto border-t border-white/5 bg-black/20">
                <Button
                  className={`w-full font-bold transition-all duration-300 ${
                    canAfford && !reward.locked
                      ? "bg-primary hover:bg-primary/90 text-black shadow-[0_0_15px_rgba(13,204,242,0.4)]"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                  disabled={reward.locked || !canAfford || redeeming !== null}
                  onClick={() => handleRedeem(reward.id, reward.cost)}
                  variant={
                    canAfford && !reward.locked ? "default" : "secondary"
                  }
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Processing
                    </>
                  ) : reward.locked ? (
                    "Milestone Locked"
                  ) : !canAfford ? (
                    `Need ${reward.cost - xp} XP`
                  ) : (
                    <>
                      Aquire Asset{" "}
                      <ArrowRight className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl border-white/10 bg-black/20 backdrop-blur-sm p-6 overflow-hidden relative">
        <Sparkles className="absolute -right-10 -top-10 h-40 w-40 text-primary/5 blur-2xl" />
        <CardHeader className="p-0 mb-3">
          <CardTitle className="flex items-center gap-3 text-lg text-white font-bold">
            <Trophy className="h-5 w-5 text-primary" /> Psychological Protocol
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 text-sm text-slate-400 font-medium max-w-3xl leading-relaxed">
          Rewards work exclusively when they trigger immediate, visible, and
          emotionally believable reinforcement loops. This architecture exists
          specifically to intercept the latency between execution effort and
          future gratification, short-circuiting burnout.
        </CardContent>
      </Card>
    </div>
  );
}
