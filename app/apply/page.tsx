import type { Metadata } from "next";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply · Monterey Select",
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  return <ApplyForm />;
}
