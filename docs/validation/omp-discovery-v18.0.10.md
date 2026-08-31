# OMP v18.0.10 discovery receipt

Profile: `omp-spec-kit` v0.3.2 current compatibility baseline.

## Manager handoff

Observed on the workstation:

```text
omp/18.0.10
Marketplace Plugins:
  omp-spec-kit@omp-spec-kit (0.3.2) (project)
Configured Marketplaces:
  omp-spec-kit  stgmt/omp-spec-kit
```

The project record points to the existing cache directory:

`<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2`

The cache is a real directory. The project lock records version `0.3.2` and enabled state `true`.

## Fresh-session smoke

Command:

```text
omp --cwd E:/repos/omp-spec-kit --no-session --thinking off -p "Call the omp-spec-kit spec_inventory MCP tool once and report only whether it returned a non-empty result."
```

Observed result:

```text
Working...
Yes.
```

This proves the installed project-scoped plugin was discovered by a fresh OMP 18.0.10 process and that the MCP path returned a non-empty result. It does not prove future authoring or plan-gate profiles.

## Version-check note

`omp update --check` reports `18.0.11` as available. The package remains pinned to the approved immutable `18.0.10` compatibility profile; moving the runtime or package pin to 18.0.11 is a separate release decision.

## Bounded machine receipt

Captured by `scripts/probe-omp-discovery-v18.0.10.mjs` from a disposable Bun host with an isolated project and profile. The receipt is the probe's redacted JSON output; it is not a hand-authored status summary.

