#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const home = os.homedir();
const montyDir = path.join(home, ".monty");
const configPath = path.join(montyDir, "config.json");
const installedCliPath = path.join(montyDir, "monty.js");
const installedCliDisplayPath = path.join("~", ".monty", "monty.js");
const marker = "Monty prompt feed";

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);

  try {
    if (command === "install") return install(args);
    if (command === "capture") return captureCommand(args);
    if (command === "hook") return hookCommandHandler(args);
    if (command === "run") return runWrapped(args);
    if (command === "doctor") return doctor();
    if (command === "help" || command === "--help" || command === "-h") return help();

    console.error(`Unknown command: ${command}`);
    help();
    process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function install(args) {
  const options = parseArgs(args);
  const githubProfile = detectGitHubProfile(options);
  const config = {
    siteUrl: cleanUrl(options.site || options.url || process.env.MONTY_SITE_URL || "https://www.trymonty.ai"),
    teamId: String(options.team || process.env.MONTY_TEAM_ID || "default"),
    userName: String(options.user || process.env.MONTY_USER || process.env.USER || os.userInfo().username || "unknown"),
    githubLogin: githubProfile.login,
    avatarUrl: githubProfile.avatarUrl,
    ingestToken: options.token || process.env.MONTY_INGEST_TOKEN || "",
    machineId: os.hostname(),
    installedAt: new Date().toISOString(),
  };

  fs.mkdirSync(montyDir, { recursive: true });
  fs.copyFileSync(__filename, installedCliPath);
  fs.chmodSync(installedCliPath, 0o755);
  writeJson(configPath, config);

  const claudePath = path.join(home, ".claude", "settings.json");
  const codexPath = path.join(home, ".codex", "hooks.json");
  const codexConfigPath = path.join(home, ".codex", "config.toml");
  upsertHookJson(claudePath, "claude");
  upsertHookJson(codexPath, "codex");
  upsertCodexOtelConfig(codexConfigPath, config);

  console.log(`Monty installed for ${config.teamId}`);
  console.log(`Site: ${config.siteUrl}`);
  if (config.githubLogin) console.log(`GitHub avatar: ${config.githubLogin}`);
  console.log(`Claude hook: ${claudePath}`);
  console.log(`Codex hook: ${codexPath}`);
  console.log(`Codex telemetry: ${codexConfigPath}`);
  console.log("Open Claude Code or restart Codex CLI and submit a prompt. It will appear in the Monty feed.");
  console.log("Note: Codex reads telemetry config at process start, so already-running Codex sessions must be restarted.");
}

async function captureCommand(args) {
  const options = parseArgs(args);
  const input = {
    hook_event_name: "ManualCapture",
    prompt: options.prompt || args.filter((arg) => !arg.startsWith("--")).join(" "),
    cwd: process.cwd(),
  };
  await sendPrompt(options.source || "manual", input);
}

async function hookCommandHandler(args) {
  const options = parseArgs(args);
  const source = options.source || "manual";
  const input = await readStdinJson();
  await sendPrompt(source, input);
}

async function sendPrompt(source, input) {
  const config = readConfig();
  const prompt = extractPrompt(input);

  if (!prompt) {
    silentLog("No prompt found in hook payload.");
    return;
  }

  const event = {
    team_id: config.teamId || process.env.MONTY_TEAM_ID || "default",
    source: normalizeSource(source),
    prompt,
    user_name: config.userName || process.env.MONTY_USER || process.env.USER || "unknown",
    avatar_url: config.avatarUrl || process.env.MONTY_AVATAR_URL || null,
    machine_id: config.machineId || os.hostname(),
    cwd: input.cwd || process.cwd(),
    model: input.model || input.model_id || null,
    token_count: numberOrNull(input.token_count || input.tokens || input.total_tokens),
    session_id: input.session_id || input.conversation_id || null,
    metadata: {
      hook_event_name: input.hook_event_name || input.hookEventName || null,
      transcript_path: input.transcript_path || null,
      cli: source,
    },
  };

  const siteUrl = cleanUrl(config.siteUrl || process.env.MONTY_SITE_URL || "https://www.trymonty.ai");
  const headers = { "content-type": "application/json" };
  const token = config.ingestToken || process.env.MONTY_INGEST_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${siteUrl}/api/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    if (!response.ok) {
      silentLog(`Monty ingest failed: HTTP ${response.status}`);
    }
  } catch (error) {
    silentLog(`Monty ingest failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function runWrapped(args) {
  const [tool, ...toolArgs] = args;
  if (!tool || !["claude", "codex"].includes(tool)) {
    console.error("Usage: monty run <claude|codex> [...args]");
    process.exitCode = 1;
    return;
  }

  const prompt = inferPromptFromArgs(tool, toolArgs);
  if (prompt) {
    sendPrompt(tool, { prompt, cwd: process.cwd(), hook_event_name: "WrappedRun" }).catch(() => {});
  }

  const result = spawnSync(tool, toolArgs, { stdio: "inherit", env: process.env });
  process.exit(result.status ?? 1);
}

function doctor() {
  const config = readConfig();
  const checks = [
    ["Config", fs.existsSync(configPath) ? configPath : "missing"],
    ["Site", config.siteUrl || "not set"],
    ["Claude settings", fs.existsSync(path.join(home, ".claude", "settings.json")) ? "present" : "missing"],
    ["Codex hooks", fs.existsSync(path.join(home, ".codex", "hooks.json")) ? "present" : "missing"],
    ["Installed CLI", fs.existsSync(installedCliPath) ? installedCliPath : "missing"],
    ["Codex restart needed", "yes, for Codex sessions started before Monty install"],
  ];

  for (const [label, value] of checks) {
    console.log(`${label}: ${value}`);
  }
}

function upsertHookJson(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const data = readJson(filePath, {});
  data.hooks ||= {};
  data.hooks.UserPromptSubmit ||= [];

  const command = `"${process.execPath}" "${installedCliPath}" hook --source ${source}`;
  const group = {
    hooks: [
      {
        type: "command",
        command,
        timeout: 10,
        statusMessage: marker,
      },
    ],
  };

  data.hooks.UserPromptSubmit = data.hooks.UserPromptSubmit.filter((entry) => {
    const serialized = JSON.stringify(entry);
    return !serialized.includes(installedCliPath) && !serialized.includes(installedCliDisplayPath) && !serialized.includes(marker);
  });
  data.hooks.UserPromptSubmit.push(group);
  writeJson(filePath, data);
}

function upsertCodexOtelConfig(filePath, config) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const begin = "# BEGIN MONTY OTEL";
  const end = "# END MONTY OTEL";
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const withoutMonty = existing.replace(new RegExp(`\\n?${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, "g"), "\n");
  const hasOtel = /^\s*\[otel(?:\]|\.)/m.test(withoutMonty);
  if (hasOtel) {
    silentLog("Skipped Codex OTEL config because an existing [otel] section is present.");
    return;
  }

  const endpoint = otelEndpoint(config);
  const block = `${begin}
[otel]
environment = "dev"
log_user_prompt = true
exporter = { otlp-http = { endpoint = "${endpoint}", protocol = "json" } }
${end}
`;

  fs.writeFileSync(filePath, `${withoutMonty.trimEnd()}\n\n${block}`);
}

function otelEndpoint(config) {
  const params = new URLSearchParams();
  params.set("team", config.teamId || "default");
  params.set("user", config.userName || "unknown");
  if (config.avatarUrl) params.set("avatar", config.avatarUrl);
  if (config.githubLogin) params.set("github", config.githubLogin);
  return `${cleanUrl(config.siteUrl)}/api/otel/v1/logs?${params.toString()}`;
}

function detectGitHubProfile(options = {}) {
  const explicitLogin = options.github || options["github-login"] || process.env.MONTY_GITHUB_LOGIN || "";
  const explicitAvatar = options.avatar || options["avatar-url"] || process.env.MONTY_AVATAR_URL || "";
  if (explicitAvatar) {
    return {
      login: String(explicitLogin || githubLoginFromAvatar(explicitAvatar) || ""),
      avatarUrl: String(explicitAvatar),
    };
  }

  const ghProfile = detectGitHubProfileFromGh();
  const login =
    explicitLogin ||
    ghProfile.login ||
    runGitConfig("github.user") ||
    parseGitHubLoginFromEmail(runGitConfig("user.email")) ||
    parseGitHubLoginFromRemote(runGitRemote());

  return {
    login,
    avatarUrl: ghProfile.avatarUrl || (login ? `https://github.com/${login}.png` : ""),
  };
}

function detectGitHubProfileFromGh() {
  const result = spawnSync("gh", ["api", "user", "--jq", ".login + \"\\t\" + .avatar_url"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0 || !result.stdout.trim()) return { login: "", avatarUrl: "" };
  const [login = "", avatarUrl = ""] = result.stdout.trim().split("\t");
  return { login, avatarUrl };
}

function runGitConfig(key) {
  const result = spawnSync("git", ["config", "--get", key], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function runGitRemote() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function parseGitHubLoginFromEmail(email) {
  const match = String(email).match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  return match ? match[1] : "";
}

function parseGitHubLoginFromRemote(remote) {
  const match = String(remote).match(/github\.com[:/]([^/]+)\//i);
  return match ? match[1] : "";
}

function githubLoginFromAvatar(avatarUrl) {
  const match = String(avatarUrl).match(/^https:\/\/github\.com\/([^/.]+)\.png/i);
  return match ? match[1] : "";
}

function inferPromptFromArgs(tool, args) {
  if (tool === "codex") {
    const execIndex = args.findIndex((arg) => arg === "exec" || arg === "e");
    const candidates = execIndex >= 0 ? args.slice(execIndex + 1) : args;
    return lastNonFlag(candidates);
  }

  const printIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");
  if (printIndex >= 0) return lastNonFlag(args.slice(printIndex + 1));
  return lastNonFlag(args);
}

function extractPrompt(input) {
  if (typeof input.prompt === "string") return input.prompt;
  if (typeof input.user_prompt === "string") return input.user_prompt;
  if (typeof input.message === "string") return input.message;
  if (input.message && typeof input.message.content === "string") return input.message.content;
  if (Array.isArray(input.messages)) {
    const lastUser = [...input.messages].reverse().find((message) => message && message.role === "user");
    if (typeof lastUser?.content === "string") return lastUser.content;
  }
  return "";
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { prompt: raw };
  }
}

function readConfig() {
  return readJson(configPath, {});
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cleanUrl(value) {
  return String(value).replace(/\/+$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSource(value) {
  return value === "claude" || value === "codex" || value === "test" ? value : "manual";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function lastNonFlag(args) {
  return [...args].reverse().find((arg) => typeof arg === "string" && arg && !arg.startsWith("-")) || "";
}

function silentLog(message) {
  try {
    fs.mkdirSync(montyDir, { recursive: true });
    fs.appendFileSync(path.join(montyDir, "monty.log"), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Hooks must never interrupt Claude Code or Codex.
  }
}

function help() {
  console.log(`Monty prompt feed

Usage:
  monty install --site http://localhost:3000 --team default
  monty capture --source test --prompt "hello"
  monty run codex exec "prompt"
  monty run claude -p "prompt"
  monty doctor
`);
}

if (require.main === module) {
  main();
}

module.exports = {
  extractPrompt,
  inferPromptFromArgs,
  parseGitHubLoginFromEmail,
  parseGitHubLoginFromRemote,
};
