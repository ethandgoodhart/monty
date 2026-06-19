const steps = [
  {
    number: "01",
    title: "Install per engineer",
    description:
      "Each engineer runs one command. Monty hooks into Claude Code and Codex CLI automatically — no config, no env vars, no workflow changes.",
    detail: "$ npx monty-cli install",
  },
  {
    number: "02",
    title: "Code as usual",
    description:
      "Engineers keep working exactly as before. Monty silently captures prompts, responses, and token counts in the background. Nothing changes about how they code.",
  },
  {
    number: "03",
    title: "Open the dashboard",
    description:
      "Your team's live feed and leaderboard are ready instantly. See who's building what, track token spend, and discover how AI is accelerating your engineering org.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-[#fafafa] py-24">
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10">
        <h2
          className="text-[#111]"
          style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          Three steps. That&apos;s it.
        </h2>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8 lg:gap-16">
          {steps.map((step) => (
            <div key={step.number}>
              <span className="font-mono text-sm font-medium text-[#999]">{step.number}</span>
              <h3 className="mt-3 text-xl font-semibold text-[#111]">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#666]">{step.description}</p>
              {step.detail && (
                <div className="mt-5 rounded-lg bg-[#111] px-4 py-3 font-mono text-[13px] text-[#999]">
                  {step.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
