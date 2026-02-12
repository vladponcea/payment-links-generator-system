"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import { Trophy, Medal, Award } from "lucide-react";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  closerId: string;
  closerName: string;
  revenue: number;
  sales: number;
}

interface LeaderboardProps {
  from: string;
  to: string;
}

export function Leaderboard({ from, to }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useUser();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, leaderboard: "true" });
    fetch(`/api/analytics/by-closer?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 0:
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 1:
        return <Medal className="w-4 h-4 text-gray-300" />;
      case 2:
        return <Award className="w-4 h-4 text-amber-600" />;
      default:
        return (
          <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-cyber-muted">
            {rank + 1}
          </span>
        );
    }
  };

  const getRankStyle = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "border-cyber-cyan/40 bg-cyber-cyan/5";
    }
    switch (rank) {
      case 0:
        return "border-yellow-400/30 bg-yellow-400/5";
      case 1:
        return "border-gray-300/20 bg-gray-300/5";
      case 2:
        return "border-amber-600/20 bg-amber-600/5";
      default:
        return "border-cyber-border bg-cyber-black";
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
          Leaderboard
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-cyber-muted text-sm">
          No closer data yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((entry, index) => {
            const isCurrentUser = entry.closerId === currentUser?.userId;
            return (
              <div
                key={entry.closerId}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getRankStyle(index, isCurrentUser)}`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-6 flex justify-center">
                  {getRankIcon(index)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? "text-cyber-cyan" : "text-white"}`}>
                      {entry.closerName}
                    </p>
                    {isCurrentUser && (
                      <span className="text-[10px] uppercase tracking-wider text-cyber-cyan bg-cyber-cyan/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-cyber-muted">
                    {entry.sales} {entry.sales === 1 ? "close" : "closes"}
                  </p>
                </div>

                {/* Revenue */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold font-[family-name:var(--font-jetbrains)] text-white">
                    {formatCurrency(entry.revenue)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
