# OMP v17.3.7 plugin contract

`omp-spec-kit` v0.1.0 targets **Oh My Pi v17.3.7** at immutable commit [`8500092296621a6826b7136e840f8a59ea338958`](https://github.com/can1357/oh-my-pi/commit/8500092296621a6826b7136e840f8a59ea338958). Mutable `main` documentation is not the release authority.

## Pinned upstream sources

- [Marketplace guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/marketplace.md)
- [Extensions guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extensions.md)
- [Extension-loading guide](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/docs/extension-loading.md)
- [`cachePlugin` marketplace implementation](https://github.com/can1357/oh-my-pi/blob/8500092296621a6826b7136e840f8a59ea338958/packages/coding-agent/src/extensibility/plugins/marketplace/cache.ts)

The marketplace implementation copies a relative catalog source directory recursively with `fs.cp`. It does not assemble the child package from `package.json#files`. Consequently `plugins/omp-spec-kit/` is itself the complete installable payload. Source, build scripts, tests, evidence, nested manifests, and repository-only files must remain outside that directory. The generated `dist/` directory is the only runtime-code subtree copied into the payload.

The pinned loader discovers installed extension entries from the child manifest's `omp.extensions`. This package declares exactly `./dist/extension.js`; legacy `pi.extensions`, MCP configuration, hooks, and additional extension entries are outside v0.1.0.

## Repository build and validation

Run these commands from the `omp-spec-kit` repository root:

```text
node scripts/build-plugin.mjs
node scripts/verify-marketplace.mjs
node scripts/verify-package.mjs
```

`build-plugin.mjs` deletes and recreates `plugins/omp-spec-kit/dist/` from the external `src/v0.1/` sources. It emits only `extension.js`, `inventory.js`, and deterministic `manifest.json` hashes. The validators reject catalog or package cardinality drift, source escape, symlinks, unexpected payload files, runtime dependencies, non-`node:` external imports, and version disagreement.

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
5. invoke `spec_inventory` there.

Only the fresh-session invocation proves that `dist/extension.js` loaded and registered the tool. Neither marketplace discovery, successful installation, nor `/reload-plugins` alone is activation evidence.
