import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { GLOSSARY_BRANCH, GLOSSARY_ERROR_CODES, createGlossaryStore, glossaryPath } from "../../src/service/glossary-store.js";

const DOC = [
  "# Глоссарий",
  "",
  "| id | термин | определение | запрещённые формы |",
  "|---|---|---|---|",
  "| pool | пул | Элемент пула ресурсов. | сиденье |",
  "| seat | место | Позиция в зале. |  |",
  "",
].join("\n");

const MISSING = () => {
  const error = new Error("git show failed: fatal: path 'glossary/a/b/GLOSSARY.md' does not exist in 'glossary'");
  error.stderr = "fatal: path 'glossary/a/b/GLOSSARY.md' does not exist in 'glossary'";
  return error;
};

function fakeGit({ refs = [GLOSSARY_BRANCH], files = {}, failWith = null, revParseError = null } = {}) {
  return {
    async revParse(ref) {
      if (revParseError) throw revParseError;
      if (!refs.includes(ref)) throw new Error(`unknown revision ${ref}`);
      return "0123456789abcdef0123456789abcdef01234567";
    },
    async show(ref, filePath) {
      if (failWith) throw failWith;
      if (!refs.includes(ref)) throw new Error(`unknown revision ${ref}`);
      const value = files[filePath];
      if (value === undefined) throw MISSING();
      return value;
    },
  };
}

describe("glossary path", () => {
  it("bounds the file to the project identity", () => {
    assert.equal(glossaryPath("acme/booking"), "glossary/acme/booking/GLOSSARY.md");
  });

  it("refuses a project id that is not owner/project", () => {
    // mutant: accept any string → a path traversal or a bare slug reaches git.
    for (const value of ["acme", "acme/", "/booking", "acme/../booking", "acme/booking/x", "", null, 42]) {
      assert.equal(glossaryPath(value), null, String(value));
    }
  });
});

describe("glossary store wiring", () => {
  it("refuses to build without a usable git client and cwd", () => {
    assert.throws(() => createGlossaryStore({ git: {}, cwd: "/repo" }), TypeError);
    assert.throws(() => createGlossaryStore({ git: fakeGit(), cwd: "" }), TypeError);
    assert.throws(() => createGlossaryStore(), TypeError);
  });
});

