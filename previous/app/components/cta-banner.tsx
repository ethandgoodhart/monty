"use client";

import { useState } from "react";

const INSTALL_CMD = "npx monty-cli install";

export function CtaBanner() {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-[480px] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[#fafafa]" />
      <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-20 text-center">
        <h2
          className="text-[#111] max-w-4xl"
          style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", lineHeight: 1.15, fontWeight: 600 }}
        >
          Know what your team is building with AI.
        </h2>
        <p className="text-[#666] max-w-md text-[15px] leading-relaxed mt-2">
          Set up your whole team in under five minutes. Free while in beta.
        </p>
        <button
          onClick={handleClick}
          className="mt-4 inline-flex shrink-0 items-center text-sm font-medium hover:opacity-85 transition-opacity h-11 bg-[#111] text-white rounded-[10px] px-5 cursor-pointer"
        >
          {copied ? "Copied!" : "Install Monty"}
        </button>
      </div>
    </section>
  );
}
