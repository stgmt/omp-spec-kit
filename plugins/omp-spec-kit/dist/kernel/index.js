// Public kernel entry point. The pure kernel exports exactly:
//   KERNEL_SCHEMA_VERSION  - literal "spec-kernel@1"
//   buildKernelGraph({ files }) -> { graph, diagnostics }
//   query(graph, operation, params) -> canonical QueryEnvelope
// Filesystem access lives only in ./adapters/fs.js (readRepositorySpecs).

import { KERNEL_SCHEMA_VERSION } from "./types.js";
import { buildKernelGraph } from "./graph/build.js";
import { executeQuery } from "./query/service.js";

export { KERNEL_SCHEMA_VERSION, buildKernelGraph };

export function query(graph, operation, params) {
  return executeQuery(graph, {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    requestId: null,
    operation,
    args: params ?? {},
  });
}
