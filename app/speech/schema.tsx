"use client";

import { useState } from "react";

// [name, description?, children?]. Nodes with children are folders or expandable files.
type Node = [string, string?, Node[]?];

const TREE: Node = ["conversations/", undefined, [
  ["README.md", undefined, [
    ["overview", "one row per conversation: topics, length, bandwidth, SNR, overlap"],
    ["layout", "what each file in a conversation folder holds"],
    ["review_and_levels", "what was removed and how audio levels were set"],
  ]],
  ["edits.json", undefined, [
    ["<conversation_id>", undefined, [
      ["source_session", "recording session the audio came from"],
      ["kept[]", "source_start, source_end, output_start, output_end in seconds"],
      ["cuts[]", "start, end and reasons for every removed range"],
      ["levels", undefined, [
        ["target_speech_lufs", "-23"],
        ["A | B", undefined, [
          ["speech_lufs_before", "speech loudness as recorded"],
          ["gain_db", "static gain applied; apply the negative to restore the recorded level"],
          ["speech_lufs_after", "speech loudness as delivered"],
          ["true_peak_dbtp", "at most -1"],
          ["limited_time_frac", "share of the track touched by the peak limiter"],
        ]],
      ]],
    ]],
  ]],
  ["conv_20260922_1906/", undefined, [
    ["spkA.wav", "speaker A's own microphone: mono, 48 kHz, 16-bit PCM"],
    ["spkB.wav", "speaker B's own microphone: same format"],
    ["stereo_L-A_R-B.wav", "the same two tracks in one file, A left and B right"],
    ["INFO.md", undefined, [
      ["recorded", "date and time of the session"],
      ["speaker_a | speaker_b", "stable pseudonyms"],
      ["duration", "delivered and recorded length"],
      ["words", "ASR word count per speaker"],
      ["topics", "what the conversation covers"],
      ["quality_notes", "written summary of bandwidth, noise, bleed and overlap"],
      ["measured", "per track, on the delivered audio", [
        ["noise_floor_dbfs", "lower = quieter background"],
        ["snr_est_db", "speech level over the noise floor"],
        ["bw_60dB_hz", "highest frequency holding real energy: the mic's limit, not the file's"],
        ["clip_frac", "share of samples at full scale"],
        ["speech_sec", "seconds of speech"],
        ["integrated_lufs", "loudness of the whole track"],
        ["leak_into_mic_db", "the other speaker's voice on this mic, relative to its own speaker"],
        ["both_talking_frac", "share of the conversation where both speak at once"],
      ]],
      ["levels", "gain and loudness per track, as in edits.json"],
      ["edits", "removed ranges with reasons, and a source-to-delivered time map"],
      ["transcript", "automatic, per speaker, timestamped in delivered time; not human-verified"],
    ]],
  ]],
]];

function text(n: Node, d = 0): string {
  const [name, desc, kids] = n;
  const line = "  ".repeat(d) + name + (desc ? `: ${desc}` : "");
  return [line, ...(kids ?? []).map((k) => text(k, d + 1))].join("\n");
}

function Item({ n, depth }: { n: Node; depth: number }) {
  const [name, desc, kids] = n;
  const folder = name.endsWith("/");
  const label = (
    <>
      <span className={folder && depth === 0 ? "sc-root" : ""}>
        {name}
        {desc && <span className="sc-desc">: {desc}</span>}
      </span>
    </>
  );
  if (!kids) return <div className="sc-row" style={{ paddingLeft: 16 + depth * 16 }}><i />{label}</div>;
  if (folder)
    return (
      <div>
        <div className="sc-row" style={{ paddingLeft: 16 + depth * 16 }}><i />{label}</div>
        {kids.map((k) => <Item key={k[0]} n={k} depth={depth + 1} />)}
      </div>
    );
  return (
    <details className="sc-det">
      <summary className="sc-row" style={{ paddingLeft: 16 + depth * 16 }}>
        <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M2 0 L7 4 L2 8 Z" /></svg>
        {label}
      </summary>
      <div className="sc-kids" style={{ marginLeft: 20 + depth * 16 }}>
        {kids.map((k) => <Leaf key={k[0]} n={k} />)}
      </div>
    </details>
  );
}

// Fields inside a file: nested keys are indented, no further collapsing.
function Leaf({ n }: { n: Node }) {
  const [name, desc, kids] = n;
  return (
    <div>
      <div className="sc-field">
        <span>{name}</span>
        {desc && <span className="sc-desc">: {desc}</span>}
      </div>
      {kids && <div className="sc-nest">{kids.map((k) => <Leaf key={k[0]} n={k} />)}</div>}
    </div>
  );
}

export function Schema() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="sc">
      <div className="sc-head">
        <span>Schema</span>
        <button
          type="button"
          aria-label="Copy"
          title="Copy"
          onClick={() => {
            navigator.clipboard?.writeText(text(TREE)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            });
          }}
        >
          {copied ? (
            <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>
      <div className="sc-body">
        <Item n={TREE} depth={0} />
      </div>
    </div>
  );
}
