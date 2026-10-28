import { existsSync } from "node:fs";
import path from "node:path";

// Claude Code names this plugin's MCP tools mcp__plugin_<plugin>_<server>__<tool>.
// The classifier derives the same tools as mcp__omp_spec_kit_<tool> (see
// createMCPToolName in src/enforcement/classifier.js).
const CLAUDE_MCP_PREFIX = "mcp__plugin_omp-spec-kit_omp-spec-kit__";
const CLASSIFIER_MCP_PREFIX = "mcp__omp_spec_kit_";

// Git Bash and Cygwin hand tools /c/Users/x (or /cygdrive/c/Users/x). The
// classifier does not translate them: on win32 path.resolve would read /c/x as
// \c\x on the current drive, outside the project, and the check would pass.
const MSYS_DRIVE_PATH = /^\/(?:cygdrive\/)?([a-zA-Z])(?:\/([\s\S]*))?$/u;
const DRIVE_PREFIX = /^[a-zA-Z]:/u;
const URI_PREFIX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function fromMsysPath(value, platform) {
  if (platform !== "win32" || typeof value !== "string") return value;
  const match = MSYS_DRIVE_PATH.exec(value);
  return match === null ? value : `${match[1].toUpperCase()}:/${match[2] ?? ""}`;
}

// Claude Code resolves a relative tool path against the session cwd, but the
// classifier resolves it against the project root. Make plain relative paths
// absolute here so a subfolder session cannot reach ../.specs unseen. Anything
// the classifier treats specially (URIs, drive-relative or colon-bearing paths
// on win32, NUL bytes) is left untouched so its own unsafe-path rules still fire.
function absolutize(value, base, platform) {
  if (!nonEmptyString(value) || value.includes("\u0000")) return value;
  if (path.isAbsolute(value) || DRIVE_PREFIX.test(value) || URI_PREFIX.test(value)) return value;
  if (platform === "win32" && value.includes(":")) return value;
  return path.resolve(base, value);
}

function chooseRoot(hookInput, env, platform) {
  const candidates = [env.CLAUDE_PROJECT_DIR, hookInput.cwd];
  for (const candidate of candidates) {
    if (nonEmptyString(candidate) && !candidate.includes("${")) return fromMsysPath(candidate, platform);
  }
  return process.cwd();
}

function requiredString(toolInput, key, toolName) {
  const value = toolInput[key];
  if (typeof value !== "string") throw new TypeError(`${toolName} tool_input.${key} must be a string`);
  return value;
}

