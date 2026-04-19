import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import isDev from "@main/internal/isDev";
import type { AppStatus, PathMetadata } from "@shared/types.gen";
import {
    BrowserWindow,
    clipboard,
    dialog,
    type MessageBoxOptions,
    type OpenDialogOptions,
    type OpenExternalOptions,
    shell,
} from "electron";
import { app } from "electron/main";
import { trim } from "es-toolkit";
import fse from "fs-extra";
import { desktop } from "..";

export function getAppStatus(): AppStatus {
    return {
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        isDev: isDev,
        platform: process.platform,
    };
}

export type ShowModalReturnValue = ReturnType<typeof dialog.showMessageBox>;

export async function showModal(options: MessageBoxOptions) {
    return dialog.showMessageBox({
        type: options.type,
        title: options.title,
        message: options.message,
    });
}

export async function openExternal(str: string, opt?: OpenExternalOptions) {
    try {
        try {
            const parsedUrl = new URL(str);
            await shell.openExternal(parsedUrl.toString(), opt);
        } catch {
            await shell.openPath(str);
        }
    } catch (error) {
        desktop.logger.error(error, `util:openExternal`);
        throw error;
    }
}

export function closeAllWindows() {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
        window.close();
    });
}

export function copyStr(str: string) {
    clipboard.writeText(str);
}

export function openPath(path: string) {
    shell.openPath(path);
}

async function tryGioTrash(target: string): Promise<{ ok: boolean; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn("gio", ["trash", "--", target], { stdio: "pipe" });
        let stderr = "";
        proc.stderr.on("data", (c) => {
            stderr += c.toString();
        });
        proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
        proc.on("close", (code) => resolve({ ok: code === 0, stderr: stderr.trim() }));
    });
}

async function findMount(abs: string): Promise<string> {
    const mounts = (await fsp.readFile("/proc/mounts", "utf8"))
        .split("\n")
        .map((line) => line.split(" ")[1])
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    for (const m of mounts) {
        const prefix = m.endsWith("/") ? m : `${m}/`;
        if (abs === m || abs.startsWith(prefix)) return m;
    }
    return "/";
}

async function xdgTrashFallback(target: string): Promise<void> {
    const abs = path.resolve(target);
    const mount = await findMount(abs);
    const uid = os.userInfo().uid;
    const trashRoot = path.join(mount, `.Trash-${uid}`);
    const filesDir = path.join(trashRoot, "files");
    const infoDir = path.join(trashRoot, "info");
    await fsp.mkdir(filesDir, { recursive: true, mode: 0o700 });
    await fsp.mkdir(infoDir, { recursive: true, mode: 0o700 });

    const baseName = path.basename(abs);
    let destName = baseName;
    let i = 1;
    while (true) {
        try {
            await fsp.access(path.join(filesDir, destName));
            destName = `${baseName}.${i++}`;
        } catch {
            break;
        }
    }

    const relPath = path.relative(mount, abs);
    const encodedPath = encodeURI(relPath).replace(/#/g, "%23");
    const deletionDate = new Date().toISOString().replace(/\.\d+Z$/, "");
    const info = `[Trash Info]\nPath=${encodedPath}\nDeletionDate=${deletionDate}\n`;
    await fsp.writeFile(path.join(infoDir, `${destName}.trashinfo`), info);
    await fsp.rename(abs, path.join(filesDir, destName));
}

export async function trash(targetPath: string) {
    const gio = await tryGioTrash(targetPath);
    if (gio.ok) return;
    try {
        await xdgTrashFallback(targetPath);
    } catch (fallbackErr) {
        const detail = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new Error(
            `Failed to move item to trash. gio: ${gio.stderr || "unknown"}. fallback: ${detail}`,
        );
    }
}

export async function mkdir(parentPath: string, name: string): Promise<string> {
    const trimmedName = trim(name);
    if (!trimmedName) {
        throw new Error("INVALID_GROUP_NAME");
    }

    desktop.lib.fs.assertValidWindowsFilename(trimmedName);

    const nextPath = path.join(parentPath, trimmedName);
    try {
        await fsp.mkdir(nextPath);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        const name = (error as NodeJS.ErrnoException | undefined)?.name;
        if (code === "EEXIST" || name === "AlreadyExists") {
            throw new Error(`ALREADY_EXISTS:${trimmedName}`);
        }
        throw error;
    }

    return nextPath;
}

export function openCmd(path: string) {
    spawn("cmd.exe", ["/c", "start", "cmd.exe"], {
        cwd: path,
        detached: true,
        stdio: "ignore",
    }).unref();
}

export function getClipboardFiles(): string[] {
    const buffer = clipboard.readBuffer("FileNameW");
    if (buffer && buffer.length > 0) {
        const path = buffer.toString("ucs2").replace(/\0+$/, "");
        if (path) return [path];
    }

    const text = clipboard.read("text/uri-list");
    if (text) {
        return text
            .split(/\r?\n/)
            .filter((line) => line.trim().startsWith("file://"))
            .map((line) => {
                const url = new URL(line.trim());
                let p = decodeURIComponent(url.pathname);
                if (process.platform === "win32" && p.startsWith("/")) {
                    p = p.slice(1);
                }
                return p;
            });
    }

    return [];
}

export async function getPathMetadata(path: string): Promise<PathMetadata> {
    const stat = await fse.stat(path);
    return {
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        birthtime: stat.birthtime,
    };
}

export async function showOpenDialog(options: OpenDialogOptions) {
    return dialog.showOpenDialog(options);
}

export async function processChunked<T>(
    items: T[],
    processor: (item: T) => void,
    size = 1000,
    signal?: AbortSignal,
) {
    const CHUNK_SIZE = size;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        if (signal?.aborted) return;
        const end = Math.min(i + CHUNK_SIZE, items.length);
        for (let j = i; j < end; j++) {
            processor(items[j]);
        }
        if (i + CHUNK_SIZE < items.length) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
}

