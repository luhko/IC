---
title: BloodHound
category: AD / Recon
order: 20
tags: [bloodhound, sharphound, graph, acl, paths]
summary: >
  Collect the domain into a graph and let it compute attack paths (shortest path
  to Domain Admins, kerberoastable, delegation, ACL edges). The single best use
  of your first low-priv account.
prerequisites:
  - Any valid domain account ($user / $password or $nthash)
  - LDAP reachable to a DC ($dc_ip)
tools: [bloodhound-python, netexec, SharpHound, Certipy, bloodhound-ce]
detection:
  - Heavy LDAP + SAMR enumeration in a short window
  - SharpHound session enumeration (SMB to many hosts) — event 5145/4624
mitigation:
  - Tier the environment, remove needless ACLs and stale admin rights
  - Monitor for mass LDAP queries; alert on SharpHound collection patterns
refs:
  - { label: "BloodHound docs", url: "https://bloodhound.specterops.io/" }
  - { label: "SpecterOps blog", url: "https://posts.specterops.io/" }
  - { label: "bloodhound-python", url: "https://github.com/dirkjanm/BloodHound.py" }
---

## Collect

From Linux, no agent needed:

```sh
# python collector (BloodHound CE: add --zip and use the right schema)
bloodhound-python -u $user -p $password -d $domain -ns $dc_ip -c All --zip
```

```sh
# or straight from netexec (writes an ingestible zip)
netexec ldap $dc_ip -u $user -p $password --bloodhound --collection-method All
```

```sh
# add certificate services data (ADCS / ESC) to the same graph
certipy find -u $user@$domain -p $password -dc-ip $dc_ip -bloodhound
```

On Windows, `SharpHound.exe -c All` (or the `.ps1`). Prefer `DCOnly` when you
must stay quiet — it skips per-host session enumeration.

## What to look for

Import the zip, then run these built-in / cypher queries:

- **Shortest paths to Domain Admins** — the headline result.
- **Kerberoastable / AS-REP-roastable users** — mark as owned after cracking.
- **Unconstrained / constrained / RBCD delegation** — see Delegation pages.
- **ACL edges from owned principals** — `GenericAll`, `GenericWrite`,
  `WriteDacl`, `WriteOwner`, `ForceChangePassword`, `AddKeyCredentialLink`
  (Shadow Credentials). See the ACL abuse section.
- **Sessions of high-value users** — where a DA token is sitting.

> Mark each account "Owned" as you compromise it; BloodHound re-computes paths
> from your owned set, which is where the real chains appear.
