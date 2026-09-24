---
title: "Entra ID (Azure AD): Overview for Pentesters"
category: AD / Entra ID
order: 10
tags:
  - entra
  - azure-ad
  - cloud
  - tokens
  - prt
  - fundamentals
summary: How Microsoft Entra ID differs from on-prem Active Directory, the tenant/identity model, the token types you encounter (access, refresh, PRT), and why identity-plane testing looks nothing like classic AD.
prerequisites:
  - Authorized engagement scope covering the target tenant
  - Basic OAuth2/OIDC familiarity
tools:
  - ROADtools
  - AADInternals
  - az cli
  - Microsoft Graph PowerShell
detection:
  - N/A - conceptual overview. Detection guidance is on the technique-specific pages (unauth recon, authenticated enumeration).
mitigation:
  - "Baseline hardening that underpins later pages: enforce MFA + Conditional Access, block legacy authentication, apply least privilege to directory roles and app permissions, and use PIM for privileged roles."
refs:
  - label: dirkjanm.io - Abusing Azure AD SSO with the Primary Refresh Token
    url: https://dirkjanm.io/abusing-azure-ad-sso-with-the-primary-refresh-token/
  - label: dirkjanm.io - Introducing ROADtools (Azure AD exploration framework)
    url: https://dirkjanm.io/introducing-roadtools-and-roadrecon-azure-ad-exploration-framework/
  - label: Microsoft - OpenID Connect on the Microsoft identity platform
    url: https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
  - label: HackTricks Cloud - Azure Primary Refresh Token (PRT)
    url: https://cloud.hacktricks.wiki/en/pentesting-cloud/azure-security/az-lateral-movement-cloud-on-prem/az-primary-refresh-token-prt.html
---

Microsoft **Entra ID** (formerly Azure AD) is Microsoft's cloud identity provider. It is *not* a hosted domain controller: there is no LDAP, no Kerberos KDC, no SYSVOL. Authentication is HTTPS + OAuth2/OpenID Connect, authorization is role- and API-driven, and enumeration goes through public REST APIs (Microsoft Graph, the legacy Azure AD Graph, and the ARM management API).

## Entra ID vs on-prem AD

| Concept | On-prem AD | Entra ID |
|---|---|---|
| Directory access | LDAP / DCs | Microsoft Graph REST |
| Auth protocol | Kerberos / NTLM | OAuth2 / OIDC / SAML / WS-Fed |
| Long-lived credential | TGT (krbtgt) | Primary Refresh Token (PRT) |
| Highest privilege | Domain / Enterprise Admin | Global Administrator |
| Policy engine | GPO | Conditional Access + Intune |
| "Computer" | domain-joined machine | Entra-joined / hybrid-joined device |

Many orgs run **hybrid**: on-prem AD synced to Entra ID via Entra Connect (formerly Azure AD Connect) using Password Hash Sync (PHS), Pass-Through Authentication (PTA), or federation (ADFS). Those hybrid seams are the classic pivot points between cloud and on-prem.

## Tenant and identity model

- **Tenant**: an isolated directory instance, identified by a GUID (tenant ID) and one or more DNS domains, always including an initial `*.onmicrosoft.com` domain. `$tenant` in these pages is the tenant domain or ID.
- **Identities**: cloud users, guest (B2B) users, groups (assigned, dynamic, M365), **applications** (app registrations) and their runtime **service principals**, and **managed identities**. Apps and service principals frequently hold API permissions that outrank the user who created them.
- **Roles**: Entra directory roles (e.g. Global Administrator, Privileged Role Administrator, Application Administrator) govern the identity plane; Azure RBAC roles (Owner, Contributor) govern subscriptions/resources. They are separate systems, and a Global Admin is *not* automatically an Azure resource owner (though they can elevate to it).

## Tokens: what you will steal and replay

Entra ID is a token service. Understanding the token types is the whole game:

- **Access token**: short-lived (typically ~60-90 min) JWT scoped to one resource/audience (e.g. `graph.microsoft.com`). Bearer token; whoever holds it is that identity until it expires. Decode the claims at jwt.ms to read `aud`, `scp`/`roles`, `upn`, `tid`.
- **Refresh token**: long-lived, opaque, used to mint fresh access tokens for the same or (with the right scopes) other resources without re-auth. Stealing one extends access well past the access-token lifetime.
- **Primary Refresh Token (PRT)**: the device-bound "master key" issued to Entra-joined / hybrid-joined / registered devices. It is the cloud analogue of a TGT: present it and Entra ID hands back access + refresh tokens for apps, often satisfying Conditional Access device requirements. It is cryptographically bound to a device key (ideally TPM-protected) and is roughly 90 days rolling (about 14 days if the device is unused). A stolen PRT (or PRT cookie) is a high-value, device-independent credential.

## Why pentesting Entra ID is different

- **Everything is an API call over 443.** No internal network foothold is required for a lot of recon; some enumeration is fully unauthenticated.
- **Bearer tokens, not password hashes.** Lateral movement is token theft/replay (from browsers, `az`/`Az` CLI token caches, memory, device PRTs), not pass-the-hash.
- **Conditional Access is the perimeter.** MFA, device compliance, and location policies gate token issuance; the interesting findings are the *gaps* (legacy auth allowed, service accounts excluded, report-only policies).
- **Apps and service principals are first-class targets.** An over-permissioned app or a credential added to a service principal is often a cleaner path to Global Admin than any user.

Subsequent pages cover unauthenticated recon and authenticated enumeration tooling.
