import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Spawns the real Claude Code PreToolUse hook (plugins/omp-spec-kit/hooks/pretooluse.mjs)
// with a Claude Code style stdin payload. It loads dist/enforcement/classifier.js,
// so the plugin must be built (npm run build) before this runs.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const hookPath = path.join(repositoryRoot, "plugins", "omp-spec-kit", "hooks", "pretooluse.mjs");
const normalizeUrl = pathToFileURL(path.join(repositoryRoot, "plugins", "omp-spec-kit", "hooks", "normalize.mjs")).href;
const { toClassifierEvent } = await import(normalizeUrl);

const OWN_MCP = "mcp__plugin_omp-spec-kit_omp-spec-kit__";
const SCENARIO_FEATURE = "Feature: Foo\n  Scenario: Foo works\n    Given a foo\n";

let projectDir;
let specFile;
let subDir;

before(() => {
  projectDir = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-hook-")));
  mkdirSync(path.join(projectDir, ".specs", "foo"), { recursive: true });
  specFile = path.join(projectDir, ".specs", "foo", "foo.md");
  writeFileSync(specFile, "# Foo\n");
  writeFileSync(path.join(projectDir, ".specs", "foo", "foo.feature"), SCENARIO_FEATURE);
  writeFileSync(path.join(projectDir, "README.md"), "# Project\n");
  subDir = path.join(projectDir, "sub");
  mkdirSync(subDir);
});

