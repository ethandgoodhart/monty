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
    if (command === "sync") return syncHistory(args);
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

  if (input.hook_event_name === "Stop" && input.session_id && input.transcript_path) {
    await Promise.all([
      handleStopHook(source, input),
      sendHeartbeat(),
    ]);
    return;
  }

  if (input.hook_event_name === "UserPromptSubmit" && input.session_id && input.transcript_path) {
    handleStopHook(source, input).catch(() => {});
  }

  await Promise.all([
    sendPrompt(source, input),
    sendHeartbeat(),
  ]);
}

async function handleStopHook(source, input) {
  const config = readConfig();
  const sessionId = input.session_id;
  const transcriptPath = input.transcript_path;

  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  try {
    const content = fs.readFileSync(transcriptPath, "utf8");
    const lines = content.split("\n").filter(Boolean);

    let lastUserPrompt = null;
    let totalInput = 0;
    let totalOutput = 0;
    let cacheCreation = 0;
    let cacheRead = 0;
    let model = null;
    let turnStarted = false;

    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }

      if (entry.type === "assistant" && entry.message) {
        const usage = entry.message.usage || {};
        totalInput += usage.input_tokens || 0;
        totalOutput += usage.output_tokens || 0;
        cacheCreation += usage.cache_creation_input_tokens || 0;
        cacheRead += usage.cache_read_input_tokens || 0;
        if (entry.message.model && entry.message.model !== "<synthetic>") model = entry.message.model;
        turnStarted = true;
      }

      if (entry.type === "user" && entry.message && turnStarted) {
        lastUserPrompt = extractPromptFromClaudeMessage(entry.message);
        break;
      }
    }

    if (!lastUserPrompt || (totalInput === 0 && totalOutput === 0)) return;

    const siteUrl = cleanUrl(config.siteUrl || process.env.MONTY_SITE_URL || "https://www.trymonty.ai");
    const headers = { "content-type": "application/json" };
    const token = config.ingestToken || process.env.MONTY_INGEST_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(`${siteUrl}/api/events`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          prompt: lastUserPrompt,
          model,
          input_tokens: totalInput,
          output_tokens: totalOutput,
          cache_creation_input_tokens: cacheCreation,
          cache_read_input_tokens: cacheRead,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      silentLog(`Monty stop-hook failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    silentLog(`Monty stop-hook transcript parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function sendPrompt(source, input) {
  const config = readConfig();
  const prompt = extractPrompt(input);

  if (!prompt) {
    return;
  }

  const inputTokens = numberOrNull(input.input_tokens || input.inputTokens) || 0;
  const outputTokens = numberOrNull(input.output_tokens || input.outputTokens) || 0;
  const cacheCreationTokens = numberOrNull(input.cache_creation_input_tokens) || 0;
  const cacheReadTokens = numberOrNull(input.cache_read_input_tokens) || 0;

  const event = {
    team_id: config.teamId || process.env.MONTY_TEAM_ID || "default",
    source: normalizeSource(source),
    prompt,
    user_name: config.userName || process.env.MONTY_USER || process.env.USER || "unknown",
    avatar_url: config.avatarUrl || process.env.MONTY_AVATAR_URL || null,
    machine_id: config.machineId || os.hostname(),
    cwd: input.cwd || process.cwd(),
    model: input.model || input.model_id || detectClaudeModel(source) || null,
    token_count: numberOrNull(input.token_count || input.tokens || input.total_tokens),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    session_id: input.session_id || input.conversation_id || null,
    metadata: {
      hook_event_name: input.hook_event_name || input.hookEventName || null,
      transcript_path: input.transcript_path || null,
      cli: source,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
    },
  };

  const siteUrl = cleanUrl(config.siteUrl || process.env.MONTY_SITE_URL || "https://www.trymonty.ai");
  const headers = { "content-type": "application/json" };
  const token = config.ingestToken || process.env.MONTY_INGEST_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
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

async function sendHeartbeat() {
  const config = readConfig();
  const siteUrl = cleanUrl(config.siteUrl || process.env.MONTY_SITE_URL || "https://www.trymonty.ai");
  const headers = { "content-type": "application/json" };
  const token = config.ingestToken || process.env.MONTY_INGEST_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${siteUrl}/api/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        team_id: config.teamId || process.env.MONTY_TEAM_ID || "default",
        user_name: config.userName || process.env.MONTY_USER || process.env.USER || "unknown",
        seconds: 30,
      }),
      signal: controller.signal,
    });
  } catch {
    // Heartbeat failures are non-critical
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

async function syncHistory(args) {
  const options = parseArgs(args);
  const config = readConfig();
  const siteUrl = cleanUrl(config.siteUrl || options.site || process.env.MONTY_SITE_URL || "https://www.trymonty.ai");
  const teamId = config.teamId || options.team || process.env.MONTY_TEAM_ID || "default";
  const userName = config.userName || options.user || process.env.MONTY_USER || process.env.USER || "unknown";
  const avatarUrl = config.avatarUrl || options.avatar || null;

  console.log(`Syncing history for ${userName} (team: ${teamId}) to ${siteUrl}`);

  const allEvents = [];

  const claudeEvents = parseClaudeHistory(userName, avatarUrl, teamId);
  console.log(`Found ${claudeEvents.length} Claude Code turns`);
  allEvents.push(...claudeEvents);

  const codexEvents = parseCodexHistory(userName, avatarUrl, teamId);
  console.log(`Found ${codexEvents.length} Codex turns`);
  allEvents.push(...codexEvents);

  if (allEvents.length === 0) {
    console.log("No history found to sync.");
    return;
  }

  allEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  console.log(`Total events to sync: ${allEvents.length}`);

  const headers = { "content-type": "application/json" };
  const token = config.ingestToken || process.env.MONTY_INGEST_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const batchSize = 200;
  let synced = 0;
  for (let i = 0; i < allEvents.length; i += batchSize) {
    const batch = allEvents.slice(i, i + batchSize);
    try {
      const response = await fetch(`${siteUrl}/api/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({ events: batch }),
      });
      const result = await response.json();
      synced += result.inserted || 0;
      process.stdout.write(`\r  Synced ${Math.min(i + batchSize, allEvents.length)}/${allEvents.length}...`);
    } catch (error) {
      console.error(`\nBatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\nDone. ${synced} events synced.`);
}

function parseClaudeHistory(userName, avatarUrl, teamId) {
  const claudeDir = path.join(home, ".claude", "projects");
  if (!fs.existsSync(claudeDir)) return [];

  const events = [];
  const projectDirs = fs.readdirSync(claudeDir).filter((d) => {
    try { return fs.statSync(path.join(claudeDir, d)).isDirectory(); } catch { return false; }
  });

  for (const projectDir of projectDirs) {
    const fullDir = path.join(claudeDir, projectDir);
    const jsonlFiles = fs.readdirSync(fullDir).filter((f) => f.endsWith(".jsonl"));

    for (const file of jsonlFiles) {
      const sessionId = file.replace(".jsonl", "");
      const filePath = path.join(fullDir, file);
      try {
        const sessionEvents = parseClaudeSession(filePath, sessionId, userName, avatarUrl, teamId, projectDir);
        events.push(...sessionEvents);
      } catch {
        // skip corrupt files
      }
    }
  }

  return events;
}

function parseClaudeSession(filePath, sessionId, userName, avatarUrl, teamId, projectDir) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  const events = [];

  let currentUserPrompt = null;
  let currentCwd = null;
  let turnIndex = 0;

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.type === "user" && entry.message) {
      const prompt = extractPromptFromClaudeMessage(entry.message);
      if (prompt && !prompt.startsWith("<task-notification>") && !prompt.startsWith("<system-reminder>") && !prompt.startsWith("<command-name>")) {
        if (currentUserPrompt) {
          if (currentUserPrompt.inputTokens > 0 || currentUserPrompt.outputTokens > 0) {
            events.push(buildClaudeTurnEvent(currentUserPrompt, sessionId, userName, avatarUrl, teamId, projectDir, turnIndex++));
          }
        }
        currentUserPrompt = {
          prompt,
          timestamp: entry.timestamp,
          cwd: entry.cwd || currentCwd,
          model: null,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          seenMsgIds: new Set(),
        };
        if (entry.cwd) currentCwd = entry.cwd;
      }
    }

    if (entry.type === "assistant" && entry.message) {
      const msg = entry.message;
      const msgId = msg.id;
      const usage = msg.usage || {};
      const model = msg.model || null;
      if (model === "<synthetic>") continue;

      if (currentUserPrompt && msgId && !currentUserPrompt.seenMsgIds.has(msgId)) {
        currentUserPrompt.seenMsgIds.add(msgId);
        const rawInput = usage.input_tokens || 0;
        const cacheCreation = usage.cache_creation_input_tokens || 0;
        const cacheRead = usage.cache_read_input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        currentUserPrompt.inputTokens += rawInput + cacheCreation + cacheRead;
        currentUserPrompt.outputTokens += outputTokens;
        currentUserPrompt.cacheCreationTokens += cacheCreation;
        currentUserPrompt.cacheReadTokens += cacheRead;
        if (model) currentUserPrompt.model = model;
      }
    }
  }

  if (currentUserPrompt && (currentUserPrompt.inputTokens > 0 || currentUserPrompt.outputTokens > 0)) {
    events.push(buildClaudeTurnEvent(currentUserPrompt, sessionId, userName, avatarUrl, teamId, projectDir, turnIndex));
  }

  return events;
}

function buildClaudeTurnEvent(turn, sessionId, userName, avatarUrl, teamId, projectDir, turnIndex) {
  const cwd = turn.cwd || projectDirToCwd(projectDir);
  const createdAt = turn.timestamp ? new Date(turn.timestamp).toISOString() : new Date().toISOString();

  return {
    id: deterministicUUID(`claude-turn-${sessionId}-${turnIndex}`),
    created_at: createdAt,
    team_id: teamId,
    source: "claude",
    prompt: turn.prompt || "",
    user_name: userName,
    avatar_url: avatarUrl,
    machine_id: os.hostname(),
    cwd,
    model: turn.model,
    token_count: turn.inputTokens + turn.outputTokens,
    input_tokens: turn.inputTokens,
    output_tokens: turn.outputTokens,
    session_id: sessionId,
    metadata: {
      cli: "claude",
      hook_event_name: "HistorySync",
      input_tokens: turn.inputTokens,
      output_tokens: turn.outputTokens,
      cache_creation_input_tokens: turn.cacheCreationTokens || 0,
      cache_read_input_tokens: turn.cacheReadTokens || 0,
    },
  };
}

function extractPromptFromClaudeMessage(message) {
  if (typeof message === "string") return message;
  if (message && typeof message.content === "string") return message.content;
  if (message && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block && block.type === "text" && typeof block.text === "string") return block.text;
    }
  }
  return "";
}

function projectDirToCwd(projectDir) {
  return projectDir.replace(/^-/, "/").replace(/-/g, "/");
}

function parseCodexHistory(userName, avatarUrl, teamId) {
  const dbPath = path.join(home, ".codex", "state_5.sqlite");
  if (!fs.existsSync(dbPath)) return [];

  try {
    const result = spawnSync("sqlite3", ["-json", dbPath,
      "SELECT id, title, model, tokens_used, model_provider, created_at, cwd, SUBSTR(first_user_message, 1, 500) AS first_user_message, cli_version FROM threads WHERE tokens_used > 0 ORDER BY created_at DESC",
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 100 * 1024 * 1024 });

    if (result.status !== 0 || !result.stdout.trim()) return [];

    const threads = JSON.parse(result.stdout);
    const allEvents = [];

    for (const thread of threads) {
      const rolloutTurns = parseCodexRolloutTurns(thread.id);

      if (rolloutTurns.length > 0) {
        for (let i = 0; i < rolloutTurns.length; i++) {
          const turn = rolloutTurns[i];
          const createdAt = turn.timestamp || (thread.created_at ? new Date(thread.created_at * 1000).toISOString() : new Date().toISOString());
          allEvents.push({
            id: deterministicUUID(`codex-turn-${thread.id}-${i}`),
            created_at: createdAt,
            team_id: teamId,
            source: "codex",
            prompt: turn.prompt || "",
            user_name: userName,
            avatar_url: avatarUrl,
            machine_id: os.hostname(),
            cwd: thread.cwd || null,
            model: thread.model || null,
            token_count: turn.inputTokens + turn.outputTokens,
            input_tokens: turn.inputTokens,
            output_tokens: turn.outputTokens,
            session_id: thread.id,
            metadata: {
              cli: "codex",
              hook_event_name: "HistorySync",
              input_tokens: turn.inputTokens,
              output_tokens: turn.outputTokens,
            },
          });
        }
      } else {
        const createdAt = thread.created_at ? new Date(thread.created_at * 1000).toISOString() : new Date().toISOString();
        const tokensUsed = thread.tokens_used || 0;
        allEvents.push({
          id: deterministicUUID(`codex-turn-${thread.id}-0`),
          created_at: createdAt,
          team_id: teamId,
          source: "codex",
          prompt: thread.first_user_message || thread.title || "(session)",
          user_name: userName,
          avatar_url: avatarUrl,
          machine_id: os.hostname(),
          cwd: thread.cwd || null,
          model: thread.model || null,
          token_count: tokensUsed,
          input_tokens: Math.round(tokensUsed * 0.7),
          output_tokens: Math.round(tokensUsed * 0.3),
          session_id: thread.id,
          metadata: {
            cli: "codex",
            hook_event_name: "HistorySync",
            input_tokens: Math.round(tokensUsed * 0.7),
            output_tokens: Math.round(tokensUsed * 0.3),
          },
        });
      }
    }

    return allEvents;
  } catch {
    return [];
  }
}

function parseCodexRolloutTurns(threadId) {
  const sessionsDir = path.join(home, ".codex", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  try {
    const result = spawnSync("find", [sessionsDir, "-name", `*${threadId}*`, "-type", "f"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    if (result.status !== 0 || !result.stdout.trim()) return [];

    const rolloutFile = result.stdout.trim().split("\n")[0];
    if (!rolloutFile || !fs.existsSync(rolloutFile)) return [];

    const content = fs.readFileSync(rolloutFile, "utf8");
    const turns = [];
    let currentPrompt = null;
    let lastTotalInput = 0;
    let lastTotalOutput = 0;

    for (const line of content.split("\n")) {
      if (!line) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }

      if (entry.type === "response_item" && entry.payload?.role === "user") {
        const textBlock = (entry.payload.content || []).find((c) => c.type === "input_text" && c.text);
        if (textBlock && !textBlock.text.startsWith("<")) {
          if (currentPrompt && currentPrompt.hasTokens) {
            turns.push(currentPrompt);
          }
          currentPrompt = {
            prompt: textBlock.text.slice(0, 500),
            timestamp: entry.timestamp,
            inputTokens: 0,
            outputTokens: 0,
            hasTokens: false,
          };
        }
      }

      if (entry.type === "event_msg" && entry.payload?.type === "token_count" && entry.payload.info) {
        const total = entry.payload.info.total_token_usage;
        if (total && currentPrompt) {
          const turnInput = (total.input_tokens || 0) - lastTotalInput;
          const turnOutput = (total.output_tokens || 0) - lastTotalOutput;
          if (turnInput > 0 || turnOutput > 0) {
            currentPrompt.inputTokens = turnInput;
            currentPrompt.outputTokens = turnOutput;
            currentPrompt.hasTokens = true;
            lastTotalInput = total.input_tokens || 0;
            lastTotalOutput = total.output_tokens || 0;
          }
        }
      }
    }

    if (currentPrompt && currentPrompt.hasTokens) {
      turns.push(currentPrompt);
    }

    return turns;
  } catch {
    return [];
  }
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

  const command = `"${process.execPath}" "${installedCliPath}" hook --source ${source}`;
  const promptGroup = {
    hooks: [
      {
        type: "command",
        command,
        timeout: 10,
        statusMessage: marker,
      },
    ],
  };

  const stopMarker = "Monty token sync";
  const stopCommand = `"${process.execPath}" "${installedCliPath}" hook --source ${source}`;
  const stopGroup = {
    hooks: [
      {
        type: "command",
        command: stopCommand,
        timeout: 10,
        statusMessage: stopMarker,
      },
    ],
  };

  const filterMonty = (entry) => {
    const serialized = JSON.stringify(entry);
    return !serialized.includes(installedCliPath) && !serialized.includes(installedCliDisplayPath) && !serialized.includes(marker) && !serialized.includes(stopMarker);
  };

  data.hooks.UserPromptSubmit ||= [];
  data.hooks.UserPromptSubmit = data.hooks.UserPromptSubmit.filter(filterMonty);
  data.hooks.UserPromptSubmit.push(promptGroup);

  if (source === "claude") {
    data.hooks.Stop ||= [];
    data.hooks.Stop = data.hooks.Stop.filter(filterMonty);
    data.hooks.Stop.push(stopGroup);
  }

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

function detectClaudeModel(source) {
  if (source !== "claude") return null;
  try {
    const settingsPath = path.join(home, ".claude", "settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return settings.model || null;
  } catch {
    return null;
  }
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

function deterministicUUID(input) {
  const crypto = require("node:crypto");
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
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
  monty sync                      Sync all Claude Code & Codex history with real token counts
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
