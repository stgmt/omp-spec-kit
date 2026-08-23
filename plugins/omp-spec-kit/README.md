# omp-spec-kit

`omp-spec-kit` v0.1.0 adds one read-only OMP tool, `spec_inventory`, plus guidance for using it. The tool inventories direct children of `.specs` under the active project's `ctx.cwd`; it never writes, repairs, or claims that a specification is complete.

## Use

Ask OMP to call `spec_inventory` for the active project. Optional request fields narrow the returned entries; the tool's schema documents their bounds and defaults.

The command `/spec-inventory` and skill `spec-inventory` provide guidance only. They do not implement a second scanner or runtime.

## Compatibility

This payload targets OMP v17.3.7 at commit `8500092296621a6826b7136e840f8a59ea338958`. Installing or reloading plugin metadata does not activate a newly installed extension in an already-running session; start a fresh OMP session before invoking the tool.

License: MIT.