```json
{
  "schema": "omp-manager-handoff-probe@2",
  "result": "completed",
  "phaseMode": {
    "mode": "bounded",
    "timeoutMs": 30000,
    "terminalPhase": null,
    "checkpoints": {
      "payload": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:37.147Z",
        "elapsedMs": 5
      },
      "imports": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:37.152Z",
        "elapsedMs": 1936
      },
      "enrollment": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.088Z",
        "elapsedMs": 26
      },
      "capability-config-load": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.114Z",
        "elapsedMs": 26
      },
      "manager-construction": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.140Z",
        "elapsedMs": 0
      },
      "target-only-connection": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.140Z",
        "elapsedMs": 87
      },
      "managed-query": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.227Z",
        "elapsedMs": 58
      },
      "disconnect": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.285Z",
        "elapsedMs": 3
      },
      "receipt": {
        "status": "completed",
        "startedAt": "2026-08-30T14:35:39.288Z",
        "elapsedMs": 0
      }
    }
  },
  "provenance": {
    "harness": {
      "path": "scripts/probe-omp-discovery-v18.0.10.mjs",
      "sha256": "9081452ba88df95cd836b3d018091a7da9903cc2efc712f0c86e89254a644b61"
    },
    "runtime": {
      "name": "@oh-my-pi/pi-coding-agent",
      "version": "18.0.10",
      "packageJsonSha256": "249a813b78d8f33462ae7e00712e79302b3fbd0539ce6b4a3de2c5f33d4ad7f2"
    },
    "package": {
      "name": "omp-spec-kit",
      "version": "0.3.2",
      "packageJsonSha256": "844144e1e4272ea323871686ac7b11d4741d7964590e78b94bfbcb97dfca4ad4",
      "mcpJsonSha256": "848a98db7304d9bafb96cc627c025216007ec18f78c66037b56f52074b5342b6",
      "payload": [
        {
          "relative": "bin/omp-spec-kit-mcp",
          "bytes": 325,
          "sha256": "9a49da3de54e9e75778412689d52afa09bc4a5a9810816f3095ecc7f098a6752"
        },
        {
          "relative": "dist/extension.js",
          "bytes": 3160,
          "sha256": "27070b0922b57c1c26736212f2288aa5f016da20b1639225e4837beada0fc585"
        },
        {
          "relative": "dist/mcp/server.js",
          "bytes": 8311,
          "sha256": "8bae03f08a224704f249fbba40c5ed435c821a94bd3e14038a961637feda43ff"
        }
      ],
      "verification": {
        "distManifest": {
          "relative": "dist/manifest.json",
          "sha256": "aa133e6c16abec36fcd52c8f84b1f4dd161fc60610947fb40cce464564aa5597",
          "expectedSha256": "aa133e6c16abec36fcd52c8f84b1f4dd161fc60610947fb40cce464564aa5597",
          "fileCount": 33,
          "files": [
            {
              "relative": "dist/adapters/document-service.js",
              "bytes": 12350,
              "sha256": "2744b3b649faf1f2bf98dd287f3236e58b037dd1b9f7f14dd5e4507b6a189df2"
            },
            {
              "relative": "dist/adapters/omp/register-spec-tools.js",
              "bytes": 1310,
              "sha256": "4b596ef39bdb9262037a7c8f267a28b91994dcfcf163c7435515e57598177bce"
            },
            {
              "relative": "dist/adapters/query-service.js",
              "bytes": 15518,
              "sha256": "8c911b1375a3a7312eed699fae3b27018e257857889d236cd2b6d045db89a726"
            },
            {
              "relative": "dist/adapters/tool-contracts.js",
              "bytes": 22786,
              "sha256": "f89c1280d13ef45b2ea2a688f408bf369e8aba921705aac3967bc7a94c0eff00"
            },
            {
              "relative": "dist/authoring/proposals.js",
              "bytes": 13161,
              "sha256": "a5a591e19cb336ad4a2ec7d61be306b03b9b7704a6fa9d10bf1444cf4569aafa"
            },
            {
              "relative": "dist/authoring/service.js",
              "bytes": 13074,
              "sha256": "652c8e128dd04b6d3a42ed12328064bbb3ae1ebd6887a394a0410fb1ac3d1952"
            },
            {
              "relative": "dist/authoring/transactions.js",
              "bytes": 6850,
              "sha256": "fc30511ae4d43276d8cffbd8c3e8434b76288241bb50e3fe9c22f19091bc7b3c"
            },
            {
              "relative": "dist/enforcement/adapter.js",
              "bytes": 671,
              "sha256": "99df996ce1e08c08318d1be5799b262a8609de5e535d9a639cc4babc3556660a"
            },
            {
              "relative": "dist/enforcement/classifier.js",
              "bytes": 3577,
              "sha256": "e61cd16a1c84417b898dde3e1340a5837563c9d89cd44e4a77d64a3a7b909dd3"
            },
            {
              "relative": "dist/evidence/service.js",
              "bytes": 7468,
              "sha256": "99b4510c24fbd65f8aaeed92f73b52f9843e2b699b44d78de5dc9dfe3838fe6f"
            },
            {
              "relative": "dist/extension.js",
              "bytes": 3160,
              "sha256": "27070b0922b57c1c26736212f2288aa5f016da20b1639225e4837beada0fc585"
            },
            {
              "relative": "dist/gate/automatic-adapter.js",
              "bytes": 699,
              "sha256": "82c385544c2aa793679512b93ef150cfd382722f0cbcc1dd28b99b710e3d3ed8"
            },
            {
              "relative": "dist/gate/validator.js",
              "bytes": 2032,
              "sha256": "4541d470c5266c7ed22f24c69b2916a0f0f2c9918b013e7bd475c70cf2ee39cd"
            },
            {
              "relative": "dist/inventory.js",
              "bytes": 24144,
              "sha256": "5c10581f0a669525272135e41b458d0055ecdf3a34a8065ff3aad3552032c33f"
            },
            {
              "relative": "dist/kernel/adapters/fs.js",
              "bytes": 8090,
              "sha256": "31e338483be6ebcea53588efd832fa0153febf8e098e55f614206f007abcc38e"
            },
            {
              "relative": "dist/kernel/diagnostics.js",
              "bytes": 2838,
              "sha256": "04c3778d0bcdaae9eccc277ef33004bf0012fdbe2357589452450481c1ec1687"
            },
            {
              "relative": "dist/kernel/graph/build.js",
              "bytes": 37683,
              "sha256": "39616de39352b5b14daa9870ae5458f950301400c667071646458c557b539ce9"
            },
            {
              "relative": "dist/kernel/graph/invariants.js",
              "bytes": 2714,
              "sha256": "bbcde11d9bad8c2d2a751a6a0c972d1aed4e9a64d028258181040d4cd03db04b"
            },
            {
              "relative": "dist/kernel/graph/resolve-edges.js",
              "bytes": 4314,
              "sha256": "a55204d2f8646e5aa19ce63a935c2e514ee197fdd3f943bb98d087d3c8468d3e"
            },
            {
              "relative": "dist/kernel/identity.js",
              "bytes": 3947,
              "sha256": "b0a732c337430be524b950898a54c271e3b22fb7f6e36eaebedb012556239094"
            },
            {
              "relative": "dist/kernel/index.js",
              "bytes": 717,
              "sha256": "1d04597ca7e72451a841e9df62b2bbb3a8d21e0aae5f1128f6f1f1288b162bde"
            },
            {
              "relative": "dist/kernel/limits.js",
              "bytes": 1631,
              "sha256": "4a18582fca95a0fe24073104d62a926580fdbfa5e661d186aa81c6f3716e1938"
            },
            {
              "relative": "dist/kernel/normalize.js",
              "bytes": 2576,
              "sha256": "dcf259789cdbc0f11abe7e11bdfdf1fa564a4a29e947d147d0edf785e9b58979"
            },
            {
              "relative": "dist/kernel/parsers/attributes.js",
              "bytes": 6806,
              "sha256": "8a79158ed9b52eb98ee53f499bdd2943ded87bb781e51a5229f9db52a7cb7792"
            },
            {
              "relative": "dist/kernel/parsers/gherkin.js",
              "bytes": 9137,
              "sha256": "aef0ff89b994a9c803c7c3c984ef1bc43ea61a6576c4b339c12a56e945dbf097"
            },
            {
              "relative": "dist/kernel/parsers/markdown.js",
              "bytes": 24829,
              "sha256": "ce7fc0091763b91565fdfe35775b9a585ce194974d1fe09df70cb1db6b3e7469"
            },
            {
              "relative": "dist/kernel/parsers/md-blocks.js",
              "bytes": 7767,
              "sha256": "93fc7026dfc4924e09478f7e972ce4b286a63628ca12eeca96afd6da081bc8a4"
            },
            {
              "relative": "dist/kernel/parsers/md-inline.js",
              "bytes": 15233,
              "sha256": "e93551d3698b9357ef5aab51eace60cfb3ac10fa60cfd7f04353e48586dc46e1"
            },
            {
              "relative": "dist/kernel/query/cursor.js",
              "bytes": 1617,
              "sha256": "6149e4ad947bc49544d59f78a04b55c410145245ba369b323ce221be29675942"
            },
            {
              "relative": "dist/kernel/query/extended.js",
              "bytes": 21510,
              "sha256": "6c04d2628f0d31326a2219ddd820f7385cd447bf81ee20772f53d041aa24f34b"
            },
            {
              "relative": "dist/kernel/query/service.js",
              "bytes": 48455,
              "sha256": "254119bb02dc746807b910d352801070081335039702b66dae32a426abb4e0af"
            },
            {
              "relative": "dist/kernel/types.js",
              "bytes": 11364,
              "sha256": "ff1a46bba6a1940a5a1aff16d5c3b0e5799790c1418f6b5ae18bceec3a2da883"
            },
            {
              "relative": "dist/mcp/server.js",
              "bytes": 8311,
              "sha256": "8bae03f08a224704f249fbba40c5ed435c821a94bd3e14038a961637feda43ff"
            }
          ]
        },
        "launcher": {
          "relative": "bin/omp-spec-kit-mcp",
          "bytes": 325,
          "sha256": "9a49da3de54e9e75778412689d52afa09bc4a5a9810816f3095ecc7f098a6752",
          "expectedSha256": "9a49da3de54e9e75778412689d52afa09bc4a5a9810816f3095ecc7f098a6752"
        }
      }
    }
  },
  "enrollment": {
    "method": "new PluginManager(cwd).link(packageRoot)",
    "result": {
      "name": "omp-spec-kit",
      "version": "0.3.2",
      "path": "<package-copy>",
      "manifest": {
        "extensions": [
          "./dist/extension.js"
        ],
        "version": "0.3.2"
      },
      "enabledFeatures": null,
      "enabled": true
    },
    "lockfile": {
      "path": "<home>/.omp/profiles/bounded-probe/plugins/omp-plugins.lock.json",
      "sha256": "631aba08e7c5554912e3518e26ce1ef107fd0f3757a5df287ce01f66abfd07c2",
      "contents": {
        "plugins": {
          "omp-spec-kit": {
            "version": "0.3.2",
            "enabledFeatures": null,
            "enabled": true
          }
        },
        "settings": {}
      }
    },
    "link": {
      "path": "<home>/.omp/profiles/bounded-probe/plugins/node_modules/omp-spec-kit",
      "packageJsonSha256": "844144e1e4272ea323871686ac7b11d4741d7964590e78b94bfbcb97dfca4ad4"
    }
  },
  "capability": {
    "id": "mcps",
    "providers": [
      "claude-plugins"
    ],
    "warnings": [
      "[VS Code] Failed to read <project>/.vscode/mcp.json"
    ],
    "items": [
      {
        "name": "omp-spec-kit:omp-spec-kit",
        "command": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/bin/omp-spec-kit-mcp",
        "transport": "stdio",
        "_source": {
          "provider": "claude-plugins",
          "providerName": "Claude Code Marketplace",
          "path": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/.mcp.json",
          "level": "project"
        }
      }
    ],
    "all": [
      {
        "name": "omp-spec-kit:omp-spec-kit",
        "command": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/bin/omp-spec-kit-mcp",
        "transport": "stdio",
        "_source": {
          "provider": "claude-plugins",
          "providerName": "Claude Code Marketplace",
          "path": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/.mcp.json",
          "level": "project"
        }
      }
    ]
  },
  "configLoad": {
    "options": {
      "enableProjectConfig": true,
      "filterExa": true,
      "filterBrowser": false
    },
    "inspection": {
      "targetName": "omp-spec-kit:omp-spec-kit",
      "packageName": "omp-spec-kit",
      "loadedNames": [
        "omp-spec-kit:omp-spec-kit"
      ],
      "targetConfigs": {
        "omp-spec-kit:omp-spec-kit": {
          "type": "stdio",
          "command": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/bin/omp-spec-kit-mcp"
        }
      },
      "targetSources": {
        "omp-spec-kit:omp-spec-kit": {
          "provider": "claude-plugins",
          "providerName": "Claude Code Marketplace",
          "path": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/.mcp.json",
          "level": "project"
        }
      },
      "excludedNames": []
    }
  },
  "manager": {
    "construction": "new MCPManager(cwd)",
    "statusEvents": [
      {
        "type": "connecting",
        "serverNames": [
          "omp-spec-kit:omp-spec-kit"
        ]
      },
      {
        "type": "connected",
        "serverName": "omp-spec-kit:omp-spec-kit"
      }
    ],
    "connectionResult": {
      "connectedServers": [
        "omp-spec-kit:omp-spec-kit"
      ],
      "errors": {},
      "exaApiKeysCount": 0,
      "toolCount": 8,
      "managedQuery": {
        "tool": {
          "name": "mcp__omp_spec_kit_omp_spec_kit_spec_inventory",
          "mcpServerName": "omp-spec-kit:omp-spec-kit",
          "mcpToolName": "spec_inventory"
        },
        "args": {
          "schemaVersion": "spec-kernel@1",
          "requestId": "omp-manager-handoff-probe",
          "specSlugs": [],
          "includeDocuments": false,
          "limit": 50,
          "cursor": null
        },
        "result": {
          "isError": false,
          "details": {
            "serverName": "omp-spec-kit:omp-spec-kit",
            "mcpToolName": "spec_inventory",
            "provider": "claude-plugins",
            "providerName": "Claude Code Marketplace"
          },
          "content": {
            "text": "inventory ok, returned=1/1",
            "returnedCount": 1,
            "observedCount": 1
          }
        },
        "childRoot": {
          "configHasCwd": false,
          "processCwd": "<project>",
          "piUtilsProjectDir": "<project>"
        }
      }
    },
    "disconnect": {
      "before": {
        "serverNames": [
          "omp-spec-kit:omp-spec-kit"
        ],
        "servers": {
          "omp-spec-kit:omp-spec-kit": {
            "source": {
              "provider": "claude-plugins",
              "providerName": "Claude Code Marketplace",
              "path": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/.mcp.json",
              "level": "project"
            },
            "config": {
              "type": "stdio",
              "command": "<home>/.omp/plugins/cache/plugins/omp-spec-kit___omp-spec-kit___0.3.2/bin/omp-spec-kit-mcp"
            },
            "status": "connected"
          }
        }
      },
      "after": {
        "serverNames": [],
        "servers": {}
      }
    },
    "stateAfterDisconnect": {
      "serverNames": [],
      "servers": {}
    }
  }
}
```
