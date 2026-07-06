import { ClaudeCodeLogo, CodexLogo } from "./icons";

const tools = [
  { name: "Claude Code", icon: <ClaudeCodeLogo className="h-10 w-auto" /> },
  { name: "Codex CLI", icon: <CodexLogo className="h-10 w-auto" /> },
];

export function Partners() {
  return (
    <section className="py-12">
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10">
        <div className="flex flex-col items-center gap-6">
          <span className="text-xs font-medium text-[#999] uppercase tracking-wider">Works with</span>
          <div className="flex items-center gap-12">
            {tools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-3 opacity-40 hover:opacity-60 transition-opacity">
                {tool.icon}
                <span className="text-sm font-medium text-[#666] hidden sm:inline">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
