const test = require("node:test");
const assert = require("node:assert/strict");
const { extractPrompt, inferPromptFromArgs, parseGitHubLoginFromEmail, parseGitHubLoginFromRemote } = require("../cli/monty.js");

test("extracts Claude and Codex prompt payloads", () => {
  assert.equal(extractPrompt({ prompt: "hello from hook" }), "hello from hook");
  assert.equal(extractPrompt({ user_prompt: "hello from telemetry" }), "hello from telemetry");
  assert.equal(extractPrompt({ messages: [{ role: "user", content: "first" }, { role: "user", content: "second" }] }), "second");
});

test("infers common non-interactive CLI prompts", () => {
  assert.equal(inferPromptFromArgs("codex", ["exec", "--skip-git-repo-check", "say hi"]), "say hi");
  assert.equal(inferPromptFromArgs("claude", ["-p", "say hi"]), "say hi");
});

test("detects GitHub login from common local signals", () => {
  assert.equal(parseGitHubLoginFromEmail("12345+octocat@users.noreply.github.com"), "octocat");
  assert.equal(parseGitHubLoginFromEmail("octocat@users.noreply.github.com"), "octocat");
  assert.equal(parseGitHubLoginFromRemote("git@github.com:openai/codex.git"), "openai");
  assert.equal(parseGitHubLoginFromRemote("https://github.com/openai/codex.git"), "openai");
});
