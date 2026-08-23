# spec-lsp Schema

Versioned public schemas for the LSP adapter's request-response contracts, diagnostic mapping shape, and oracle-fixture contract. All shapes are versioned; clients and harnesses SHALL declare the schema version they target.

## Diagnostic mapping shape (diagnostic-mapping@1)

Maps a kernel conformance finding to an LSP diagnostic.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DiagnosticMapping@1",
  "type": "object",
  "required": ["kernelFindingCode", "lspDiagnostic"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "diagnostic-mapping@1" },
    "kernelFindingCode": {
      "type": "string",
      "description": "The kernel finding code, e.g. DUPLICATE_DEFINITION, AMBIGUOUS_TARGET, MISSING_REFERENCE"
    },
    "lspDiagnostic": {
      "type": "object",
      "required": ["range", "message", "code"],
      "additionalProperties": true,
      "properties": {
        "range": {
          "type": "object",
          "required": ["start", "end"],
          "properties": {
            "start": { "type": "object", "required": ["line", "character"], "properties": { "line": { "type": "integer" }, "character": { "type": "integer" } } },
            "end": { "type": "object", "required": ["line", "character"], "properties": { "line": { "type": "integer" }, "character": { "type": "integer" } } }
          }
        },
        "severity": { "type": "integer", "enum": [1, 2, 3, 4], "description": "1=Error, 2=Warning, 3=Information, 4=Hint" },
        "code": { "type": "string" },
        "source": { "type": "string", "const": "omp-spec-lsp" },
        "message": { "type": "string", "maxLength": 2048 }
      }
    },
    "repositoryRelativePath": { "type": "string", "description": "Repository-relative path using / separators" }
  }
}
```

**Conservation:** Every kernel finding for a document produces exactly one LSP diagnostic. No adapter-specific codes exist. `diagnostics.length === kernelFindings.length` per document.

## Definition request-response (definition@1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DefinitionResponse@1",
  "oneOf": [
    {
      "type": "object",
      "required": ["kind", "location"],
      "properties": {
        "schemaVersion": { "type": "string", "const": "definition@1" },
        "kind": { "type": "string", "const": "unambiguous" },
        "canonicalId": { "type": "string" },
        "location": {
          "type": "object",
          "required": ["uri", "range"],
          "properties": {
            "uri": { "type": "string" },
            "range": { "type": "object" }
          }
        }
      }
    },
    {
      "type": "object",
      "required": ["kind", "candidates"],
      "properties": {
        "schemaVersion": { "type": "string", "const": "definition@1" },
        "kind": { "type": "string", "const": "ambiguous" },
        "bareId": { "type": "string" },
        "candidates": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["canonicalId", "location"],
            "properties": {
              "canonicalId": { "type": "string" },
              "location": { "type": "object" }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "required": ["kind"],
      "properties": {
        "schemaVersion": { "type": "string", "const": "definition@1" },
        "kind": { "type": "string", "const": "unresolved" },
        "referenceText": { "type": "string" }
      }
    }
  ]
}
```

## References request-response (references@1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ReferencesResponse@1",
  "type": "object",
  "required": ["schemaVersion", "canonicalId", "locations"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "references@1" },
    "canonicalId": { "type": "string" },
    "includeDeclaration": { "type": "boolean" },
    "locations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["uri", "range"],
        "properties": {
          "uri": { "type": "string" },
          "range": { "type": "object" },
          "edgeType": { "type": "string", "enum": ["REFS", "COVERS", "TESTED_BY", "IMPLEMENTS", "DEPENDS_ON", "DOCUMENTS", "DECLARES"] }
        }
      }
    },
    "total": { "type": "integer" }
  }
}
```

## Completion request-response (completion@1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CompletionResponse@1",
  "type": "object",
  "required": ["schemaVersion", "items"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "completion@1" },
    "prefix": { "type": "string" },
    "items": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "object",
        "required": ["label", "canonicalId", "nodeKind"],
        "properties": {
          "label": { "type": "string" },
          "canonicalId": { "type": "string" },
          "nodeKind": { "type": "string" },
          "detail": { "type": "string" },
          "insertText": { "type": "string" }
        }
      }
    },
    "truncated": { "type": "boolean" }
  }
}
```

