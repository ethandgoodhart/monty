# Monty

Monty shows Claude Code and Codex CLI prompts in a live team feed.

## Run locally

```bash
npm install
npm run dev
node ./cli/monty.js install --site http://localhost:3000 --team default
```

Open `http://localhost:3000`, then submit a prompt in Claude Code or Codex CLI.
The installer detects your GitHub profile from `gh`, git config, noreply email, or the repo remote and shows your GitHub avatar in the feed automatically.

Codex reads telemetry config when the process starts. Restart any already-running Codex CLI/app sessions after `monty install`.

## Supabase

Run `supabase/schema.sql` in your Supabase SQL editor, then set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MONTY_TEAM_ID=default
```

The feed uses Supabase realtime when these variables are present. Local development also has an SSE fallback, so the app works before Supabase is configured.

## CLI

```bash
monty install --site https://your-monty-site.com --team your-team
monty doctor
monty capture --source test --prompt "manual smoke test"
```

`monty install` writes:

- `~/.claude/settings.json` `UserPromptSubmit` hook
- `~/.codex/hooks.json` `UserPromptSubmit` hook
- `~/.codex/config.toml` Codex OpenTelemetry prompt export
- `~/.monty/config.json`

Hook failures are logged to `~/.monty/monty.log` and never block Claude Code or Codex CLI.
