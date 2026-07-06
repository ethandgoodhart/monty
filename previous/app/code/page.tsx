import { CodeMapApp } from "./code-map-app";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Code" };

export default function CodePage() {
  return <CodeMapApp />;
}
