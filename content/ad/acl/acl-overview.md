---
title: ACL abuse overview
category: AD / ACL abuse
order: 10
tags: [acl, bloodhound, bloodyad, dacledit, edges, dacl]
summary: >
  BloodHound edges are the map; this is the key. Each dangerous right over an
  object has a concrete abuse — reset a password, add yourself to a group, grant
  DCSync, add shadow credentials. bloodyAD and the impacket *edit tools do it
  over LDAP from Linux.
prerequisites:
  - A controlled principal that holds a dangerous right over a target (from BloodHound)
  - LDAP reach to a DC ($dc_ip)
tools: [bloodyAD, impacket (dacledit, owneredit), PowerView, net rpc, pyWhisker, Certipy, targetedKerberoast, Rubeus]
detection:
  - Directory object modifications (5136) on ACLs, group membership, msDS-KeyCredentialLink, servicePrincipalName
  - Password resets (4724) not initiated by helpdesk
mitigation:
  - Remove unnecessary ACEs; tier the model; monitor writes to Tier-0 objects and the domain DACL
refs:
  - { label: "The Hacker Recipes — ACEs", url: "https://www.thehacker.recipes/ad/movement/dacl" }
  - { label: "bloodyAD", url: "https://github.com/CravateRouge/bloodyAD" }
  - { label: "SpecterOps — abusing ACLs", url: "https://posts.specterops.io/" }
---

## Edge → abuse

| BloodHound edge | On | Abuse |
|---|---|---|
| `GenericAll` / `GenericWrite` | user | Shadow Credentials, targeted Kerberoast, set SPN, reset (with FCP) |
| `GenericAll` / `GenericWrite` | computer | Shadow Credentials, **RBCD** |
| `GenericAll` | group | add yourself as member |
| `ForceChangePassword` | user | reset the password (no old pw) |
| `AddMember` / `AddSelf` | group | join the group |
| `WriteDacl` | any | grant yourself FullControl / **DCSync** on the domain |
| `WriteOwner` | any | take ownership → then WriteDacl |
| `AddKeyCredentialLink` | user/computer | Shadow Credentials → PKINIT |
| `WriteSPN` | user | targeted Kerberoast |
| `ReadGMSAPassword` | gMSA | read the managed password |
| `ReadLAPSPassword` | computer | read the local admin password |

## Find what you can write

```sh
# bloodyAD: list objects your user can write to
bloodyAD -u $user -p $password -d $domain --host $dc_ip get writable
# BloodHound: mark owned, then "Outbound Object Control" from your principal
```

## Chains to remember

- `GenericWrite`/`GenericAll` on a **computer** → **RBCD** or Shadow Credentials
  → own the host (see Delegation / RBCD, and Shadow Credentials).
- `WriteDacl` on the **domain** object → grant yourself **DCSync** → dump krbtgt.
- `GenericWrite` on a **user** → **Shadow Credentials** (quiet) or **targeted
  Kerberoast** (needs a crackable password) or reset via `ForceChangePassword`.

> Prefer **Shadow Credentials** over password resets on real accounts: it doesn't
> lock anyone out and is trivially reversible (remove the key you added).
