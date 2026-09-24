---
title: Golden gMSA
category: AD / Credentials
order: 55
tags:
  - gmsa
  - kds-root-key
  - persistence
  - golden-credential
  - dmsa
  - semperis
summary: Dump the forest KDS root key as a forest-root admin, then compute any gMSA's past/present/future password offline, forever — a domain-persistence technique.
prerequisites:
  - "Ability to read msKds-RootKeyData on the KDS root key object: Enterprise/Domain Admin in the FOREST ROOT domain, or SYSTEM on a forest-root DC"
  - "For child domains: SYSTEM on a child DC combined with the --forest flag"
  - This is post-exploitation persistence, NOT privilege escalation — you must already be highly privileged
tools:
  - GoldenGMSA (Semperis)
detection:
  - SACL the 'Master Root Keys' container (inherited to msKds-ProvRootKey objects) and audit reads of msKds-RootKeyData -> Event ID 4662 from any non-DC principal
  - SACL msDS-ManagedPasswordId on gMSA objects to catch cross-trust abuse
  - TrustedSec published Splunk SPL queries for gMSA / KDS-key read patterns
mitigation:
  - Tightly control forest-root Domain/Enterprise Admin and DC SYSTEM access — the only paths to the key
  - Monitor for SACL modifications on the KDS root-key objects themselves
  - If a key is believed compromised, the only real fix is to create a NEW KDS root key and recreate/migrate the gMSAs (Microsoft recovery guidance)
refs:
  - label: GoldenGMSA tool (Semperis)
    url: https://github.com/Semperis/GoldenGMSA
  - label: Semperis - Introducing the Golden gMSA Attack
    url: https://www.semperis.com/blog/golden-gmsa-attack/
  - label: Microsoft - Recover from a Golden gMSA attack
    url: https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/recover-from-golden-gmsa-attack
  - label: Semperis - Golden dMSA (dMSA authentication bypass)
    url: https://www.semperis.com/blog/golden-dmsa-what-is-dmsa-authentication-bypass/
  - label: "Akamai - BadSuccessor: Abusing dMSA (CVE-2025-53779)"
    url: https://www.akamai.com/blog/security-research/abusing-dmsa-for-privilege-escalation-in-active-directory
  - label: TrustedSec - Splunk SPL for detecting gMSA attacks
    url: https://trustedsec.com/blog/splunk-spl-queries-for-detecting-gmsa-attacks
---

## The KDS root key

Every gMSA password (and on Server 2025, every dMSA password) is derived **deterministically** from three inputs: the domain **KDS root key**, the account **SID**, and the account's `msDS-ManagedPasswordId`. There is no per-request randomness that a DC keeps secret — given those three values, the password is pure offline math ([MS-GKDI]).

The KDS root key lives in the forest configuration partition:

```
CN=Master Root Keys,CN=Group Key Distribution Service,CN=Services,CN=Configuration,DC=...
```

Object class `msKds-ProvRootKey`; the 64-byte secret is the `msKds-RootKeyData` attribute. It is only readable by forest-root Domain/Enterprise Admins and SYSTEM on a DC.

## The attack (Yuval Gordon, Semperis, 2022)

Because derivation is offline, an attacker who reads the KDS root key **once** can compute the previous, current, and future password of **any gMSA in the forest — forever — without ever touching a DC again**. Rotating a gMSA's password does nothing: the attacker just recomputes it.

That makes Golden gMSA a **domain-persistence / golden-credential** technique (the gMSA analogue of a Golden Ticket), not a privilege escalation — you must already be forest-root-privileged to grab the key.

## Tool: GoldenGMSA (C#)

```sh
# 1) Dump the KDS root key (needs forest-root DA/EA, or SYSTEM on a forest-root DC)
GoldenGMSA.exe kdsinfo

# 2) Enumerate gMSAs with their SID + ManagedPasswordId (this step is low-priv)
GoldenGMSA.exe gmsainfo

# 3) Compute the password fully OFFLINE from the dumped key + pwdid
GoldenGMSA.exe compute --sid <gMSA-SID> --kdskey <base64_kdskey> --pwdid <base64_pwdid>
```

`compute` also has a "lazy" mode (`--sid` only) that pulls what it needs live if you are still privileged, and a domain-user mode (`--sid --kdskey`) — but the offline mode above is the persistence payoff.

## Prerequisites

- Read access to `msKds-RootKeyData`: **Enterprise/Domain Admin in the forest root**, or **SYSTEM on a forest-root DC** (use `--forest` from a child DC with SYSTEM).

## Why it is a persistence problem

The KDS root key is not rotated on any schedule — it is designed to live for the life of the forest. Once exfiltrated, it yields offline computation of every gMSA (and dMSA) secret indefinitely. **The only real remediation is to create a new KDS root key and recreate/migrate the affected accounts.**

## Detection

- SACL the **Master Root Keys** container (inherited to `msKds-ProvRootKey` objects) and audit reads of `msKds-RootKeyData` -> **Event 4662** from any non-DC principal is a red flag.
- For cross-trust abuse, SACL `msDS-ManagedPasswordId` on gMSA objects. TrustedSec published Splunk SPL for these patterns.

## Mitigation

- Tightly control forest-root DA/EA and DC SYSTEM access — the only ways to reach the key.
- Monitor for SACL modifications on the key objects themselves.

## Related: dMSA / Golden dMSA / BadSuccessor

Windows Server 2025 **delegated MSAs (dMSAs)** use the *same* KDS root key, so a stolen root key also enables **Golden dMSA** (Adi Malyanker, Semperis, 2025) — dMSA passwords can even be brute-forced because the `ManagedPasswordId` has only ~1,024 time-based combinations.

Separately, **BadSuccessor** (**CVE-2025-53779**, Akamai / Yuval Gordon) is a *privilege-escalation* abuse of dMSA migration, not a KDS-key attack: `CreateChild` on an OU lets an attacker create a dMSA and set `msDS-ManagedAccountPrecededByLink` (with `msDS-DelegatedMSAState = 2`, simulating a completed migration) to any user, so the KDC builds a PAC with the target's group memberships. Akamai found 91% of environments had an OU where non-admins could do this. Microsoft patched it (Aug 2025) by requiring **bidirectional** links; follow-up research ("BetterSuccessor") shows residual paths.
