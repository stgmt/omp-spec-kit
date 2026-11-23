import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GLOSSARY_ERROR_CODES,
  GLOSSARY_HEADING,
  GLOSSARY_MAX_BYTES,
  findForbiddenForms,
  maskNonProse,
  normalizeGlossaryText,
  parseGlossary,
  serializeGlossary,
} from "../src/kernel/glossary.js";

const HEADER = ["| id | термин | определение | запрещённые формы |", "|---|---|---|---|"];

function doc(rows) {
  return ["# Глоссарий", "", ...HEADER, ...rows, ""].join("\n");
}

const VALID = doc([
  "| pool | объект пула | Элемент пула ресурсов. | сиденье; место |",
  "| seat | место | Позиция в зале. |  |",
]);

describe("glossary parse", () => {
  it("reads the table and keeps forbidden forms", () => {
    const result = parseGlossary(VALID);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.terms.map((term) => term.id), ["pool", "seat"]);
    assert.deepEqual(result.terms[0].forbiddenForms, ["сиденье", "место"]);
    assert.deepEqual(result.terms[1].forbiddenForms, []);
    assert.match(result.sha256, /^[0-9a-f]{64}$/u);
  });

  it("accepts an empty table as the initial state", () => {
    const result = parseGlossary(doc([]));
    assert.equal(result.ok, true);
    assert.deepEqual(result.terms, []);
  });

  it("refuses a missing heading", () => {
    const result = parseGlossary(`| id | термин | определение | запрещённые формы |\n|---|---|---|---|\n`);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.HEADING_MISSING);
  });

  it("refuses reordered columns", () => {
    const text = ["# Глоссарий", "", "| термин | id | определение | запрещённые формы |", "|---|---|---|---|", ""].join("\n");
    const result = parseGlossary(text);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.COLUMNS_INVALID);
  });

  it("refuses a row with an unescaped pipe", () => {
    const text = doc(["| pool | объект | пула | a | b |"]);
    const result = parseGlossary(text);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.UNESCAPED_PIPE);
    assert.equal(result.errors[0].line, 5);
  });

  it("reports duplicate ids, duplicate terms and empty cells", () => {
    const result = parseGlossary(
      doc([
        "| pool | объект пула | Первое. |  |",
        "| pool | Объект пула | Второе. |  |",
        "|  | место | Третье. |  |",
      ]),
    );
    const codes = result.errors.map((error) => error.code);
    assert.ok(codes.includes(GLOSSARY_ERROR_CODES.ID_DUPLICATE));
    assert.ok(codes.includes(GLOSSARY_ERROR_CODES.TERM_DUPLICATE));
    assert.ok(codes.includes(GLOSSARY_ERROR_CODES.CELL_EMPTY));
  });

  it("refuses a forbidden form equal to its term", () => {
    const result = parseGlossary(doc(["| pool | пул | Определение. | Пул |"]));
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.FORM_EQUALS_TERM);
  });

  it("refuses a document above the size cap", () => {
    const result = parseGlossary(`# Глоссарий\n${"x".repeat(GLOSSARY_MAX_BYTES)}`);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.TOO_LARGE);
  });

  it("refuses a heading with nothing after it", () => {
    // mutant: drop the `headerIndex === null` return → heading-only text parses as ok.
    const result = parseGlossary(`${GLOSSARY_HEADING}\n`);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.TABLE_MISSING);
  });

  it("refuses a table without a separator row", () => {
    // mutant: drop the `isSeparatorRow` check → the first data row is read as a separator.
    const text = doc(["| pool | объект | Определение. |  |"]).replace("|---|---|---|---|\n", "");
    const result = parseGlossary(text);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.TABLE_MISSING);
  });

  it("refuses an id outside the lowercase slug pattern", () => {
    // mutant: loosen ID_PATTERN → "Pool" and "pool_1" are accepted as ids.
    for (const id of ["Pool", "pool_1", "пул"]) {
      const result = parseGlossary(doc([`| ${id} | пул | Определение. |  |`]));
      assert.equal(result.ok, false, id);
      assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.ID_INVALID, id);
    }
    assert.equal(parseGlossary(doc(["| pool-1 | пул | Определение. |  |"])).ok, true);
  });

  it("refuses an empty entry in the forbidden-form list", () => {
    // mutant: drop the `form === ""` guard → a trailing ";" silently declares nothing.
    const result = parseGlossary(doc(["| pool | пул | Определение. | сиденье; |"]));
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.SEPARATOR_IN_FORM);
  });

  it("refuses the same forbidden form in two rows", () => {
    // mutant: drop the `byForm` check → "Сиденье" and "сиденье" both land in the file.
    const result = parseGlossary(
      doc(["| pool | пул | Определение. | сиденье |", "| seat | место | Другое. | Сиденье |"]),
    );
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, GLOSSARY_ERROR_CODES.FORM_DUPLICATE);
  });

  it("normalizes with NFC and toLowerCase only", () => {
    assert.equal(normalizeGlossaryText("STRAẞE"), "straße");
    assert.equal(normalizeGlossaryText("STRASSE"), "strasse");
    assert.notEqual(normalizeGlossaryText("ß"), normalizeGlossaryText("ss"));
  });
});

