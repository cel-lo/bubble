import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  utilityProcess,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
let win: BrowserWindow;
let child: ReturnType<typeof utilityProcess.fork>;
let tray: Tray;
let quitting = false;
/** Settings · General · Close button, kept from the host's state */
let closeAction: "tray" | "quit" = "tray";
const pending = new Map<
  string,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();
function call(method: string, input?: unknown) {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    pending.set(id, { resolve, reject });
    child.postMessage({ id, method, input });
  });
}
// WALT_DATA: separate data folder for tests (fresh first launch); normal runs use %APPDATA%/Walt.
// Set before the lock: the lock lives in userData, so it guards one data folder (one writer per walt.sqlite).
app.setPath("userData", process.env.WALT_DATA || join(app.getPath("appData"), "Walt"));
// Windows shows notifications only for an app with an id
app.setAppUserModelId("local.cello.walt");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => win?.show());
  app.whenReady().then(async () => {
    // how Ce:L starts Walt while it is not running (control.json only exists while Walt runs)
    writeFileSync(join(app.getPath("userData"), "launch.json"), JSON.stringify({ exe: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] }));
    child = utilityProcess.fork(
      join(__dirname, "../host/index.cjs"),
      [app.getPath("userData")],
      { serviceName: "Walt Host" },
    );
    child.on("message", (m: any) => {
      if (m.type === "state") {
        closeAction = m.state?.settings?.closeAction ?? "tray";
        win?.webContents.send("walt:state", m.state);
      }
      else if (m.type === "delta") win?.webContents.send("walt:delta", m.delta);
      else if (m.type === "open") {
        win?.show();
        win?.focus();
        if (m.roomId) win?.webContents.send("walt:open", m.roomId);
      }
      else if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p?.reject(new Error(m.error)) : p?.resolve(m.result);
      }
    });
    child.on("exit", () => {
      for (const p of pending.values())
        p.reject(new Error("Walt Host stopped. Restart to recover."));
      pending.clear();
    });
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      frame: false,
      icon: join(__dirname, "icon.ico"),
      // Ce:L's Start Walt runs it with --background: it waits in the tray until something opens it
      show: !process.argv.includes("--background"),
      backgroundColor: "#1C1C1E",
      title: "Walt",
      webPreferences: {
        preload: join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    ipcMain.handle("walt:call", async (event, method, input) => {
      if (event.sender !== win.webContents) throw new Error("Invalid sender");
      const result: any = await call(method, input);
      // the window reads the whole state once at load: the close setting is in there before any change
      if (method === "snapshot") closeAction = result?.settings?.closeAction ?? "tray";
      return result;
    });
    ipcMain.handle("walt:folder", async () => {
      const r = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
      });
      return r.canceled ? null : r.filePaths[0];
    });
    ipcMain.on("walt:window", (_e, action) => {
      if (action === "minimize") win.minimize();
      if (action === "maximize")
        win.isMaximized() ? win.unmaximize() : win.maximize();
      if (action === "close") closeAction === "quit" ? app.quit() : win.hide();
      if (action === "show") (win.show(), win.focus());
      // Settings · Data & backup
      if (action === "data") void shell.openPath(app.getPath("userData"));
    });
    await win.loadFile(join(__dirname, "../ui/index.html"));
    tray = new Tray(nativeImage.createFromPath(join(__dirname, "icon.ico")));
    tray.setToolTip("Walt");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Walt", click: () => win.show() },
        {
          label: "Quit Walt",
          click: async () => {
            const state: any = await call("snapshot");
            if (
              state.rooms.some((r: any) =>
                ["running", "awaiting_user"].includes(r.state),
              )
            ) {
              const result = await dialog.showMessageBox(win, {
                type: "question",
                buttons: ["Cancel", "Interrupt and quit"],
                defaultId: 0,
                message: "Interrupt running agents and quit Walt?",
              });
              if (result.response === 0) return;
            }
            quitting = true;
            await call("quit").catch(() => {});
            app.quit();
          },
        },
      ]),
    );
    tray.on("double-click", () => win.show());
    win.on("close", (e) => {
      if (quitting) return;
      e.preventDefault();
      closeAction === "quit" ? app.quit() : win.hide();
    });
    // Settings · General · Start with Windows: Windows' own startup list, so it is the one source of truth.
    // Started that way Walt waits in the tray (--background) and the island connects to it.
    const login = { path: process.execPath, args: [...(app.isPackaged ? [] : [app.getAppPath()]), "--background"] };
    ipcMain.handle("walt:login", (_e, on?: boolean) => {
      if (typeof on === "boolean") app.setLoginItemSettings({ ...login, openAtLogin: on });
      return app.getLoginItemSettings(login).openAtLogin;
    });
  });
  app.on("window-all-closed", () => {});
  let stopped = false;
  app.on("before-quit", (e) => {
    quitting = true;
    if (stopped || !child) return;
    // let the host stop every AI process tree (taskkill /T also ends the commands they started) and close the
    // database before Walt exits; give it 5 s, then kill it anyway
    e.preventDefault();
    const exited = new Promise((ok) => child.once("exit", ok));
    void call("quit").catch(() => {});
    void Promise.race([exited, new Promise((ok) => setTimeout(ok, 5000))]).then(() => {
      stopped = true;
      child.kill();
      app.quit();
    });
  });
}
