import os
import shutil
import subprocess
from pathlib import Path


def _find_claude() -> str:
    appdata = os.environ.get("APPDATA", "")
    candidates = [
        os.path.join(appdata, "npm", "claude.cmd"),
        os.path.join(appdata, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"),
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return shutil.which("claude") or shutil.which("claude.cmd") or "claude"


def run_claude(prompt: str, timeout: int = 300) -> str:
    exe = _find_claude()
    result = subprocess.run(
        [exe, "-p", prompt],
        capture_output=True, text=True, timeout=timeout,
        encoding="utf-8", errors="replace",
    )
    output = result.stdout.strip()
    if not output:
        raise RuntimeError(f"Claude returned no output. stderr: {result.stderr[:300]}")
    return output


def build_messages_prompt(history: list[dict], system_prompt: str) -> str:
    parts = []
    if system_prompt:
        parts.append(f"<system>\n{system_prompt}\n</system>\n")
    for m in history:
        parts.append(f"{m['role'].upper()}: {m['content']}\n")
    return "\n".join(parts).strip()
