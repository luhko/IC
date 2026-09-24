---
title: "Entra ID: Unauthenticated Recon & Tenant Discovery"
category: AD / Entra ID
order: 20
tags:
  - entra
  - azure-ad
  - recon
  - osint
  - user-enumeration
  - unauthenticated
summary: "Pre-credential reconnaissance of an Entra tenant: tenant discovery via the OpenID configuration endpoint and GetUserRealm, managed-vs-federated fingerprinting, and username/email validation via GetCredentialType. Tools: AADInternals, o365spray, TeamFiltration, Oh365UserFinder."
prerequisites:
  - A target domain in scope (e.g. $domain)
  - Outbound HTTPS to login.microsoftonline.com and *.outlook.com
  - No credentials required
tools:
  - AADInternals
  - o365spray
  - TeamFiltration
  - Oh365UserFinder
detection:
  - Unauthenticated discovery endpoints (openid-configuration, getuserrealm) generate little to no tenant-side logging, so detection is limited; monitor instead for the follow-on password spray in Entra sign-in logs.
  - Large bursts of failed/interrupted sign-ins from few source IPs, or a spike in 'unfamiliar location' sign-ins, indicate spray following enumeration.
  - Enable and review Entra ID Protection risk detections; alert on legacy-auth (Basic/ROPC) attempts.
mitigation:
  - Enforce MFA and Conditional Access for all users; block legacy authentication protocols.
  - Enable smart lockout and password protection; monitor for spray patterns.
  - Where feasible, use non-obvious UPNs that differ from public email addresses to reduce validation value.
  - Understand that the discovery endpoints cannot be fully disabled - defense is at the authentication/CA layer, not by hiding the tenant.
refs:
  - label: AADInternals - Azure AD recon as an outsider (Nestori Syynimaa)
    url: https://aadinternals.com/post/just-looking/
  - label: AADInternals (Gerenios) on GitHub
    url: https://github.com/Gerenios/AADInternals
  - label: o365spray (0xZDH) README
    url: https://github.com/0xZDH/o365spray/blob/master/README.md
  - label: TeamFiltration Enumeration wiki (Flangvik)
    url: https://github.com/Flangvik/TeamFiltration/wiki/Enumeration
  - label: Oh365UserFinder (dievus)
    url: https://github.com/dievus/Oh365UserFinder
  - label: Microsoft - OpenID Connect on the Microsoft identity platform
    url: https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
  - label: Sprocket Security - Tenant Enumeration is Dead
    url: https://www.sprocketsecurity.com/blog/tenant-enumeration-is-dead
---

Unauthenticated recon establishes *whether a tenant exists*, *how it authenticates* (managed vs federated), and *which accounts are valid* - all before you hold a single credential. These endpoints are public by design (login clients use them to discover configuration), so the recon itself is low-noise and largely unlogged for the tester. Only test domains that are in scope.

## Tenant existence & tenant ID (OpenID configuration)

The OIDC discovery document reveals the tenant GUID (in the `issuer` and `token_endpoint`) for any domain that maps to a tenant:

```sh
curl -s "https://login.microsoftonline.com/$domain/.well-known/openid-configuration" | jq .
```

A valid tenant returns JSON with the tenant ID embedded; a non-tenant domain returns an error. The v2.0 variant is `.../$domain/v2.0/.well-known/openid-configuration`.

## Managed vs federated (GetUserRealm)

GetUserRealm tells you whether authentication for a domain is handled in the cloud (**Managed**) or redirected to an on-prem/third-party IdP (**Federated**, e.g. ADFS - which exposes an STS URL you can then probe):

```sh
curl -s "https://login.microsoftonline.com/getuserrealm.srf?login=$upn&xml=1"
```

Look at `NameSpaceType` (Managed / Federated), `FederationBrandName`, and for federated domains the `AuthURL`/STS host. Federated domains change the initial-access approach (password spray may hit the on-prem ADFS instead of Entra ID).

## Automated outsider recon (AADInternals)

`Invoke-AADIntReconAsOutsider` is the standard one-shot external profile. It resolves the tenant name and ID, lists verified domains with each domain's auth type (Managed/Federated), and reports signals such as Desktop SSO (Seamless SSO) enabled and whether the tenant uses cloud vs synced identities - all without authentication.

```powershell
Import-Module AADInternals
Invoke-AADIntReconAsOutsider -DomainName $domain | Format-Table
```

What it reveals: the `*.onmicrosoft.com` tenant name, tenant region/brand, the full verified-domain list, and per-domain federation status - a fast map of the identity estate. (Domain-list completeness depends on endpoints Microsoft has changed over time; corroborate with OSINT/CT logs.)

## Username / email validation

The **GetCredentialType** endpoint (`POST https://login.microsoftonline.com/common/GetCredentialType`) returns an `IfExistsResult` field intended to indicate whether an account exists, and typically does not increment sign-in failure counters, so it is used for account **validation** rather than authentication. Reliability varies by tenant (Desktop SSO and throttling cause false results), so treat single-method output cautiously.

### o365spray

Validate the domain, then enumerate a username list:

```sh
o365spray --validate --domain $domain
o365spray --enum -U usernames.txt --domain $domain
```

It supports selectable enumeration modules and a separate `--spray` mode with `--count`/`--lockout` throttling controls (use spray only when password-guessing is explicitly authorized and the lockout policy is understood).

### TeamFiltration

Cross-platform O365 framework; tenant recon plus multiple validation channels (Teams API is fast; MSOL and OneDrive methods also exist):

```sh
TeamFiltration --config config.json --outpath ./out --enum --tenant-info --domain $domain
TeamFiltration --config config.json --outpath ./out --enum --validate-teams --domain $domain
```

Its `--tenant-info` mode is explicitly based on the `Invoke-AADIntReconAsOutsider` technique.

### Oh365UserFinder

Python validator that parses the `IfExistsResult` flag; single email or a list, with a timeout to avoid throttling:

```sh
python3 oh365userfinder.py -e $upn
python3 oh365userfinder.py -r emails.txt -t 60 -w valid.txt
```

## What good output looks like

- Confirmed tenant ID + `*.onmicrosoft.com` name.
- Verified-domain inventory with Managed/Federated split (drives spray targeting).
- Desktop SSO / Seamless SSO status.
- A validated list of live UPNs for the next phase.

Community research (e.g. Sprocket's "Tenant Enumeration is Dead") documents Microsoft steadily degrading these signals - always cross-check.
