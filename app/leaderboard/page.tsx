import { LeaderboardApp } from "./leaderboard-app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tokens" };

export default function LeaderboardPage() {
  return <LeaderboardApp />;
}
