---
title: "Entra ID: Authenticated Enumeration & Tooling"
category: AD / Entra ID
order: 30
tags:
  - entra
  - azure-ad
  - enumeration
  - bloodhound
  - roadrecon
  - msonline
  - graph
  - authenticated
summary: "Directory enumeration once you hold any cloud credential or token: ROADtools (roadrecon), AzureHound + BloodHound, az CLI, Microsoft Graph PowerShell, AADInternals, MicroBurst, Stormspotter. Includes the deprecated/retired MSOnline (Get-MsolUser/Get-MsolRole) and AzureAD PowerShell modules."
prerequisites:
  - Any valid tenant credential ($upn / $password) or an access/refresh token
  - "Note: by default any authenticated member can read most directory objects unless restricted"
tools:
  - ROADtools
  - AzureHound
  - BloodHound
  - az cli
  - Microsoft Graph PowerShell
  - AADInternals
  - MicroBurst
  - Stormspotter
  - MSOnline
  - AzureAD
detection:
  - Entra ID audit and sign-in logs; Azure AD Graph access is itself a deprecation/monitoring signal. Vendors ship detections for bulk directory reads (e.g. Elastic's 'Azure AD Graph Potential Enumeration (ROADrecon)' rule).
  - Microsoft Defender for Cloud Apps / ID Protection anomalous-enumeration and impossible-travel alerts.
  - Spikes in Graph/Azure AD Graph queries from a single principal or IP; unusual service-principal sign-ins; new app credentials added.
mitigation:
  - Retire Azure AD Graph and legacy MSOnline/AzureAD usage; consolidate on Microsoft Graph so anomalous access is easier to spot.
  - Apply least privilege; use PIM (just-in-time) for privileged roles and restrict who holds Global Admin.
  - Restrict default user permissions to read the directory where the business allows (limit member/guest enumeration).
  - Tighten app consent and app-credential policies; review over-permissioned service principals and remove stale owners.
  - "Close Conditional Access gaps: block legacy auth, require MFA + compliant device, and minimize policy exclusions."
refs:
  - label: dirkjanm.io - Introducing ROADtools
    url: https://dirkjanm.io/introducing-roadtools-and-roadrecon-azure-ad-exploration-framework/
  - label: ROADtools (dirkjanm) on GitHub
    url: https://github.com/dirkjanm/ROADtools
  - label: SpecterOps - AzureHound Community Edition docs
    url: https://bloodhound.specterops.io/collect-data/ce-collection/azurehound
  - label: AzureHound (SpecterOps) on GitHub
    url: https://github.com/SpecterOps/AzureHound
  - label: Microsoft - Get-MgUser (Microsoft Graph PowerShell)
    url: https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.users/get-mguser
  - label: Microsoft Entra blog - Azure AD Graph retirement & PowerShell module deprecation
    url: https://techcommunity.microsoft.com/blog/microsoft-entra-blog/important-azure-ad-graph-retirement-and-powershell-module-deprecation/3848270
  - label: Microsoft Entra blog - MSOnline and AzureAD PowerShell retirement (2025)
    url: https://techcommunity.microsoft.com/blog/microsoft-entra-blog/action-required-msonline-and-azuread-powershell-retirement---2025-info-and-resou/4364991
  - label: MicroBurst (NetSPI) on GitHub
    url: https://github.com/NetSPI/MicroBurst
  - label: AADInternals (Gerenios) on GitHub
    url: https://github.com/Gerenios/AADInternals
  - label: Elastic - Azure AD Graph Potential Enumeration (ROADrecon) rule
    url: https://www.elastic.co/guide/en/security/current/prebuilt-rule-8-19-26-azure-ad-graph-potential-enumeration-roadrecon.html
---

Any authenticated principal - even a low-privileged member or a B2B guest - can typically read a large fraction of the directory over Microsoft Graph. Authenticated enumeration builds the full picture: users, groups (including dynamic), roles and their members, app registrations, service principals and their credentials/permissions, devices, and Conditional Access coverage. The goal is to find privilege-escalation and abuse paths (e.g. an app you can add a secret to, a group you can join whose membership grants a role).

## ROADtools / roadrecon (dirkjanm)

The standard offensive/defensive Entra exploration framework. Three steps - authenticate, gather to a local SQLite DB, then browse in a local web GUI:

```sh
roadrecon auth -u $upn -p $password
roadrecon gather
roadrecon gui   # browse at http://127.0.0.1:5000
```

`roadrecon gather` pulls the tenant into `roadrecon.db`; add `--mfa` to include MFA-related data when authenticated with sufficient privilege. `roadrecon auth` also accepts tokens, refresh tokens, and PRT-based flows. The companion `roadtx` handles token exchange (including PRT/device scenarios). The GUI surfaces role assignments, applications, service principals, OAuth2 grants, and directory settings, and highlights escalation-relevant relationships.

## AzureHound + BloodHound (SpecterOps)

AzureHound (Community Edition, a Go binary) exports Entra ID and Azure RM objects into JSON for BloodHound, which then computes attack paths (e.g. shortest path to Global Administrator). By default any authenticating user can collect admin roles, users, groups, apps, devices, and service principals.

```sh
azurehound -u "$upn" -p "$password" list --tenant "$tenant" -o output.json
# token-based collection:
azurehound -r "<refresh_token>" list --tenant "$tenant" -o output.json
```

Import `output.json` into BloodHound (CE) and query the prebuilt Azure paths. AzureHound and SharpHound output can share one database, so cloud and on-prem paths can be analyzed together.

## az CLI (Microsoft)

The official cross-platform CLI is convenient for quick, legitimate-looking reads:

```sh
az login
az ad user list -o table
az ad group list -o table
az ad app list --all -o table
az ad sp list --all -o table
az role assignment list --all -o table   # Azure RBAC (resource plane)
az account list -o table
```

## Microsoft Graph PowerShell (mggraph)

The supported, current-generation module. Connect with read scopes and enumerate:

```powershell
Connect-MgGraph -Scopes "User.Read.All","Directory.Read.All","Application.Read.All"
Get-MgUser -All
Get-MgGroup -All
Get-MgDirectoryRole                                  # activated roles in the tenant
Get-MgDirectoryRole | ForEach-Object { Get-MgDirectoryRoleMember -DirectoryRoleId $_.Id }
Get-MgDirectoryRoleTemplate                          # all possible roles
Get-MgApplication -All
Get-MgServicePrincipal -All
Get-MgIdentityConditionalAccessPolicy                # CA policies (needs Policy.Read.All)
```

Note `Get-MgDirectoryRole` returns only *activated* roles; use `Get-MgDirectoryRoleTemplate` to see everything that could exist.

## AADInternals (authenticated)

Beyond outsider recon, AADInternals has authenticated functions once you obtain an access token:

```powershell
$at = Get-AADIntAccessTokenForAADGraph
Get-AADIntUsers -AccessToken $at | Select-Object UserPrincipalName,ObjectId
Get-AADIntGlobalAdmins -AccessToken $at
```

It also has a guest-context enumeration path (`Invoke-AADIntUserEnumerationAsGuest`) useful when you hold only a B2B guest account.

## MicroBurst (NetSPI)

PowerShell toolkit focused on the Azure **resource** plane and misconfigurations: subscription/resource dumps, and public-surface discovery of storage blobs and service subdomains.

```powershell
Import-Module ./MicroBurst.psm1
Get-AzDomainInfo                       # dump subscription/resource info (authenticated)
Invoke-EnumerateAzureSubDomains -Base $domain
Invoke-EnumerateAzureBlobs -Base $domain
```

## Stormspotter (Microsoft, archived)

Builds an attack graph of an Azure subscription's resources (Neo4j-backed, with a collector `sscollect` and a web frontend). Useful for visualizing resource-plane pivots, but the project is **archived/unmaintained** - expect setup friction and prefer ROADrecon/BloodHound for current work.

## Legacy modules: MSOnline ("msol") and AzureAD - deprecated & retired

Older tradecraft leaned on the **MSOnline** module (the `Msol*` cmdlets) and the **AzureAD** module. Both are **deprecated** (announced 30 March 2024) and were **retired in 2025** (MSOnline retirement rolled out ~April-May 2025; AzureAD retirement ~from mid-2025). They ran against the now-retiring Azure AD Graph API. You will still see them everywhere in old notes, and they may work against some environments, but expect connection failures in current tenants - migrate to Microsoft Graph PowerShell (or Microsoft Entra PowerShell).

Historical MSOnline enumeration for reference:

```powershell
Connect-MsolService                                  # prompts for creds
Get-MsolCompanyInformation
Get-MsolDomain
Get-MsolUser -All
Get-MsolRole                                         # list admin roles
Get-MsolRole -RoleName "Company Administrator" |     # 'Company Administrator' = Global Admin
  ForEach-Object { Get-MsolRoleMember -RoleObjectId $_.ObjectId }
```

And the AzureAD module equivalents:

```powershell
Connect-AzureAD
Get-AzureADUser -All $true
Get-AzureADDirectoryRole
Get-AzureADDirectoryRole | ForEach-Object { Get-AzureADDirectoryRoleMember -ObjectId $_.ObjectId }
```

Mapping: `Get-MsolUser` -> `Get-MgUser`; `Get-MsolRole`/`Get-MsolRoleMember` -> `Get-MgDirectoryRole`/`Get-MgDirectoryRoleMember`; `Get-AzureADUser` -> `Get-MgUser`.

## What to look for

- **Global Administrator** (and other Tier-0 roles: Privileged Role Administrator, Privileged Authentication Administrator, Application/Cloud Application Administrator) and their members.
- **App registrations & service principals**: over-scoped Graph permissions (e.g. `RoleManagement.ReadWrite.Directory`, `AppRoleAssignment.ReadWrite.All`), and principals you can add credentials to.
- **Dynamic groups**: membership rules an attacker can satisfy by editing their own attributes, potentially granting roles/access automatically.
- **Conditional Access gaps**: legacy auth still allowed, excluded users/service accounts, report-only policies, missing device/MFA requirements - the exclusions are the finding.
- **Owners**: app/SP owners and group owners, which often confer indirect control paths.
