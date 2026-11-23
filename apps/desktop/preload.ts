import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("walt", {
  call: (method: string, input: unknown) =>
    ipcRenderer.invoke("walt:call", method, input),
  folder: () => ipcRenderer.invoke("walt:folder"),
  // Start with Windows: read it, or set it with on
  login: (on?: boolean) => ipcRenderer.invoke("walt:login", on),
  window: (action: string) => ipcRenderer.send("walt:window", action),
  subscribe: (fn: (value: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => fn(state);
    ipcRenderer.on("walt:state", listener);
    return () => ipcRenderer.removeListener("walt:state", listener);
  },
  // the host asks to open a chat
  opened: (fn: (roomId: string) => void) => {
    const listener = (_event: unknown, id: string) => fn(id);
    ipcRenderer.on("walt:open", listener);
    return () => ipcRenderer.removeListener("walt:open", listener);
  },
  // Browser: a page asked for a new window; it opens as a tab in the chat whose page asked ({ url, from })
  browserTab: (fn: (v: { url: string; from: number }) => void) => {
    const listener = (_event: unknown, v: { url: string; from: number }) => fn(v);
    ipcRenderer.on("walt:browser-tab", listener);
    return () => ipcRenderer.removeListener("walt:browser-tab", listener);
  },
  // streaming text of one message: { room, id, text }
  delta: (fn: (value: unknown) => void) => {
    const listener = (_event: unknown, d: unknown) => fn(d);
    ipcRenderer.on("walt:delta", listener);
    return () => ipcRenderer.removeListener("walt:delta", listener);
  },
});
