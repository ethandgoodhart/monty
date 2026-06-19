const features = [
  {
    title: "Live prompt feed",
    description:
      "Watch every AI interaction across your team in real time. See what engineers are asking, what code is being generated, and where AI is making the biggest impact.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
        <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM184,96a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,96Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,128Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,160Z" />
      </svg>
    ),
  },
  {
    title: "Token leaderboard",
    description:
      "Friendly competition meets real data. See who's shipping the most with AI, track usage trends, and celebrate your top builders with weekly and all-time rankings.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
        <path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z" />
      </svg>
    ),
  },
  {
    title: "Team-wide analytics",
    description:
      "Understand your AI spend at a glance. Break down token usage by engineer, project, and model. Know exactly where your budget goes and optimize accordingly.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
        <path d="M224,128a96,96,0,1,1-96-96A96.11,96.11,0,0,1,224,128Zm-96-80a80,80,0,1,0,80,80A80.09,80.09,0,0,0,128,48Zm45.66,34.34a8,8,0,0,0-11.32,0L136,108.69V72a8,8,0,0,0-16,0v36.69L93.66,82.34a8,8,0,0,0-11.32,11.32L108.69,120H72a8,8,0,0,0,0,16h36.69L82.34,162.34a8,8,0,0,0,11.32,11.32L120,147.31V184a8,8,0,0,0,16,0V147.31l26.34,26.35a8,8,0,0,0,11.32-11.32L147.31,136H184a8,8,0,0,0,0-16H147.31l26.35-26.34A8,8,0,0,0,173.66,82.34Z" />
      </svg>
    ),
  },
  {
    title: "Zero friction setup",
    description:
      "One npx command per engineer. Monty hooks into Claude Code and Codex CLI automatically. No config files, no environment variables, no workflow changes.",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
        <path d="M117.31,134l-72,64a8,8,0,1,1-10.63-12L100,128,34.69,70A8,8,0,1,1,45.32,58l72,64A8,8,0,0,1,117.31,134ZM216,184H120a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Z" />
      </svg>
    ),
  },
];

const promptFeedData = [
  { photo: "https://i.pravatar.cc/48?img=47", name: "Sarah C.", prompt: "Refactor the auth middleware to use the new JWT validation", time: "2s ago", model: "Claude", tokens: 3420 },
  { photo: "https://i.pravatar.cc/48?img=68", name: "Jake M.", prompt: "Write tests for the payment webhook handler", time: "18s ago", model: "Claude", tokens: 2891 },
  { photo: "https://i.pravatar.cc/48?img=45", name: "Priya P.", prompt: "Fix the race condition in the connection pool", time: "45s ago", model: "Codex", tokens: 1956 },
  { photo: "https://i.pravatar.cc/48?img=52", name: "Marcus W.", prompt: "Add pagination to the /api/users endpoint", time: "1m ago", model: "Claude", tokens: 4102 },
];

function LiveFeed() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-black/[0.06]">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-semibold text-[#111]">Live Feed</span>
        <span className="text-xs text-[#999] ml-auto">Streaming</span>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {promptFeedData.map((item, i) => (
          <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[#fafafa] transition-colors">
            <img src={item.photo} alt={item.name} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#111]">{item.name}</span>
                <span className="text-[11px] text-[#999]">{item.time}</span>
              </div>
              <p className="text-sm text-[#666] mt-0.5 truncate">{item.prompt}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] font-medium text-[#999] bg-[#f5f5f5] rounded px-1.5 py-0.5">{item.model}</span>
                <span className="text-[11px] text-[#bbb]">{item.tokens.toLocaleString()} tokens</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageChart() {
  const data = [40, 52, 48, 61, 55, 72, 68, 85, 78, 92, 88, 105];
  const max = Math.max(...data);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - (v / max) * 75 - 12;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-sm font-semibold text-[#111]">Team token usage</div>
          <div className="text-xs text-[#999] mt-0.5">Last 12 weeks</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-[#111] tabular-nums">47.2M</div>
          <div className="text-xs text-emerald-600 font-medium">+34% vs prior period</div>
        </div>
      </div>
      <svg viewBox="0 0 100 100" className="w-full h-36" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={`0,100 ${points} 100,100`} fill="url(#usage-gradient)" stroke="none" />
        <defs>
          <linearGradient id="usage-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#111" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between mt-2">
        {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"].map((w, i) => (
          <span key={w} className={`text-[10px] text-[#bbb] ${i > 0 && i < 11 ? "hidden sm:inline" : ""}`}>{w}</span>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="py-24">
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10">
        <h2
          className="text-[#111] max-w-2xl"
          style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          Full visibility. Zero disruption.
        </h2>
        <p className="mt-4 text-[#666] max-w-lg text-[15px] leading-relaxed">
          Monty runs silently alongside your AI tools and streams everything to a shared dashboard your whole team can see.
        </p>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveFeed />
          <UsageChart />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4">
          {["Real-time streaming", "Per-engineer breakdown", "Model-level tracking", "30s setup"].map((tag) => (
            <span key={tag} className="rounded-full border border-black/[0.06] bg-[#fafafa] px-4 py-2 text-sm text-[#666]">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-14">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#f5f5f5] text-[#666] shrink-0">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#111]">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#666]">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
