import path from "node:path";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { app, protocol } from "electron";
import { installExtension, REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";
import { IS_ELECTRON } from "./const";
import { DB_FILE_NAME } from "./internal/const";
import { InitDB } from "./internal/db";
import * as schema from "./internal/db/schema";
import Logger from "./internal/logger";
import { NahidaProtocolHandler } from "./internal/protocol";
import Updater from "./internal/updater";
import { IPC } from "./ipc";
import { FS } from "./lib/fs";
import { PathSelector } from "./lib/path-selector";
import Utils from "./lib/utils";
import Watcher from "./lib/watcher";
import { registerProtocal } from "./protocals";
import ArchiveService from "./services/archive";
import ModManager from "./services/mod-manager";
import Setting from "./setting";
import MainWindow from "./windows/main";
import { StartupCleanupService } from "./services/startup-cleanup";

if (IS_ELECTRON) {
    app?.commandLine.appendSwitch("enable-experimental-web-platform-features");
    app?.commandLine.appendSwitch("disable-renderer-backgrounding");
    app?.commandLine.appendSwitch("disable-pinch-zoom");
    app?.commandLine.appendSwitch("disable-pinch");
}

const dbPath = !app.isPackaged ? DB_FILE_NAME : path.join(app.getPath("userData"), "data.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

export class NahidaDesktop {
    public initialized = false;
    public userAgent: string;

    public setting: Setting;
    public readonly ipc: IPC;
    public updater: Updater;
    public logger: Logger;
    public shouldExitOnQuit = false;

    public window: {
        main: MainWindow;
    };
    public lib: {
        db: typeof db;
        fs: FS;
        utils: Utils;
        pathSelector: PathSelector;
        watcher: Watcher;
    };

    public service: {
        mod: ModManager;
        archive: ArchiveService;
        startupCleanup: StartupCleanupService;
    };

    public constructor() {
        this.userAgent = `Nahida Desktop Linux/${app.getVersion()}`;
        this.setting = new Setting(this);
        this.ipc = new IPC(this);
        this.updater = new Updater(this);
        this.logger = new Logger(false, false);
        this.window = { main: new MainWindow(this) };
        this.lib = {
            db,
            fs: new FS(this),
            utils: new Utils(this),
            pathSelector: new PathSelector(this),
            watcher: new Watcher(this),
        };
        this.service = {
            mod: new ModManager(this),
            archive: new ArchiveService(this),
            startupCleanup: new StartupCleanupService(this),
        };
    }

    public async init() {
        if (this.initialized) return;

        await InitDB(this.lib.db);
        await this.service.startupCleanup.runAll();

        const lang = await this.lib.db.query.setting.findFirst({
            where: (t, { eq }) => eq(t.key, "language"),
        });
        if (!lang) {
            const locale = app.getLocale();
            const value = locale === "ko" ? "ko" : locale.startsWith("zh") ? "zh" : "en";
            await this.lib.db.insert(schema.setting).values({ key: "language", value });
        }

        protocol.handle("nahida", async (req) => await NahidaProtocolHandler(this, req));

        this.initialized = true;
        this.updater.initialize();

        const logLevel = await this.setting.general.getLogLevel();
        this.logger.setLevel(logLevel);

        await this.window.main.createMainWindow();
    }
}

export const desktop = new NahidaDesktop();

protocol.registerSchemesAsPrivileged([
    {
        scheme: "local",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            stream: true,
        },
    },
]);

app.whenReady().then(async () => {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        desktop.logger.warn("앱이 이미 실행중임");
        app.quit();
        return;
    }

    if (!app.isPackaged) {
        installExtension(REACT_DEVELOPER_TOOLS)
            .then((ext) => console.log(`Added Extension: ${ext.name}`))
            .catch((err) => console.log("An error occurred: ", err));
    }

    app.on("second-instance", async () => {
        try {
            let mainWindow = desktop.window.main.window;
            if (!mainWindow || mainWindow.isDestroyed()) {
                mainWindow = await desktop.window.main.createMainWindow();
            }
            if (!mainWindow || mainWindow.isDestroyed()) return;
            desktop.window.main.focus();
        } catch (error) {
            desktop.logger.error(`Failed to handle second-instance event: ${error}`, "App");
        }
    });

    electronApp.setAppUserModelId("live.nahida.desktop-linux");
    registerProtocal(desktop);

    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    await desktop.init();
});

app.on("window-all-closed", async () => {
    if (desktop.shouldExitOnQuit) {
        app.quit();
        return;
    }
    const runInBackground = await desktop.setting.general.getRunInBackground();
    if (!runInBackground) app.quit();
});