after(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function payload(toolName, toolInput, cwd = projectDir) {
  return {
    session_id: "test-session",
    transcript_path: path.join(projectDir, "transcript.jsonl"),
    cwd,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "toolu_test",
  };
}

function runHook(stdin, { cwd = projectDir, env = {} } = {}) {
  const result = spawnSync(process.execPath, [hookPath], {
    input: typeof stdin === "string" ? stdin : JSON.stringify(stdin),
    cwd,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...env },
    timeout: 30_000,
    windowsHide: true,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function assertBlocked(result, code) {
  assert.equal(result.status, 2, `expected exit 2, got ${result.status}; stderr=${result.stderr}`);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, code);
  assert.doesNotMatch(result.stderr, /SPEC_HOOK_FAILED/u);
}

function assertAllowed(result) {
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}; stderr=${result.stderr}`);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

function assertHookFailed(result) {
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^SPEC_HOOK_FAILED: /u);
}

describe("PreToolUse hook blocks direct .specs access", () => {
  const blockCases = () => [
    ["Write", "an absolute .specs file", { file_path: specFile, content: "x" }, /RAW_SPEC_WRITE/u],
    ["Edit", "an absolute .specs file", { file_path: specFile, old_string: "Foo", new_string: "Bar" }, /RAW_SPEC_WRITE/u],
    ["MultiEdit", "an absolute .specs file", { file_path: specFile, edits: [{ old_string: "Foo", new_string: "Bar" }] }, /RAW_SPEC_WRITE/u],
    ["NotebookEdit", "a .specs notebook", { notebook_path: path.join(projectDir, ".specs", "foo", "n.ipynb"), new_source: "x" }, /RAW_SPEC_WRITE/u],
    ["Read", "an absolute .specs file", { file_path: specFile }, /SPEC_READ_REDIRECT/u],
    ["Read", "a relative .specs file", { file_path: ".specs/foo/foo.md" }, /SPEC_READ_REDIRECT/u],
    ["Grep", "path .specs", { pattern: "Foo", path: ".specs" }, /SPEC_READ_REDIRECT/u],
    ["Glob", "path .specs", { pattern: "**/*.md", path: ".specs" }, /SPEC_READ_REDIRECT/u],
    ["Glob", "a pattern starting with .specs", { pattern: ".specs/**/*.md" }, /SPEC_READ_REDIRECT/u],
    ["Bash", "cat of a .specs file", { command: "cat .specs/foo/foo.md" }, /RAW_SPEC_WRITE/u],
    ["PowerShell", "Get-Content of a .specs file", { command: "Get-Content .specs/foo/foo.md" }, /RAW_SPEC_WRITE/u],
  ];

  for (const [toolName, label, toolInput, code] of blockCases()) {
    it(`blocks ${toolName} on ${label}`, () => {
      assertBlocked(runHook(payload(toolName, toolInput)), code);
    });
  }

  it("blocks Grep and Glob that default to a cwd inside .specs", () => {
    const specsCwd = path.join(projectDir, ".specs");
    assertBlocked(runHook(payload("Grep", { pattern: "Foo" }, specsCwd)), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "*.md" }, specsCwd)), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a project-wide Grep and a recursive Glob that reach .specs", () => {
    assertBlocked(runHook(payload("Grep", { pattern: "Project" })), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Grep", { pattern: "Foo", path: "." })), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "**/*.md" })), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "*/foo.md" })), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a Grep from a subfolder whose search root is an ancestor of .specs", () => {
    assertBlocked(runHook(payload("Grep", { pattern: "Foo", path: ".." }, subDir), { cwd: subDir }), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a Glob that climbs from a subfolder into .specs or to an ancestor of it", () => {
    assertBlocked(runHook(payload("Glob", { pattern: "../.specs/**/*.md" }, subDir), { cwd: subDir }), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "../**/*.md" }, subDir), { cwd: subDir }), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "../*/foo.md" }, subDir), { cwd: subDir }), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a Glob whose absolute or extglob pattern lands inside .specs", () => {
    assertBlocked(runHook(payload("Glob", { pattern: path.join(projectDir, ".specs", "*.md") }, subDir), { cwd: subDir }), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Glob", { pattern: "@(.specs)/*.md" })), /SPEC_READ_REDIRECT/u);
  });

  it("blocks a Read from a subfolder session that reaches ../.specs", () => {
    const result = runHook(payload("Read", { file_path: "../.specs/foo/foo.md" }, subDir));
    assertBlocked(result, /SPEC_READ_REDIRECT/u);
  });

  it("blocks when CLAUDE_PROJECT_DIR is unset and cwd is the project", () => {
    const result = runHook(payload("Read", { file_path: specFile }), { env: { CLAUDE_PROJECT_DIR: undefined } });
    assertBlocked(result, /SPEC_READ_REDIRECT/u);
  });

  it("blocks MSYS style drive paths on win32", { skip: process.platform !== "win32" }, () => {
    const drive = /^([A-Za-z]):/u.exec(specFile)[1].toLowerCase();
    const msys = `/${drive}${specFile.slice(2).split(path.sep).join("/")}`;
    assert.match(msys, /^\/[a-z]\//u);
    assertBlocked(runHook(payload("Read", { file_path: msys })), /SPEC_READ_REDIRECT/u);
    assertBlocked(runHook(payload("Write", { file_path: msys, content: "x" })), /RAW_SPEC_WRITE/u);
  });
});

describe("PreToolUse hook allows ordinary work", () => {
  it("allows Read of README.md (relative and absolute)", () => {
    assertAllowed(runHook(payload("Read", { file_path: "README.md" })));
    assertAllowed(runHook(payload("Read", { file_path: path.join(projectDir, "README.md") })));
  });

  it("allows Bash ls -la and PowerShell Get-ChildItem", () => {
    assertAllowed(runHook(payload("Bash", { command: "ls -la" })));
    assertAllowed(runHook(payload("PowerShell", { command: "Get-ChildItem" })));
  });

  it("allows Write of src/a.js", () => {
    assertAllowed(runHook(payload("Write", { file_path: "src/a.js", content: "export {};\n" })));
    assertAllowed(runHook(payload("Write", { file_path: path.join(projectDir, "src", "a.js"), content: "x" })));
  });

  it("allows Grep over a subfolder and a top-level Glob at the project root", () => {
    assertAllowed(runHook(payload("Grep", { pattern: "x", path: "sub" })));
    assertAllowed(runHook(payload("Glob", { pattern: "*.md" })));
  });

  it("allows a project-wide Grep and recursive Glob when the project has no .specs", () => {
    const bare = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-hook-bare-")));
    try {
      writeFileSync(path.join(bare, "README.md"), "# Bare\n");
      const env = { CLAUDE_PROJECT_DIR: bare };
      assertAllowed(runHook(payload("Grep", { pattern: "Bare" }, bare), { cwd: bare, env }));
      assertAllowed(runHook(payload("Glob", { pattern: "**/*.md" }, bare), { cwd: bare, env }));
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("allows a subfolder Read that stays outside .specs", () => {
    assertAllowed(runHook(payload("Read", { file_path: "../README.md" }, subDir)));
  });

  it("allows a Glob that climbs from a subfolder to top-level names that are not .specs", () => {
    assertAllowed(runHook(payload("Glob", { pattern: "../*.md" }, subDir), { cwd: subDir }));
  });

  it("allows top-level Globs when an ancestor directory name contains parentheses", () => {
    const parent = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-hook-paren-")));
    try {
      const project = path.join(parent, "app (v2)");
      mkdirSync(path.join(project, ".specs"), { recursive: true });
      writeFileSync(path.join(project, "README.md"), "# App\n");
      const env = { CLAUDE_PROJECT_DIR: project };
      assertAllowed(runHook(payload("Glob", { pattern: "*.md" }, project), { cwd: project, env }));
      assertAllowed(runHook(payload("Glob", { pattern: "README.md" }, project), { cwd: project, env }));
      assertBlocked(runHook(payload("Glob", { pattern: "*/foo.md" }, project), { cwd: project, env }), /SPEC_READ_REDIRECT/u);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("allows spec_catalog from the plugin's own MCP server", () => {
    assertAllowed(runHook(payload(`${OWN_MCP}spec_catalog`, { view: "inventory" })));
  });
});

describe("PreToolUse hook gates spec_patch", () => {
  it("blocks a scenario-bearing .feature patch without designReview", () => {
    const operations = [{ kind: "create_document", document: "foo.feature", content: SCENARIO_FEATURE }];
    const result = runHook(payload(`${OWN_MCP}spec_patch`, { spec: "foo", operations, dryRun: true }));
    assertBlocked(result, /DESIGN_REVIEW_REQUIRED/u);
  });

  it("blocks archiveSpec of a spec with a scenario feature, resolving the root from CLAUDE_PROJECT_DIR", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "omp-spec-kit-hook-cwd-"));
    try {
      const result = runHook(payload(`${OWN_MCP}spec_patch`, { spec: "foo", intent: "archiveSpec" }, outside), { cwd: outside });
      assertBlocked(result, /DESIGN_REVIEW_REQUIRED/u);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("allows the same patch once designReview is attached", () => {
    const operations = [{ kind: "create_document", document: "foo.feature", content: SCENARIO_FEATURE }];
    const designReview = { schema: "omp-spec-kit/design-review@1" };
    assertAllowed(runHook(payload(`${OWN_MCP}spec_patch`, { spec: "foo", operations, designReview })));
  });
});

describe("PreToolUse hook fails closed", () => {
  it("blocks invalid JSON", () => {
    assertHookFailed(runHook("{not json"));
  });

  it("blocks empty stdin and whitespace-only stdin", () => {
    assertHookFailed(runHook(""));
    assertHookFailed(runHook("  \n"));
  });

  it("blocks input without tool_name", () => {
    const { tool_name: _omitted, ...withoutName } = payload("Read", { file_path: "README.md" });
    assertHookFailed(runHook(withoutName));
    assertHookFailed(runHook(payload("", { file_path: "README.md" })));
  });

  it("blocks non-object JSON", () => {
    assertHookFailed(runHook("null"));
    assertHookFailed(runHook("[]"));
    assertHookFailed(runHook('"Read"'));
  });

  it("blocks a known tool whose path field is missing or not a string", () => {
    assertHookFailed(runHook(payload("Read", {})));
    assertHookFailed(runHook(payload("Write", { file_path: 5 })));
    assertHookFailed(runHook(payload("Bash", {})));
  });

  it("blocks stdin over the 1 MB cap", () => {
    const oversized = JSON.stringify(payload("Bash", { command: `echo ${"a".repeat(1024 * 1024 + 16)}` }));
    const result = runHook(oversized);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^SPEC_HOOK_FAILED: stdin exceeds/u);
  });

  it("accepts stdin of exactly 1 MB and blocks one byte more", () => {
    const base = JSON.stringify(payload("Bash", { command: "echo " }));
    const sized = (bytes) => JSON.stringify(payload("Bash", { command: `echo ${"a".repeat(bytes - base.length)}` }));
    const exact = sized(1024 * 1024);
    assert.equal(Buffer.byteLength(exact), 1024 * 1024);
    assertAllowed(runHook(exact));
    const over = sized(1024 * 1024 + 1);
    assert.equal(Buffer.byteLength(over), 1024 * 1024 + 1);
    const result = runHook(over);
    assertHookFailed(result);
    assert.match(result.stderr, /stdin exceeds 1048576 bytes/u);
  });
});

describe("toClassifierEvent mapping", () => {
  const root = path.resolve(path.sep, "proj");
  const sub = path.join(root, "sub");
  const options = { env: { CLAUDE_PROJECT_DIR: root }, platform: process.platform };

  it("maps Read, Write, Edit, MultiEdit and NotebookEdit to lower-case classifier names", () => {
    const abs = path.join(root, "a.txt");
    assert.deepEqual(toClassifierEvent(payload("Read", { file_path: abs }, root), options).event, { toolName: "read", input: { path: abs }, cwd: root });
    assert.equal(toClassifierEvent(payload("Write", { file_path: abs }, root), options).event.toolName, "write");
    assert.equal(toClassifierEvent(payload("Edit", { file_path: abs }, root), options).event.toolName, "edit");
    assert.equal(toClassifierEvent(payload("MultiEdit", { file_path: abs }, root), options).event.toolName, "edit");
    const notebook = toClassifierEvent(payload("NotebookEdit", { notebook_path: abs }, root), options).event;
    assert.deepEqual([notebook.toolName, notebook.input.path], ["edit", abs]);
  });

  it("resolves relative paths against the hook cwd and returns the project root separately", () => {
    const mapped = toClassifierEvent(payload("Read", { file_path: "../x.md" }, sub), options);
    assert.equal(mapped.event.input.path, path.join(root, "x.md"));
    assert.equal(mapped.event.cwd, sub);
    assert.equal(mapped.root, root);
  });

  it("maps Glob patterns that start with .specs into the checked targets", () => {
    const withSpecs = toClassifierEvent(payload("Glob", { pattern: "./.specs/**/*.md" }, root), options).event;
    assert.equal(withSpecs.toolName, "glob");
    assert.deepEqual(withSpecs.input.paths, [path.join(root, ".specs", "**", "*.md")]);
    const plain = toClassifierEvent(payload("Glob", { pattern: "**/*.md", path: "docs" }, root), options).event;
    assert.deepEqual(plain.input, { path: path.join(root, "docs") });
  });

  it("judges a Glob by where its pattern lands, not by its leading text", () => {
    const climbing = toClassifierEvent(payload("Glob", { pattern: "../.specs/*.md" }, sub), options).event;
    assert.deepEqual(climbing.input, { path: sub, paths: [path.join(root, ".specs", "*.md")] });
    const absolute = toClassifierEvent(payload("Glob", { pattern: path.join(root, ".specs", "*.md") }, sub), options).event;
    assert.deepEqual(absolute.input.paths, [path.join(root, ".specs", "*.md")]);
  });

  it("maps Bash and PowerShell commands unchanged", () => {
    assert.deepEqual(toClassifierEvent(payload("Bash", { command: "ls" }, root), options).event.input, { command: "ls" });
    const ps = toClassifierEvent(payload("PowerShell", { command: "dir" }, root), options).event;
    assert.deepEqual([ps.toolName, ps.input], ["powershell", { command: "dir" }]);
  });

  it("maps only this plugin's MCP tools to the classifier's mcp__omp_spec_kit_ names", () => {
    const input = { view: "inventory" };
    const own = toClassifierEvent(payload(`${OWN_MCP}spec_catalog`, input, root), options).event;
    assert.deepEqual([own.toolName, own.input], ["mcp__omp_spec_kit_spec_catalog", input]);
    const other = toClassifierEvent(payload("mcp__other__thing", input, root), options).event;
    assert.deepEqual([other.toolName, other.input], ["mcp__other__thing", input]);
  });

  it("prefers CLAUDE_PROJECT_DIR, then hook cwd, then the process cwd for the root", () => {
    assert.equal(toClassifierEvent(payload("Bash", { command: "ls" }, sub), options).root, root);
    assert.equal(toClassifierEvent(payload("Bash", { command: "ls" }, sub), { ...options, env: {} }).root, sub);
    const noCwd = { tool_name: "Bash", tool_input: { command: "ls" } };
    assert.equal(toClassifierEvent(noCwd, { ...options, env: {} }).root, process.cwd());
    assert.equal(toClassifierEvent(payload("Bash", { command: "ls" }, sub), { ...options, env: { CLAUDE_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}" } }).root, sub);
  });

  it("converts MSYS drive paths only for win32", () => {
    const msys = "/c/Users/x/.specs/foo.md";
    const win = toClassifierEvent(payload("Read", { file_path: msys }, "/c/Users/x"), { env: {}, platform: "win32" });
    assert.equal(win.event.input.path, "C:/Users/x/.specs/foo.md");
    assert.equal(win.root, "C:/Users/x");
    const cygwin = toClassifierEvent(payload("Read", { file_path: "/cygdrive/d/p" }, "D:/p"), { env: {}, platform: "win32" });
    assert.equal(cygwin.event.input.path, "D:/p");
    const posix = toClassifierEvent(payload("Read", { file_path: msys }, "/home/x"), { env: {}, platform: "linux" });
    assert.equal(posix.event.input.path, msys);
  });

  it("leaves URI and drive-relative targets untouched for the classifier's own checks", () => {
    const uri = toClassifierEvent(payload("Read", { file_path: "skill://x/y" }, root), options).event.input.path;
    assert.equal(uri, "skill://x/y");
    const driveRelative = toClassifierEvent(payload("Read", { file_path: "C:foo" }, root), options).event.input.path;
    assert.equal(driveRelative, "C:foo");
  });

  it("throws on malformed hook input", () => {
    assert.throws(() => toClassifierEvent(null, options), /JSON object/u);
    assert.throws(() => toClassifierEvent({ tool_input: {} }, options), /tool_name/u);
    assert.throws(() => toClassifierEvent({ tool_name: "Read", tool_input: [] }, options), /tool_input/u);
    assert.throws(() => toClassifierEvent({ tool_name: "Read", tool_input: {} }, options), /file_path/u);
    assert.throws(() => toClassifierEvent({ tool_name: "Grep", tool_input: { path: 3 } }, options), /path/u);
  });
});

describe("PreToolUse hook stdin and stderr", () => {
  it("strips a leading byte order mark before parsing", () => {
    assertBlocked(runHook(`\uFEFF${JSON.stringify(payload("Read", { file_path: specFile }))}`), /SPEC_READ_REDIRECT/u);
    assertAllowed(runHook(`\uFEFF${JSON.stringify(payload("Read", { file_path: "README.md" }))}`));
  });

  it("still blocks when fd 2 is closed, falling back to process.stderr", () => {
    const hookUrl = pathToFileURL(hookPath).href;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `import { closeSync } from "node:fs"; closeSync(2); await import(${JSON.stringify(hookUrl)});`],
      {
        input: JSON.stringify(payload("Write", { file_path: specFile, content: "x" })),
        cwd: projectDir,
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assert.equal(child.status, 2, `expected exit 2, got ${child.status}; stderr=${child.stderr}`);
    assert.equal(child.stdout, "");
  });
});

describe("SessionStart setup warning", () => {
  const sessionHookPath = path.join(repositoryRoot, "plugins", "omp-spec-kit", "hooks", "sessionstart.mjs");

  function runSessionStart(cwd, env = {}) {
    const result = spawnSync(process.execPath, [sessionHookPath], {
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd }),
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: cwd,
        OMP_SPEC_REGISTRY_URL: "",
        OMP_SPEC_REGISTRY_TOKEN: "",
        ...env,
      },
      timeout: 30_000,
      windowsHide: true,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  it("warns once about a missing corpus without blocking", () => {
    const empty = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-empty-")));
    try {
      const result = runSessionStart(empty);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /SPEC_SETUP_REQUIRED/u);
      assert.match(result.stdout, /no \.specs corpus/u);
      assert.doesNotMatch(result.stdout, /Bearer|not-a-real-token|super-secret/u);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("names the missing MCP configuration for an existing corpus", () => {
    const result = runSessionStart(projectDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /OMP_SPEC_REGISTRY_URL is not set/u);
    assert.match(result.stdout, /OMP_SPEC_REGISTRY_TOKEN is not set/u);
  });

  it("stays silent when the corpus and MCP environment are configured", () => {
    const result = runSessionStart(projectDir, {
      OMP_SPEC_REGISTRY_URL: "http://127.0.0.1:8650/mcp",
      OMP_SPEC_REGISTRY_TOKEN: "not-a-real-token",
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });

  it("stays silent for a configured hosted project without a local corpus", () => {
    const hosted = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-hosted-")));
    try {
      writeFileSync(
        path.join(hosted, ".mcp.json"),
        JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "http", url: "http://127.0.0.1:8650/mcp" } } }),
      );
      const result = runSessionStart(hosted);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "", "a hosted project is configured by .mcp.json, not by a local .specs tree");
    } finally {
      rmSync(hosted, { recursive: true, force: true });
    }
  });

  it("stays silent for a user-scope Claude MCP config", () => {
    const home = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-home-")));
    const project = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-user-scope-")));
    try {
      writeFileSync(
        path.join(home, ".claude.json"),
        JSON.stringify({ mcpServers: { "omp-spec-kit": { type: "http", url: "http://127.0.0.1:8650/mcp" } } }),
      );
      const result = runSessionStart(project, { USERPROFILE: home, HOME: home });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "", "a user-scope Claude config is a valid setup signal");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("does not treat an unrelated MCP server as the spec registry", () => {
    const project = realpathSync.native(mkdtempSync(path.join(tmpdir(), "omp-spec-kit-unrelated-")));
    try {
      writeFileSync(
        path.join(project, ".mcp.json"),
        JSON.stringify({ mcpServers: { github: { type: "http", url: "https://api.github.com/mcp" } } }),
      );
      const result = runSessionStart(project);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /SPEC_SETUP_REQUIRED/u);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("never echoes a token value", () => {
    const result = runSessionStart(projectDir, {
      OMP_SPEC_REGISTRY_TOKEN: "super-secret-token-value",
    });
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /super-secret-token-value/u);
    assert.match(result.stdout, /OMP_SPEC_REGISTRY_URL is not set/u);
  });
});

describe("PreToolUse registration and path edge cases", () => {
  it("matches every tool the hook must see and nothing else", () => {
    const hooks = JSON.parse(readFileSync(path.join(repositoryRoot, "plugins", "omp-spec-kit", "hooks", "hooks.json"), "utf8"));
    const matcher = new RegExp(`^(?:${hooks.hooks.PreToolUse[0].matcher})$`, "u");
    for (const name of ["Read", "Write", "Edit", "MultiEdit", "NotebookEdit", "Glob", "Grep", "Bash", "PowerShell", `${OWN_MCP}spec_patch`]) {
      assert.match(name, matcher);
    }
    for (const name of ["WebFetch", "Task", "TodoWrite"]) assert.doesNotMatch(name, matcher);
  });

  it("leaves NUL-bearing and win32 colon-bearing paths for the classifier to reject", () => {
    const env = { CLAUDE_PROJECT_DIR: projectDir };
    assert.equal(toClassifierEvent({ tool_name: "Read", tool_input: { file_path: "a\u0000b.md" } }, { env, platform: "linux" }).event.input.path, "a\u0000b.md");
    assert.equal(toClassifierEvent({ tool_name: "Read", tool_input: { file_path: "foo:bar.md" } }, { env, platform: "win32" }).event.input.path, "foo:bar.md");
  });
});