## Hover request-response (hover@1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HoverResponse@1",
  "type": "object",
  "required": ["schemaVersion", "kind"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "hover@1" },
    "kind": { "type": "string", "enum": ["spec-node", "scenario", "empty"] },
    "canonicalId": { "type": "string" },
    "content": {
      "type": "object",
      "properties": {
        "body": { "type": "string", "maxLength": 4096 },
        "status": { "type": "string" },
        "result": { "type": "string" },
        "provenance": { "type": "string" },
        "freshness": { "type": "string" },
        "truncated": { "type": "boolean" }
      }
    }
  }
}
```

## DocumentSymbol response (document-symbol@1)

Follows the LSP `DocumentSymbol` hierarchy. Each symbol maps to a kernel node:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DocumentSymbolResponse@1",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["name", "kind", "range", "selectionRange"],
    "properties": {
      "name": { "type": "string", "description": "Local ID or heading text" },
      "kind": { "type": "integer", "description": "LSP SymbolKind mapped from kernel node kind" },
      "range": { "type": "object" },
      "selectionRange": { "type": "object" },
      "children": { "type": "array", "items": { "$ref": "#" } },
      "canonicalId": { "type": "string" },
      "nodeKind": { "type": "string" }
    }
  }
}
```

## Oracle-fixture contract (oracle-fixture@1)

Defines the shape of shared fixtures used by CHK-FR12-01 oracle parity harness.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OracleFixture@1",
  "type": "object",
  "required": ["fixtureId", "featureFile", "stepDefinitions", "expectedVerdicts"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "oracle-fixture@1" },
    "fixtureId": { "type": "string" },
    "runner": { "type": "string", "enum": ["cucumber-js", "pytest-bdd"] },
    "featureFile": {
      "type": "object",
      "required": ["relativePath", "sha256", "byteCount"],
      "properties": {
        "relativePath": { "type": "string" },
        "sha256": { "type": "string" },
        "byteCount": { "type": "integer" }
      }
    },
    "stepDefinitions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["expression", "sourceLocation"],
        "properties": {
          "expression": { "type": "string" },
          "sourceLocation": { "type": "object" },
          "language": { "type": "string" }
        }
      }
    },
    "expectedVerdicts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["lineNumber", "verdict"],
        "properties": {
          "lineNumber": { "type": "integer" },
          "stepText": { "type": "string" },
          "verdict": { "type": "string", "enum": ["defined", "undefined", "ambiguous"] },
          "matchedExpression": { "type": "string" },
          "ambiguousCandidates": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "provenance": {
      "type": "object",
      "required": ["producerName", "producerVersion", "captureDate", "licenseDisposition"],
      "properties": {
        "producerName": { "type": "string" },
        "producerVersion": { "type": "string" },
        "captureDate": { "type": "string", "format": "date" },
        "licenseDisposition": { "type": "string" }
      }
    }
  }
}
```

## Parity-harness contract (parity-check@1)

Defines the evidence record produced by CHK-FR8-01.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ParityCheckRecord@1",
  "type": "object",
  "required": ["checkId", "corpusFingerprint", "status", "comparisons"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "const": "parity-check@1" },
    "checkId": { "type": "string", "const": "CHK-FR8-01" },
    "corpusFingerprint": { "type": "string" },
    "artifactSha256": { "type": "string" },
    "status": { "type": "string", "enum": ["PASS", "FAIL"] },
    "comparisons": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation", "input", "match"],
        "properties": {
          "operation": { "type": "string", "enum": ["definition", "references", "diagnostics"] },
          "input": { "type": "string" },
          "match": { "type": "boolean" },
          "lspResponseHash": { "type": "string" },
          "kernelResponseHash": { "type": "string" },
          "divergenceDetail": { "type": "string" }
        }
      }
    },
    "timestamp": { "type": "string" },
    "runtimeMetadata": { "type": "object" }
  }
}
```
