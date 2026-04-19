import { spawn } from "node:child_process";
import path from "node:path";
import fse from "fs-extra";
import type { NahidaDesktop } from "..";

interface ExtractOptions {
    flattenSingleRoot?: boolean;
}

function run(
    cmd: string,
    args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (c) => (stdout += c.toString()));
        child.stderr.on("data", (c) => (stderr += c.toString()));
        child.on("error", reject);
        child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    });
}

async function listArchive(archivePath: string): Promise<string[]> {
    const { code, stdout, stderr } = await run("7z", ["l", "-slt", archivePath]);
    if (code !== 0) throw new Error(`7z list failed: ${stderr || stdout}`);
    const entries: string[] = [];
    for (const block of stdout.split(/\n\n/)) {
        const m = /^Path = (.+)$/m.exec(block);
        if (m) entries.push(m[1]);
    }
    return entries;
}

export class ArchiveService {
    constructor(_desktop: NahidaDesktop) {}

    async hasSingleTopLevelDirectory(archivePath: string): Promise<boolean> {
        const entries = await listArchive(archivePath);
        const roots = new Set<string>();
        for (const e of entries) {
            if (!e) continue;
            const first = e.split(/[\\/]/)[0];
            if (first) roots.add(first);
            if (roots.size > 1) return false;
        }
        return roots.size === 1;
    }

    async extract(
        archivePath: string,
        targetDir: string,
        options?: ExtractOptions,
        _onProgress?: (percent: number, message: string) => void,
    ): Promise<string> {
        await fse.ensureDir(targetDir);

        const { code, stdout, stderr } = await run("7z", [
            "x",
            archivePath,
            `-o${targetDir}`,
            "-y",
        ]);
        if (code !== 0) throw new Error(`Failed to extract archive: ${stderr || stdout}`);

        if (options?.flattenSingleRoot) {
            const entries = await fse.readdir(targetDir);
            if (entries.length === 1) {
                const only = path.join(targetDir, entries[0]);
                const stat = await fse.stat(only);
                if (stat.isDirectory()) return only;
            }
        }

        return targetDir;
    }
}

export default ArchiveService;
