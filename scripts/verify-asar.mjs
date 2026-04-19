#!/usr/bin/env node
// Walks dist/linux-unpacked/resources/app.asar and verifies that every
// runtime dependency listed in package.json resolves. Catches the class
// of bug where pnpm hoisting leaves a transitive dep out of the asar.

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist/linux-unpacked/resources/app.asar");
if (!existsSync(root)) {
    console.error(`[verify-asar] not found: ${root}`);
    process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = Object.keys(pkg.dependencies ?? {});

const req = createRequire(join(root, "package.json"));
const missing = [];

for (const dep of deps) {
    try {
        req.resolve(dep);
    } catch (err) {
        missing.push({ dep, message: err.message.split("\n")[0] });
    }
}

if (missing.length === 0) {
    console.log(`[verify-asar] OK — ${deps.length} deps resolvable from asar`);
    process.exit(0);
}

console.error(`[verify-asar] FAIL — ${missing.length} unresolvable:`);
for (const { dep, message } of missing) {
    console.error(`  - ${dep}: ${message}`);
}
process.exit(1);
