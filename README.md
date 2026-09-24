# IC — Internal Cheatsheet

A local, offline cheat sheet for **authorized** internal / Active Directory
security assessments. A mix of Notion (rich, searchable, organized content) and
Exegol (a variable engine that fills your target details — `$ip`, `$user`,
`$domain`, … — into every command, ready to copy).

> ⚠️ For use on engagements you are authorized to perform (pentests, red team,
> CTF, lab study) only. You are responsible for staying within scope and the law.

## Features

- **Variable engine** — set your target once in the Context panel (`$ip`,
  `$user`, `$domain`, `$dc_ip`, `$ca`, `$tenant`, …); every command renders
  filled in, one‑click copy, unset variables highlighted. Persisted locally.
- **Engagement checklist** — on every technique, mark a test status
  (*not tested / in progress / tested*) and a verdict (*vuln / partial /
  not vuln*), plus a free‑text note. A dedicated **Checklist** page rolls it all
  up with counters and filters, status dots show in the sidebar, and you can
  **export / import** the whole engagement state (variables + checklist) as JSON.
- **Rich content** — techniques in Markdown, organized by category, with
  structured metadata (prerequisites, tools, detection, mitigation, references).
- **Interactive mindmap** — the internal AD methodology as a colour‑coded,
  zoomable, collapsible mind map (authored in Markdown).
- **Attack paths** — chained, step‑by‑step internal attack paths (YAML).
- **Quick wins** — a concise first‑page hit‑list pinned to the top of the nav.
- **Search** — full‑text fuzzy search over everything (`Ctrl‑K`).
- **Copy‑friendly commands** — comments are shown as a note *under* the block
  (never copied), and multi‑line `\`‑continued commands copy as a single command.
- **100% local** — no telemetry, no backend; a static bundle served on
  `localhost` (or your LAN).

## Run

Easiest — the launcher installs deps if needed, builds prod, and serves it:

```bash
./launch.sh                    # http://localhost:5173
./launch.sh --dev              # dev server with hot reload
PORT=8080 ./launch.sh          # different port
HOST=0.0.0.0 ./launch.sh       # listen on all interfaces (reachable on the LAN)
HOST=10.10.14.5 ./launch.sh    # bind a specific IP
```

> `HOST=0.0.0.0` exposes the cheat sheet to your whole network — only do it on a
> trusted / engagement network.

Or with npm directly:

```bash
npm install
npm start        # production: build + serve on http://localhost:5173
npm run dev      # development: hot reload, unminified
```

`npm start` runs `npm run build` (typecheck + minified bundle into `dist/`) then
serves it with `vite preview`. `dist/` is a plain static site — you can also host
it with any static server (`npx serve dist`, nginx, an internal web root…).

Requires Node.js 18+.

## What's covered

Active‑Directory focused, kept current. Categories:

**Quick wins** · **Recon** (scan → web screenshots, unauth access, enumeration,
BloodHound) · **Credentials** (Kerberoast, AS‑REP, DCSync, OS dumping, spraying,
gMSA / Golden gMSA / LAPS) · **Relay & Coercion** (matrix & gates, WebDAV,
ntlmrelayx cookbook, coercion) · **ADCS** (overview + ESC1–ESC16) ·
**Delegation** (unconstrained / constrained / RBCD / KrbRelayUp) · **ACL abuse**
(GenericAll/Write, WriteDacl/Owner, ForceChangePassword, Shadow Credentials,
targeted Kerberoast) · **GPO** · **Lateral movement** (exec, pass‑the‑ticket,
MSSQL) · **Persistence** (golden/silver/diamond/sapphire tickets, DSRM,
AdminSDHolder…) · **Trusts** · **SCCM** · **Windows tooling** (PowerView,
Rubeus, mimikatz) · **Entra ID** (recon, attacks, hybrid identity, Golden SAML) ·
**CVE** (one per file, with prerequisites).

## Editing content

Everything lives in `content/` and is loaded at build time — edit a file, save,
hot‑reload (in `--dev`) or rebuild.

```
content/
  variables.yaml              # canonical variables ($ip, $user, …) → Context panel
  ad/
    <category>/*.md           # techniques & CVEs (recon, credentials, relay, adcs, acl, …)
    mindmap/internal-ad.md    # markmap source for the AD mindmap
  attack-paths/*.yaml         # chained attack paths
```

A page's **category** and its position come from frontmatter; the folder is just
for your own tidiness.

### Add a technique (Markdown)

Frontmatter drives the sidebar, metadata panels and search. Fenced code blocks
(```` ```sh ````, ```` ```powershell ````) become copyable, variable‑substituted
commands.

```markdown
---
title: Kerberoasting
category: AD / Credentials      # the "AD / " prefix is hidden in the UI
order: 10                       # sort order within the category (optional)
tags: [kerberos, credentials]
summary: One-line description shown under the title.
prerequisites:
  - Any valid domain account ($user / $password)
  - A reachable Domain Controller ($dc_ip)
tools: [netexec, impacket, hashcat]
detection:
  - Event 4769 with RC4 encryption, bursts from one user
mitigation:
  - gMSA / long random service-account passwords; enforce AES
refs:
  - { label: "HackTricks — Kerberoast", url: "https://book.hacktricks.xyz/..." }
---

Prose in Markdown. Tables, lists, links and inline `code` all render.

​```sh
# comments render as a note UNDER the block (not copied)
netexec ldap $dc_ip -u $user -p $password --kerberoasting hashes.txt
​```
```

**CVE pages** (anything under `cve/`, or with a `cve:` field) also support:
`cve`, `aka`, `severity`, `affected`, `patched` — rendered as badges, with the
CVE id linking to NVD.

### Command blocks

- Any `$name` token is substituted live from the Context panel; unset ones are
  highlighted so you don't paste a half‑filled command.
- `# …` comments (full‑line or inline) are moved to a muted note under the block
  and stripped from anything you copy. A `#` inside quotes is preserved.
- Lines joined with a trailing `\` are treated as one command — one prompt, one
  copy, continuation preserved so it pastes and runs.

### Variables

Declare the well‑known variables in `content/variables.yaml` (name, label,
example, group) so they appear in the Context panel. Any other `$name` you use in
a command still works — add it on the fly from the panel's *add variable* field.

### Attack paths (YAML)

```yaml
title: PetitPotam → ADCS ESC8 → Domain Admin
category: AD / Attack paths
summary: Coerce a DC, relay to AD CS, get a DC cert, DCSync.
tags: [petitpotam, adcs, esc8]
steps:
  - title: Find a CA web enrollment endpoint
    detail: ESC8 needs the HTTP(S) enrollment interface reachable.
    commands:
      - "certipy find -u $user@$domain -p $password -dc-ip $dc_ip -vulnerable -stdout"
    gains: ["CA host + template names"]
```

### Mindmap

`content/ad/mindmap/internal-ad.md` is plain Markdown (headings + bullets)
rendered with markmap. Use `**bold**` for key terms and `` `code` `` for tools;
each top‑level `##` section becomes a coloured branch.

## Stack

Vite + React + TypeScript, Tailwind, zustand, react‑markdown, markmap, Fuse.js.
Static build, no backend.
