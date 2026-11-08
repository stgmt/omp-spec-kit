import { scanBlocks } from "./parsers/md-blocks.js";

// A random creation marker identifies the one command that first created a
// task. It is part of the same Git commit as the task, unlike a service cache.
const MARKER_RE = /^<!-- agent-teams-creation:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}) -->$/u;
export const CREATION_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/u;

export function taskCreationMarker(token) {
  return `<!-- agent-teams-creation:${token} -->`;
}

export function parseTaskCreationMarker(body) {
  const { lines, codeLineFlags } = scanBlocks(body);
  const markers = lines.flatMap((line, index) => {
    const match = codeLineFlags[index] ? null : MARKER_RE.exec(line.text);
    return match ? [match[1]] : [];
  });
  return markers.length === 1 ? markers[0] : null;
}
