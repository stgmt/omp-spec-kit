import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectRegularFiles,
  createDeterministicTar,
  packageTreeDigest,
  sha256,
  toPublicFileRows,
} from "./release-candidate-utils.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "plugins", "omp-spec-kit");

function fail(message) {
  throw new Error(`candidate portability: ${message}`);
}

function parseArgs(argv) {
  if (argv[0] === "--capture" && argv.length === 2) return { mode: "capture", output: argv[1] };
  if (argv[0] === "--compare" && argv.length === 3) return { mode: "compare", left: argv[1], right: argv[2] };
  fail("usage: --capture <file> | --compare <windows.json> <ubuntu.json>");
}

async function capture() {
  const files = (await collectRegularFiles(packageRoot)).sort((left, right) => left.path.localeCompare(right.path));
  const archive = await createDeterministicTar(files);
  return {
    files: toPublicFileRows(files),
    packageTreeDigest: packageTreeDigest(files),
    archiveSha256: sha256(archive),
  };
}

async function compare(leftPath, rightPath) {
  const left = JSON.parse(await readFile(path.resolve(leftPath), "utf8"));
  const right = JSON.parse(await readFile(path.resolve(rightPath), "utf8"));
  for (const field of ["files", "packageTreeDigest", "archiveSha256"]) {
    if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) {
      fail(`${field} differs between ${leftPath} and ${rightPath}`);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.mode === "capture") {
  const output = path.resolve(args.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(await capture(), null, 2)}\n`, "utf8");
} else {
  await compare(args.left, args.right);
}
