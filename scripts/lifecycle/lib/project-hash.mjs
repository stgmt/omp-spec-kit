// Shared lifecycle runner helpers. Extracted from
// run-lifecycle-uninstall-reinstall.mjs so the upgrade runner computes the
// same project-preservation hash over the exact same algorithm.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export function fail(message) {
	process.stderr.write(`lifecycle: ${message}\n`);
	process.exit(1);
}

// sha256 over every regular file under root (sorted relative POSIX paths,
// relative path + NUL + bytes + NUL per entry). Any non-regular entry fails.
export async function projectHash(root, label) {
	const files = [];
	async function visit(absolute, relative) {
		const entries = await readdir(absolute, { withFileTypes: true });
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const childAbsolute = path.join(absolute, entry.name);
			const childRelative = relative === "" ? entry.name : path.posix.join(relative, entry.name);
			if (entry.isDirectory()) {
				await visit(childAbsolute, childRelative);
			} else if (entry.isFile()) {
				files.push({ relative: childRelative.split("\\").join("/"), bytes: await readFile(childAbsolute) });
			} else {
				fail(`project tree contains a non-regular entry at ${childRelative}`);
			}
		}
	}
	await visit(root, "");
	files.sort((a, b) => a.relative.localeCompare(b.relative));
	const hash = createHash("sha256");
	for (const file of files) {
		hash.update(file.relative);
		hash.update("\0");
		hash.update(file.bytes);
		hash.update("\0");
	}
	return { label, fileCount: files.length, digest: hash.digest("hex") };
}
