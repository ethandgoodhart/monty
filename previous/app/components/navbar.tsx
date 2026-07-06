"use client";

import Link from "next/link";
import { useState } from "react";
import { MontyLogo, GitHubIcon } from "./icons";

const INSTALL_CMD = "npx monty-cli install";

export function Navbar() {
  const [copied, setCopied] = useState(false);

  const handleInstallClick = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-black/[0.06]">
      <nav className="mx-auto flex h-[5.25rem] max-w-[1280px] items-center gap-4 px-6 lg:px-10">
        <div className="flex flex-1 items-center gap-6">
          <Link href="/" className="flex items-center"><MontyLogo /></Link>
          <div className="hidden sm:flex items-center gap-4 text-sm ml-2">
            <Link href="/feed" className="text-[#999] hover:text-[#111] font-medium transition-colors">Live</Link>
            <Link href="/leaderboard" className="text-[#999] hover:text-[#111] font-medium transition-colors">Tokens</Link>
            <Link href="/code" className="text-[#999] hover:text-[#111] font-medium transition-colors">Code</Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-5">
          <a href="#" className="hidden items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#111] hover:bg-black/5 lg:inline-flex h-[35px]">
            <GitHubIcon />
            <span className="tabular-nums">2.4k</span>
          </a>
          <button
            onClick={handleInstallClick}
            className="inline-flex shrink-0 items-center text-sm font-medium hover:opacity-85 transition-opacity h-[35px] bg-[#111] text-white rounded-[10px] px-3 cursor-pointer"
          >
            {copied ? "Copied!" : "Install"}
          </button>
        </div>
      </nav>
    </header>
  );
}
