#!/usr/bin/env python3
"""AIOT00L — Windows DNS / adapter toolkit. Created by TheYoqaizo."""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from datetime import datetime

PROVIDERS = [
    ("403", "185.55.226.26", "185.55.225.25"),
    ("Shecan", "178.22.122.100", "185.51.200.2"),
    ("Electro", "78.157.42.100", "78.157.42.101"),
    ("Google DNS", "8.8.8.8", "8.8.4.4"),
    ("Cloudflare", "1.1.1.1", "1.0.0.1"),
    ("OpenDNS", "208.67.222.222", "208.67.220.220"),
    ("Quad9", "9.9.9.9", "149.112.112.112"),
    ("Comodo", "8.26.56.26", "8.20.247.20"),
    ("CleanBrowsing", "185.228.168.9", "185.228.169.9"),
    ("AdGuard", "94.140.14.14", "94.140.15.15"),
    ("Yandex", "77.88.8.8", "77.88.8.1"),
    ("403 Online", "10.202.10.202", "10.202.10.102"),
    ("Radar Game", "10.202.10.10", "10.202.10.11"),
    ("Shelter", "185.86.136.241", "185.86.136.242"),
    ("Level3", "4.2.2.4", "4.2.2.1"),
]


def is_admin() -> bool:
    if os.name != "nt":
        return True
    try:
        import ctypes

        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def elevate() -> None:
    if os.name != "nt":
        return
    import ctypes

    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, subprocess.list2cmdline([os.path.abspath(__file__)]), None, 1
    )


def run_cmd(cmd: str) -> tuple[int, str]:
    completed = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    blob = (completed.stdout or "") + (completed.stderr or "")
    return completed.returncode, blob.strip()


def list_adapters() -> list[str]:
    code, out = run_cmd("netsh interface show interface")
    names: list[str] = []
    if code != 0:
        return ["Ethernet", "Wi-Fi"]
    for line in out.splitlines()[3:]:
        parts = line.split()
        if len(parts) >= 4:
            names.append(" ".join(parts[3:]))
    return names or ["Ethernet", "Wi-Fi"]