function optionalString(toolInput, key, toolName) {
  const value = toolInput[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TypeError(`${toolName} tool_input.${key} must be a string`);
  return value;
}

// True when child is parent or lies under it. A path that climbs out of parent
// ("..", "../x") is not inside, while a directory named "..x" is.
function isWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

// A recursive search rooted at .specs or at any ancestor of it returns .specs
// content, so it is classified as a search of .specs itself. Nothing is hidden
// when the project has no .specs directory.
function searchRoot(searchDir, root) {
  const specs = path.join(root, ".specs");
  return isWithin(specs, searchDir) && existsSync(specs) ? specs : searchDir;
}

// A segment that expands to several names: a wildcard character, or an extglob
// opener such as "@(" or "!(". A bare parenthesis is literal, so a directory
// named "app (v2)" is not a glob.
const GLOB_WILDCARD = /[*?[{]|[@!+]\(/u;

// Resolves a glob pattern to the directory it starts from. Literal segments are
// resolved one at a time from the search directory, so wildcard-looking names in
// ancestor directories are never scanned. rest holds the segments from the first
// wildcard on, or is undefined when the whole pattern is literal.
function globStart(searchDir, pattern, platform) {
  const normalized = fromMsysPath(pattern, platform);
  const root = path.isAbsolute(normalized) ? path.parse(normalized).root : "";
  const segments = normalized.slice(root.length).split(/[\\/]/u);
  let directory = root === "" ? searchDir : root;
  for (let index = 0; index < segments.length; index += 1) {
    if (GLOB_WILDCARD.test(segments[index])) return { directory, rest: segments.slice(index) };
    directory = path.resolve(directory, segments[index]);
  }
  return { directory, rest: undefined };
}

// Classifier fields for a glob. A start inside .specs is a direct read of .specs
// (paths). A wildcard that can descend below an ancestor of .specs ("**" or a
// wildcard directory segment) reaches .specs content, so the search is classified
// as a search of .specs. A top-level wildcard such as "*.md" lists names in its
// directory and is left alone.
function globTargets({ directory, rest }, root) {
  const specs = path.join(root, ".specs");
  if (rest === undefined) return isWithin(directory, specs) ? { paths: [directory] } : {};
  if (isWithin(directory, specs)) return { paths: [path.join(directory, ...rest)] };
  const descends = rest.length > 1 || rest[0].includes("**");
  return descends && isWithin(specs, directory) && existsSync(specs) ? { path: specs } : {};
}

/**
 * Map one Claude Code PreToolUse payload to a classifier event.
 * Returns { event: { toolName, input, cwd }, root } or throws on a malformed payload.
 */
export function toClassifierEvent(hookInput, { env = process.env, platform = process.platform } = {}) {
  if (!isPlainObject(hookInput)) throw new TypeError("hook input must be a JSON object");
  const claudeName = hookInput.tool_name;
  if (!nonEmptyString(claudeName)) throw new TypeError("hook input has no tool_name");
  const toolInput = hookInput.tool_input === undefined ? {} : hookInput.tool_input;
  if (!isPlainObject(toolInput)) throw new TypeError("hook input tool_input must be an object");

  const root = chooseRoot(hookInput, env, platform);
  const cwd = nonEmptyString(hookInput.cwd) && !hookInput.cwd.includes("${") ? fromMsysPath(hookInput.cwd, platform) : root;
  const base = path.isAbsolute(cwd) ? cwd : root;
  const target = (value) => absolutize(fromMsysPath(value, platform), base, platform);

  let toolName;
  let input;
  switch (claudeName) {
    case "Read":
      toolName = "read";
      input = { path: target(requiredString(toolInput, "file_path", claudeName)) };
      break;
    case "Write":
      toolName = "write";
      input = { path: target(requiredString(toolInput, "file_path", claudeName)) };
      break;
    case "Edit":
    case "MultiEdit":
      toolName = "edit";
      input = { path: target(requiredString(toolInput, "file_path", claudeName)) };
      break;
    case "NotebookEdit":
      toolName = "edit";
      input = { path: target(requiredString(toolInput, "notebook_path", claudeName)) };
      break;
    case "Grep": {
      toolName = "grep";
      // No path means the search starts at the session cwd, which may itself sit inside .specs
      // or above it at the project root.
      input = { path: searchRoot(target(optionalString(toolInput, "path", claudeName) ?? cwd), root) };
      break;
    }
    case "Glob": {
      toolName = "glob";
      const pattern = optionalString(toolInput, "pattern", claudeName);
      const searchDir = target(optionalString(toolInput, "path", claudeName) ?? cwd);
      // The matcher resolves the pattern against the search directory, so "../"
      // segments and absolute patterns are judged where they actually land.
      input = { path: searchDir, ...(pattern === undefined ? {} : globTargets(globStart(searchDir, pattern, platform), root)) };
      break;
    }
    case "Bash":
      toolName = "bash";
      input = { command: requiredString(toolInput, "command", claudeName) };
      break;
    case "PowerShell":
      toolName = "powershell";
      input = { command: requiredString(toolInput, "command", claudeName) };
      break;
    default:
      if (claudeName.startsWith(CLAUDE_MCP_PREFIX)) {
        // A hook has no tool list, so the classifier cannot verify tool provenance;
        // it checks by name only.
        toolName = CLASSIFIER_MCP_PREFIX + claudeName.slice(CLAUDE_MCP_PREFIX.length);
      } else {
        toolName = claudeName;
      }
      input = toolInput;
  }

  return { event: { toolName, input, cwd }, root };
}
