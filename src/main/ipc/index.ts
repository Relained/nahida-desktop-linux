import type { IpcEvents } from "@shared/types.gen";
import { BrowserWindow } from "electron";
import type { NahidaDesktop } from "../index";
import { registerLoggerHandlers } from "./handlers/logger";
import { registerModHandlers } from "./handlers/mod";
import { registerPathSelectorHandlers } from "./handlers/path-selector";
import { registerSettingHandlers } from "./handlers/setting";
import { registerUtilHandlers } from "./handlers/util";
import { registerWindowHandlers } from "./handlers/window";

export class IPC {
    private d: NahidaDesktop;

    constructor(d: NahidaDesktop) {
        this.d = d;
        this.setupHandlers();
    }

    private setupHandlers() {
        registerSettingHandlers(this.d);
        registerUtilHandlers(this.d);
        registerWindowHandlers(this.d);
        registerLoggerHandlers(this.d);
        registerPathSelectorHandlers();
        registerModHandlers(this.d);
    }

    public postMessageToWindow<K extends keyof IpcEvents>(
        window: BrowserWindow,
        channel: K,
        ...args: Parameters<IpcEvents[K]>
    ) {
        window.webContents.send(channel, ...args);
    }

    public broadcast<K extends keyof IpcEvents>(channel: K, ...args: Parameters<IpcEvents[K]>) {
        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send(channel, ...args);
        });
    }
}