def main() -> None:
    if os.name == "nt" and not is_admin():
        elevate()
        return

    import tkinter as tk
    from tkinter import ttk

    BG, SUR, FG, MUT, ACC, DANGER = "#070A09", "#0C1210", "#D4EDE0", "#7C9A8A", "#3EEA8A", "#E85D5D"

    root = tk.Tk()
    root.title("AIOT00L  —  Network Command Center")
    root.geometry("980x720")
    root.minsize(720, 560)
    root.configure(bg=BG)

    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except tk.TclError:
        pass
    style.configure("TFrame", background=BG)
    style.configure("TLabel", background=BG, foreground=FG)
    style.configure("Muted.TLabel", background=BG, foreground=MUT)
    style.configure("Accent.TLabel", background=BG, foreground=ACC)
    style.configure("TButton", background=SUR, foreground=FG, padding=8)
    style.map("TButton", background=[("active", "#121A16")])

    header = ttk.Frame(root)
    header.pack(fill="x", padx=16, pady=(16, 8))
    ttk.Label(header, text="A I O T 0 0 L", style="Accent.TLabel", font=("Consolas", 22)).pack(anchor="w")
    ttk.Label(
        header,
        text="Network Command Center  ·  Created by TheYoqaizo  ·  same protocol, no typewriter lag",
        style="Muted.TLabel",
    ).pack(anchor="w")

    row = ttk.Frame(root)
    row.pack(fill="x", padx=16, pady=8)
    ttk.Label(row, text="Interface", style="Muted.TLabel").pack(side="left", padx=(0, 8))
    iface_var = tk.StringVar()
    adapters = list_adapters()
    combo = ttk.Combobox(row, textvariable=iface_var, values=adapters, width=36)
    combo.pack(side="left")
    if adapters:
        combo.current(0)
    status = ttk.Label(row, text="Ready", style="Accent.TLabel")
    status.pack(side="left", padx=16)

    log = tk.Text(root, bg="#121A16", fg=ACC, insertbackground=FG, relief="flat", font=("Consolas", 11), wrap="word")
    log.pack(fill="both", expand=True, padx=16, pady=(8, 16))

    def write(msg: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        log.insert("end", f"[{stamp}] {msg}\n")
        log.see("end")

    def tool(cmd: str) -> bool:
        write(f"> {cmd}")
        code, out = run_cmd(cmd)
        write("OK" if code == 0 else f"FAILED ({code})")
        if out:
            write(out)
        return code == 0

    def iface() -> str:
        return iface_var.get().strip() or "Ethernet"

    def bg(fn) -> None:
        def wrap() -> None:
            try:
                fn()
            finally:
                status.config(text="Ready")

        threading.Thread(target=wrap, daemon=True).start()

    def inject(a: str, b: str) -> None:
        status.config(text="Injecting DNS...")
        def go() -> None:
            i = iface()
            tool(f'netsh interface ip set dns "{i}" static {a}')
            tool(f'netsh interface ip add dns "{i}" {b} index=2')
            write(f"DNS injection complete: {a}, {b}")
        bg(go)

    def reset_adapter() -> None:
        status.config(text="Resetting adapter...")
        def go() -> None:
            i = iface()
            tool("ipconfig /flushdns")
            tool("netsh int ip reset")
            tool(f'netsh interface set interface "{i}" disable')
            time.sleep(0.4)
            tool(f'netsh interface set interface "{i}" enable')
            tool("ipconfig /release")
            tool("ipconfig /renew")
            tool("ipconfig /registerdns")
            write("Adapter and DNS reset executed.")
        bg(go)

    def reset_dns() -> None:
        status.config(text="Resetting DNS...")
        def go() -> None:
            i = iface()
            tool(f'netsh interface ip set dnsservers "{i}" source=dhcp')
            tool("ipconfig /flushdns")
            tool("ipconfig /registerdns")
            tool("ipconfig /release")
            tool("ipconfig /renew")
            tool(f'netsh interface ip show config "{i}"')
            write("DNS reset complete.")
        bg(go)

    ops = ttk.Frame(root)
    ops.pack(fill="x", padx=16)
    for label, cb in [
        ("Reset Adapter", reset_adapter),
        ("Reset DNS (DHCP)", reset_dns),
        ("Flush DNS", lambda: bg(lambda: tool("ipconfig /flushdns"))),
        ("Current DNS", lambda: bg(lambda: tool(f'netsh interface ip show dns "{iface()}"'))),
        ("Ping 4.2.2.4 x4", lambda: bg(lambda: tool("ping 4.2.2.4 -n 4"))),
    ]:
        ttk.Button(ops, text=label, command=cb).pack(side="left", padx=(0, 8), pady=4)

    dns_row = ttk.Frame(root)
    dns_row.pack(fill="x", padx=16, pady=8)
    for name, a, b in PROVIDERS:
        ttk.Button(dns_row, text=name, command=lambda a=a, b=b: inject(a, b)).pack(side="left", padx=(0, 6), pady=2)

    custom = ttk.Frame(root)
    custom.pack(fill="x", padx=16, pady=(0, 8))
    a_var, b_var = tk.StringVar(value="1.1.1.1"), tk.StringVar(value="1.0.0.1")
    tk.Entry(custom, textvariable=a_var, bg="#121A16", fg=FG, insertbackground=FG, relief="flat", width=18).pack(
        side="left", padx=(0, 8), ipady=6
    )
    tk.Entry(custom, textvariable=b_var, bg="#121A16", fg=FG, insertbackground=FG, relief="flat", width=18).pack(
        side="left", padx=(0, 8), ipady=6
    )
    ttk.Button(custom, text="Apply custom DNS", command=lambda: inject(a_var.get().strip(), b_var.get().strip())).pack(
        side="left"
    )

    write("AIOT00L online.")
    write("Original protocol preserved. Cosmetic delays removed.")
    if os.name != "nt":
        write("This host is not Windows — commands will fail here. Run the .exe on Windows.")
    root.mainloop()


if __name__ == "__main__":
    main()
