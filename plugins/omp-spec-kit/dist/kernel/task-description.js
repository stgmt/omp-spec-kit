import { scanBlocks } from "./parsers/md-blocks.js";

// A task description is ordinary readable Markdown, separated from authored
// task metadata. Prefixing every line also prevents it from defining fields or
// headings in the specification graph.
export const DESCRIPTION_START = "<!-- agent-teams-description:start -->";
export const DESCRIPTION_END = "<!-- agent-teams-description:end -->";

function escapeLine(line) {
  return line.replace(/[\\\[<\r]/gu, (char) => {
    if (char === "\r") return "\\r";
    return `\\${char}`;
  });
}

function unescapeLine(line) {
  return line.replace(/\\([\\\[<r])/gu, (_, char) => char === "r" ? "\r" : char);
}

export function encodeTaskDescription(description) {
  return [
    DESCRIPTION_START,
    ...description.split("\n").map((line) => `> ${escapeLine(line)}`),
    DESCRIPTION_END,
  ];
}

// A malformed or duplicated block must not be overwritten as if it were
// absent: it may contain somebody's hand-edited task data.
export function parseTaskDescription(body) {
  const lines = body.split("\n");
  const { codeLineFlags } = scanBlocks(body);
  const starts = [];
  const ends = [];
  lines.forEach((line, index) => {
    if (codeLineFlags[index]) return;
    if (line === DESCRIPTION_START) starts.push(index);
    if (line === DESCRIPTION_END) ends.push(index);
  });
  if (starts.length === 0 && ends.length === 0) return { kind: "absent" };
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0] ||
      !lines.slice(starts[0] + 1, ends[0]).every((line) => line.startsWith("> "))) {
    return { kind: "malformed" };
  }
  return {
    kind: "present",
    start: starts[0],
    end: ends[0],
    value: lines.slice(starts[0] + 1, ends[0]).map((line) => unescapeLine(line.slice(2))).join("\n"),
  };
}
