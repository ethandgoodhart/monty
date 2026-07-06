import { LiveFeedApp } from "@/app/components/live-feed-app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live" };

export default function FeedPage() {
  return <LiveFeedApp />;
}
