---
title: Cloud password spraying (Entra ID / M365)
category: AD / Entra ID
order: 40
tags:
  - entra
  - m365
  - password-spray
  - smart-lockout
  - msolspray
  - teamfiltration
  - trevorspray
  - initial-access
summary: One or two likely passwords sprayed across a validated cloud user list, throttled under Smart Lockout. Several Entra endpoints confirm a valid password even when the final sign-in is blocked by MFA or Conditional Access, so a spray turns a user list into logged credential hits for later token or AiTM work.
prerequisites:
  - A validated list of usernames / UPNs ($upn) for the target tenant ($tenant / $domain)
  - The tenant's auth type (managed vs federated/ADFS) and awareness that Smart Lockout is on by default
  - "Optional: an IP-rotation path (FireProx / proxy pool) to blunt lockout and IP throttling"
tools:
  - MSOLSpray
  - o365spray
  - TeamFiltration
  - TREVORspray
  - Spray365
  - FireProx
detection:
  - "Entra sign-in logs: many failures across accounts from few source IPs; bursts of AADSTS50126, spikes of AADSTS50053 (lockout)"
  - Entra ID Protection 'password spray' risk detection and risky sign-ins
  - Non-interactive sign-in logs and Unified Audit Log for token-endpoint hits; the WS-Trust autologon path leaves few interactive-log traces
mitigation:
  - Enforce MFA for all users and block legacy authentication via Conditional Access (legacy protocols cannot enforce MFA)
  - Tune Smart Lockout thresholds; enable Entra Password Protection / banned-password lists
  - Disable or closely monitor the legacy WS-Trust autologon (Seamless SSO) endpoint; use ID Protection to block risky sign-ins
refs:
  - label: MSOLSpray (dafthack)
    url: https://github.com/dafthack/MSOLSpray
  - label: TeamFiltration - Spraying wiki (Flangvik)
    url: https://github.com/Flangvik/TeamFiltration/wiki/Spraying
  - label: TREVORspray (BlackLanternSecurity)
    url: https://github.com/blacklanternsecurity/TREVORspray
  - label: Varonis - WS-Trust autologon endpoint & Smart Lockout bypass
    url: https://www.varonis.com/blog/ws-trust-autologon-endpoint
  - label: Sprocket Security - Entra Smart Lockout
    url: https://www.sprocketsecurity.com/blog/exploring-modern-password-spraying
  - label: Microsoft - password spray investigation playbook
    url: https://learn.microsoft.com/security/compass/incident-response-playbook-password-spray
---

## What it is

Guess one or two likely passwords against a large, pre-validated user list on the Entra ID / Microsoft 365 authentication surface. Because sign-in errors are verbose, several endpoints confirm a valid password **even when the final sign-in is blocked** by MFA or Conditional Access. That credential is still recorded as a hit for later device-code, AiTM, or token work.

## Endpoints that leak validity

```sh
# Classic v1 OAuth2 token endpoint (MSOLSpray / o365spray target this).
# A valid password returns a token or an "MFA required" error, not a generic failure.
POST https://login.microsoftonline.com/common/oauth2/token
  resource=https://graph.windows.net&client_id=<first-party app>
  &grant_type=password&username=$upn&password=$password
```

- **login.microsoftonline.com** OAuth2/token: most common; returns rich AADSTS codes.
- **WS-Trust autologon** (Seamless SSO): `.../winauth/trust/2005/usernamemixed`. Historically **not covered by Smart Lockout** and stays out of the interactive sign-in logs, so it validates passwords quietly. Only present on tenants with Seamless SSO / federation; being retired by Microsoft.
- **ADFS** endpoints for federated tenants (`/adfs/services/trust/...`).

## Reading the result (AADSTS codes)

| Code | Meaning |
|---|---|
| AADSTS50126 | Wrong password (user exists) - not a hit |
| AADSTS50076 / 50079 | **Valid password**, MFA required / not registered - hit |
| AADSTS50055 | **Valid password**, expired - hit |
| AADSTS50158 | Valid password, blocked by Conditional Access - hit |
| AADSTS50053 | Account locked (Smart Lockout) or risk-blocked |
| AADSTS50057 | Account disabled |
| AADSTS50034 / 90002 | User / tenant does not exist |

Rule of thumb: anything **other than** 50126 / 50057 / 50053 / user-not-found generally means the password was correct.

## Tools

```powershell
# MSOLSpray (PowerShell) - one password, whole list; -Force pushes past lockout warnings
Invoke-MSOLSpray -UserList users.txt -Password 'Autumn2026!' -OutFile hits.txt
# -URL lets you point at a FireProx endpoint for per-request IP rotation
```

```sh
# TeamFiltration - enumerate + spray M365/AAD (also gov tenants & ADFS)
TeamFiltration --config config.json --spray --sprayfile passwords.txt --aad
```

```sh
# TREVORspray - modular, threaded; can round-robin source IPs over SSH proxies
trevorspray -u users.txt -p 'Autumn2026!' --ssh user@proxy1 user@proxy2
```

- **o365spray / Spray365**: similar, with extra error-code handling and Smart-Lockout-aware execution plans.
- **FireProx**: rotate source IP per request via AWS API Gateway; pair with MSOLSpray's `-URL` to weaken IP-based throttling.

## Avoiding lockout

Entra **Smart Lockout** tracks failures per user and hashes recent bad passwords, so re-trying the same wrong password does not burn more attempts. Practically:

- One password per round, then wait out the observation window (spray, don't brute-force).
- Low-and-slow with jitter; spread across many source IPs (FireProx / proxy pools).
- Prefer a validity-leaking endpoint (WS-Trust autologon) that historically ignores Smart Lockout, where the tenant exposes it.
