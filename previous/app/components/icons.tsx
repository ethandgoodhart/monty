export function MontyLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <img src="/monty-logo.png" alt="Monty" className="w-8 h-8 object-cover" style={{ transform: "scale(1.6)" }} />
    </span>
  );
}

export function ChevronIcon() {
  return (
    <svg className="w-4 h-4 opacity-50 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
    </svg>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
      <path d="M184,64H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H184a8,8,0,0,0,8-8V72A8,8,0,0,0,184,64Zm-8,144H48V80H176ZM224,40V184a8,8,0,0,1-16,0V48H72a8,8,0,0,1,0-16H216A8,8,0,0,1,224,40Z" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg className="w-6 h-6 translate-x-[1px]" viewBox="0 0 256 256" fill="currentColor">
      <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
      <path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z" />
    </svg>
  );
}

export function DollarIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 256 256" fill="currentColor">
      <path d="M152,120H136V56h8a32,32,0,0,1,32,32,8,8,0,0,0,16,0,48.05,48.05,0,0,0-48-48h-8V24a8,8,0,0,0-16,0V40H112a48,48,0,0,0,0,96h8v64H104a32,32,0,0,1-32-32,8,8,0,0,0-16,0,48.05,48.05,0,0,0,48,48h16v16a8,8,0,0,0,16,0V216h16a48,48,0,0,0,0-96Zm-40,0a32,32,0,0,1,0-64h8v64Zm40,80H136V136h16a32,32,0,0,1,0,64Z" />
    </svg>
  );
}

export function TerminalIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 256 256" fill="currentColor">
      <path d="M117.31,134l-72,64a8,8,0,1,1-10.63-12L100,128,34.69,70A8,8,0,1,1,45.32,58l72,64A8,8,0,0,1,117.31,134ZM216,184H120a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 256 256" fill="currentColor">
      <path d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z" />
    </svg>
  );
}

export function ClaudeCodeLogo({ className }: { className?: string }) {
  return <img src="/logos/claude-code.png" alt="Claude Code" className={className ?? "w-5 h-5"} style={{ objectFit: "contain" }} />;
}

export function CursorLogo({ className }: { className?: string }) {
  return <img src="/logos/cursor.png" alt="Cursor" className={className ?? "w-5 h-5"} style={{ objectFit: "contain" }} />;
}

export function WindsurfLogo({ className }: { className?: string }) {
  return <img src="/logos/windsurf.svg" alt="Windsurf" className={className ?? "w-5 h-5"} style={{ objectFit: "contain" }} />;
}

export function VSCodeLogo({ className }: { className?: string }) {
  return <img src="/logos/vscode.png" alt="VS Code" className={className ?? "w-5 h-5"} style={{ objectFit: "contain" }} />;
}

export function CodexLogo({ className }: { className?: string }) {
  return <img src="/logos/codex.png" alt="Codex" className={className ?? "w-5 h-5"} style={{ objectFit: "contain" }} />;
}