describe("glossary serialize", () => {
  it("round-trips the parsed document and is stable", () => {
    const parsed = parseGlossary(VALID);
    const once = serializeGlossary(parsed.terms);
    const twice = serializeGlossary(parseGlossary(once).terms);
    assert.equal(once, twice);
    assert.equal(parseGlossary(once).ok, true);
  });

  it("escapes pipes and keeps ids sorted", () => {
    const text = serializeGlossary([
      { id: "seat", term: "место", definition: "Позиция | в зале.", forbiddenForms: [] },
      { id: "pool", term: "пул", definition: "Элемент.", forbiddenForms: ["сиденье"] },
    ]);
    assert.match(text, /пул/u);
    assert.ok(text.indexOf("| pool |") < text.indexOf("| seat |"));
    assert.match(text, /Позиция \\\| в зале\./u);
    assert.equal(parseGlossary(text).ok, true);
  });
});

describe("forbidden form scan", () => {
  const terms = parseGlossary(VALID).terms;

  it("finds a whole word and reports line and column", () => {
    const text = "Вступление.\nи сиденье тут\n";
    const findings = findForbiddenForms(text, terms);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].form, "сиденье");
    assert.equal(findings[0].termId, "pool");
    assert.equal(findings[0].line, 2);
    assert.equal(findings[0].column, 3);
  });

  it("does not match inside a longer word", () => {
    assert.deepEqual(findForbiddenForms("сиденьице", terms), []);
  });

  it("skips fenced code and inline code", () => {
    const fenced = ["```js", "сиденье", "```", ""].join("\n");
    assert.deepEqual(findForbiddenForms(fenced, terms), []);
    assert.deepEqual(findForbiddenForms("поле `сиденье` здесь", terms), []);
  });

  it("skips link destinations but reads link text", () => {
    assert.deepEqual(findForbiddenForms("см. [x](https://example.invalid/сиденье)", terms), []);
    assert.equal(findForbiddenForms("см. [сиденье](https://example.invalid/a)", terms).length, 1);
  });

  it("keeps original columns when masking changes nothing else", () => {
    const source = "а `б` в";
    const masked = maskNonProse(source);
    assert.equal(masked.length, source.length);
    assert.equal(masked.includes("б"), false);
    assert.equal(masked, "а     в");
  });

  it("matches across markup inside a word boundary", () => {
    const findings = findForbiddenForms("си**денье**", terms);
    assert.equal(findings.length, 0);
  });

  it("matches decomposed prose against a precomposed forbidden form", () => {
    // mutant: normalize per code point instead of per grapheme cluster → NFC cannot
    // compose "е" + U+0308 here, so decomposed prose is never matched.
    const hedgehog = parseGlossary(doc(["| hedgehog | ёж | Зверь. | ёжик |"])).terms;
    const findings = findForbiddenForms("\u0435\u0308\u0436\u0438\u043a", hedgehog);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].form, "ёжик");
  });

  it("reports the column within the original line for a structured field", () => {
    // mutant: report `map[at] + 1` without `segment.base` → column 1 instead of 9.
    const findings = findForbiddenForms("Covers: сиденье тут", terms);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].column, 9);
  });

  it("keeps columns in code points after a non-BMP character", () => {
    const findings = findForbiddenForms("😀 сиденье", terms);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].column, 3);
  });
});
