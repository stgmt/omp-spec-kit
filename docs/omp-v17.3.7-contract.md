# OMP v17.3.7 plugin contract

Historical v0.1.0 and the current public v0.3.2 baseline target **Oh My Pi v17.3.7** at immutable commit [`8500092296621a6826b7136e840f8a59ea338958`](https://github.com/can1357/oh-my-pi/commit/8500092296621a6826b7136e840f8a59ea338958). Mutable `main` documentation is not authority.

## Pinned upstream sources

- [Marketplace guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md)
- [Extensions guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md)
- [Extension-loading guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extension-loading.md)
- [`cachePlugin` marketplace implementation](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/extensibility/plugins/marketplace/cache.ts)

The marketplace implementation copies a relative catalog source directory recursively with `fs.cp`. It does not assemble the child package from `package.json#files`. Consequently `plugins/omp-spec-kit/` is itself the complete installable payload. Source, build scripts, tests, evidence, nested manifests, and repository-only files must remain outside that directory. The generated `dist/` directory is the only runtime-code subtree copied into the payload.

The pinned loader discovers one extension entry `./dist/extension.js`. Historical v0.1.0 had no MCP config; delivered v0.3.2 additionally has one `.mcp.json` server identity and two contained launchers while preserving one child package/extension. Legacy `pi.extensions`, a second server/factory, hooks and nested control planes remain forbidden.

## Repository build and validation

Run these commands from the `omp-spec-kit` repository root:

```text
node scripts/build-plugin.mjs
node scripts/verify-marketplace.mjs
node scripts/verify-package.mjs
```

`build-plugin.mjs` recreates `plugins/omp-spec-kit/dist/` from `src/v0.1/{extension,inventory}.js` plus closed root `src/{kernel,adapters,mcp}` trees and emits deterministic `manifest.json` hashes. Validators reject profile/cardinality drift, escape/links, unexpected child files, runtime dependencies, non-`node:` ambient imports and version disagreement.

## Marketplace lifecycle commands

In OMP v17.3.7, add the public repository marketplace and install the one plugin at project scope:

```text
/marketplace add https://github.com/stgmt/omp-spec-kit.git
/marketplace install --scope project omp-spec-kit@omp-spec-kit
/reload-plugins
```

Use `/marketplace update omp-spec-kit` to refresh catalog metadata. A catalog update does not reinstall the plugin; use `/marketplace upgrade --scope project omp-spec-kit@omp-spec-kit` for a later released version. Marketplace removal is also distinct from plugin uninstall.

## Reload versus activation

`/reload-plugins` refreshes reloadable plugin surfaces such as skills and commands in the current session. It does **not** initialize a newly installed extension tool in that already-running session. After installation:

1. record the install result;
2. run `/reload-plugins` only as its own observation;
3. terminate the pre-install OMP session;
4. start a fresh OMP v17.3.7 session in the target project; and
5. invoke the declared candidate surface there (`spec_inventory` for the original profile; extension/MCP first-slice checks for v0.3.2).

Only fresh-session invocation proves the installed extension/MCP profile activated. Discovery, install and reload alone are insufficient.

## Plan-approval ABI limit

Pinned v17.3.7 resolves `local://` under the session artifacts directory before its temp fallback, and native approval searches the supplied-title path, state path and scanned plan candidates. It exposes no extension event carrying the exact plan selected after that resolver. Automatic plan-gate interception is therefore `DEFERRED_HOST_ABI` on this pin; guessed temp paths or duplicate fallback search are unsupported.

The required future ABI is specified in [`omp-plan-approval-event-contract.md`](omp-plan-approval-event-contract.md). Manual/advisory validation of an explicitly supplied plan may be implemented independently and must not be presented as automatic approval interception.
