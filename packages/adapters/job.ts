// Windows Job Object for AI processes: every claude.exe / codex.exe Bubble starts is put in one job marked
// KILL_ON_JOB_CLOSE, and whatever those processes start later (tests, dev servers) joins it automatically.
// The job handle lives in a small PowerShell helper that reads PIDs from Bubble on stdin; when Bubble's host goes away,
// even by crashing, the pipe closes, the helper exits, and Windows ends every process in the job.
// No native module: PowerShell compiles the few kernel32 calls with Add-Type (allowed under Smart App Control here).
import { spawn, type ChildProcess } from "node:child_process";

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class WaltJob {
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long A; public long B; public uint LimitFlags; public UIntPtr C; public UIntPtr D; public uint E; public UIntPtr F; public uint G; public uint H; }
  [StructLayout(LayoutKind.Sequential)] struct Io { public ulong A, B, C, D, E, F; }
  [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic Basic; public Io Io; public UIntPtr P1, P2, P3, P4; }
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateJobObject(IntPtr a, string n);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr j, int c, ref Extended i, uint l);
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static IntPtr job;
  public static bool Init() {
    job = CreateJobObject(IntPtr.Zero, null);
    var i = new Extended(); i.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    return job != IntPtr.Zero && SetInformationJobObject(job, 9, ref i, (uint)Marshal.SizeOf(typeof(Extended)));
  }
  public static bool Add(uint pid) {
    var h = OpenProcess(0x0101, false, pid); // PROCESS_SET_QUOTA | PROCESS_TERMINATE
    if (h == IntPtr.Zero) return false;
    var ok = AssignProcessToJobObject(job, h); CloseHandle(h); return ok;
  }
}
'@
if (-not [WaltJob]::Init()) { [Console]::Out.WriteLine('fail init'); exit 1 }
[Console]::Out.WriteLine('ready')
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $pid2 = [uint32]0
  if ([uint32]::TryParse($line, [ref]$pid2)) { [Console]::Out.WriteLine($(if ([WaltJob]::Add($pid2)) { "ok $pid2" } else { "fail $pid2" })) }
}
`;

export class Job {
  private helper?: ChildProcess;
  /** lines the helper printed ("ready", "ok <pid>", "fail <pid>"), for tests and diagnostics */
  readonly log: string[] = [];
  /** put a process (and everything it starts from now on) in the job; no-op off Windows */
  add(pid?: number) {
    if (process.platform !== "win32" || !pid) return;
    this.helper ??= this.start();
    this.helper.stdin?.write(pid + "\n");
  }
  private start() {
    const p = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(SCRIPT, "utf16le").toString("base64")], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    p.on("error", () => {}); // no PowerShell: Bubble still runs, only without crash containment
    p.stdout?.on("data", (b) => this.log.push(...String(b).split(/\r?\n/).filter(Boolean)));
    return p;
  }
  /** ends the helper, which closes the job and ends every process in it */
  close() {
    this.helper?.stdin?.end();
    this.helper = undefined;
  }
}