describe("glossary store read", () => {
  it("reads the file, parses it and hashes the exact bytes", async () => {
    const store = createGlossaryStore({ git: fakeGit({ files: { "glossary/acme/booking/GLOSSARY.md": DOC } }), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, true);
    assert.equal(result.data.exists, true);
    assert.deepEqual(result.data.terms.map((term) => term.id), ["pool", "seat"]);
    assert.equal(result.data.sha256, createHash("sha256").update(Buffer.from(DOC, "utf8")).digest("hex"));
  });

  it("reports a missing file as an empty project, not an error", async () => {
    const store = createGlossaryStore({ git: fakeGit(), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, true);
    assert.equal(result.data.exists, false);
    assert.equal(result.data.path, "glossary/acme/booking/GLOSSARY.md");
  });

  it("distinguishes a missing branch from a missing file", async () => {
    // mutant: report every git failure as an empty project → the gate says
    // "create a glossary" when the branch itself does not exist.
    const store = createGlossaryStore({ git: fakeGit({ refs: [] }), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, GLOSSARY_ERROR_CODES.BRANCH_MISSING);
  });

  it("does not read an unreadable repository as a missing branch", async () => {
    // mutant: treat every rev-parse rejection as an absent ref → a repo that is
    // not a repository tells the caller to create a branch.
    const broken = Object.assign(new Error("git rev-parse failed in /repo: fatal: not a git repository"), {
      stderr: "fatal: not a git repository (or any of the parent directories): .git",
    });
    const store = createGlossaryStore({ git: fakeGit({ revParseError: broken }), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, GLOSSARY_ERROR_CODES.UNAVAILABLE);
    assert.equal(result.error.retryable, true);
  });

  it("keeps a missing branch permanent, not retryable", async () => {
    const store = createGlossaryStore({ git: fakeGit({ refs: [] }), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.error.code, GLOSSARY_ERROR_CODES.BRANCH_MISSING);
    assert.equal(result.error.retryable, false);
  });

  it("falls back to the remote ref when only origin has the branch", async () => {
    const store = createGlossaryStore({
      git: fakeGit({ refs: ["origin/glossary"], files: { "glossary/acme/booking/GLOSSARY.md": DOC } }),
      cwd: "/repo",
    });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, true);
    assert.equal(result.data.ref, "origin/glossary");
    assert.equal(result.data.exists, true);
  });

  it("separates an unreadable repository from an empty project", async () => {
    const broken = Object.assign(new Error("git show failed in /repo: fatal: not a git repository"), {
      stderr: "fatal: not a git repository (or any of the parent directories): .git",
    });
    const store = createGlossaryStore({ git: fakeGit({ failWith: broken }), cwd: "/repo" });
    const result = await store.read("acme/booking");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, GLOSSARY_ERROR_CODES.UNAVAILABLE);
  });

  it("refuses an invalid project before touching git", async () => {
    let touched = false;
    const git = {
      async revParse() {
        touched = true;
        return "sha";
      },
      async show() {
        touched = true;
        return DOC;
      },
    };
    const store = createGlossaryStore({ git, cwd: "/repo" });
    const result = await store.read("acme");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, GLOSSARY_ERROR_CODES.PROJECT_INVALID);
    assert.equal(touched, false);
  });
});

describe("glossary store status and search", () => {
  const store = () =>
    createGlossaryStore({ git: fakeGit({ files: { "glossary/acme/booking/GLOSSARY.md": DOC } }), cwd: "/repo" });

  it("status reports the empty state without a term count", async () => {
    // mutant: compute termCount before checking `exists` → an empty project
    // throws TypeError instead of reporting the state the gate needs.
    const empty = createGlossaryStore({ git: fakeGit(), cwd: "/repo" });
    const result = await empty.status("acme/booking");
    assert.equal(result.ok, true);
    assert.equal(result.data.exists, false);
    assert.equal(result.data.termCount, undefined);
  });

  it("status keeps the version but not the whole document", async () => {
    const result = await store().status("acme/booking");
    assert.equal(result.ok, true);
    assert.equal(result.data.termCount, 2);
    assert.equal(result.data.text, undefined);
    assert.match(result.data.sha256, /^[0-9a-f]{64}$/u);
  });

  it("search finds a banned form and names its canonical term", async () => {
    const result = await store().search("acme/booking", { query: "Сиденье" });
    assert.equal(result.ok, true);
    assert.equal(result.data.hits.length, 1);
    assert.equal(result.data.hits[0].canonical, "пул");
    assert.equal(result.data.hits[0].forbidden, true);
    assert.equal(result.data.hits[0].matchedIn, "forbiddenForm");
  });

  it("search finds a word that appears only in a definition", async () => {
    // mutant: drop the definition field from the search → a definition-only
    // lookup returns nothing and the caller concludes the term is missing.
    const result = await store().search("acme/booking", { query: "ресурсов" });
    assert.equal(result.ok, true);
    assert.equal(result.data.hits.length, 1);
    assert.equal(result.data.hits[0].matchedIn, "definition");
    assert.equal(result.data.hits[0].canonical, null);
    assert.equal(result.data.hits[0].forbidden, false);
  });

  it("search bounds the result and says it was truncated", async () => {
    // mutant: ignore `limit` → a search for "е" returns the whole glossary.
    const result = await store().search("acme/booking", { query: "е", limit: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.data.hits.length, 1);
    assert.equal(result.data.truncated, true);
    assert.equal(result.data.limit, 1);
  });

  it("an empty query returns no hits instead of the whole file", async () => {
    const result = await store().search("acme/booking", { query: "" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data.hits, []);
  });

  it("search on a project without a file reports the missing state", async () => {
    const empty = createGlossaryStore({ git: fakeGit(), cwd: "/repo" });
    const result = await empty.search("acme/booking", { query: "пул" });
    assert.equal(result.ok, true);
    assert.equal(result.data.exists, false);
  });
});
