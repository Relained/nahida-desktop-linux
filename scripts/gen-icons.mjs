#!/usr/bin/env node
// Generates build/icons/{size}x{size}.png from build/icon.png so that
// electron-builder installs icons into hicolor-indexed size directories.

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512];
const src = resolve("build/icon.png");
const outDir = resolve("build/icons");

if (!existsSync(src)) {
    console.error(`[gen-icons] missing ${src}`);
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

await Promise.all(
    SIZES.map(async (size) => {
        const dest = resolve(outDir, `${size}x${size}.png`);
        await sharp(src).resize(size, size, { fit: "contain" }).png().toFile(dest);
        console.log(`[gen-icons] ${dest}`);
    }),
);
