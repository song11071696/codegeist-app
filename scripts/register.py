#!/usr/bin/env python3
"""Run `forge register` non-interactively by answering its prompts (dev space, terms)."""
import json, re, subprocess, sys
import pexpect

APP_NAME = sys.argv[1] if len(sys.argv) > 1 else "Release Notes Copilot"
help_txt = subprocess.run(["forge", "register", "--help"], capture_output=True, text=True).stdout
print(help_txt)
args = ["register", APP_NAME]
if "--accept-terms" in help_txt:
    # use an existing developer space if one exists
    ls = subprocess.run(["forge", "developer-spaces", "list", "--json"], capture_output=True, text=True)
    print("developer-spaces:", ls.stdout[:500], ls.stderr[:300])
    try:
        spaces = json.loads(ls.stdout)
        if isinstance(spaces, dict):
            spaces = next((v for v in spaces.values() if isinstance(v, list)), [])
        if spaces:
            args += ["-s", spaces[0]["id"]]
    except Exception:
        pass
    args += ["--accept-terms"]
print("running: forge", " ".join(args))
child = pexpect.spawn("forge", args, encoding="utf-8", timeout=240, dimensions=(50, 200))
child.logfile_read = sys.stdout
answered = 0
while True:
    i = child.expect([r"\?\s.*", pexpect.EOF, pexpect.TIMEOUT])
    if i == 1:
        break
    if i == 2:
        print("\n[register.py] timeout waiting for prompt"); child.close(); sys.exit(2)
    answered += 1
    if answered > 8:
        print("\n[register.py] too many prompts, aborting"); child.close(); sys.exit(3)
    line = child.after.lower()
    if re.search(r"\(y/n\)|\[y/n\]|y/n", line):
        child.sendline("y")
    elif "name" in line and "space" in line:
        child.sendline("songdev")
    elif "name" in line:
        child.sendline(APP_NAME)
    else:
        child.sendline("")  # accept default / first choice
child.close()
sys.exit(child.exitstatus or 0)
