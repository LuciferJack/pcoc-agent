# Security & Privacy Policy

pcoc-agent is built with a **default-deny privacy posture**. This document
explains what the harness protects, what it does NOT protect, and how to
report vulnerabilities.

## Threat Model

pcoc-agent assumes:

1. **You** are the only authorized user of your local install
2. The **LLM provider** (Anthropic, OpenAI, etc.) is honest-but-curious — they
   receive whatever you send, so we minimize what's sent
3. The **local filesystem** may contain credentials, customer data, or
   personal information that must never leak into:
   - LLM context
   - Public repo commits
   - Skill audit logs
   - Memory database

## What pcoc-agent protects

### 1. Path-based blocking (privacy-guard hook)

The `privacy-guard.cjs` hook intercepts every `Read`, `Edit`, and `Bash` tool
call. It **refuses without explicit user override** when paths match:

- Credential locations: `.env*`, `*.pem`, `*.key`, `~/.ssh/*`, `~/.aws/*`,
  `~/.gnupg/*`, `~/.anthropic/*`, `~/.openai/*`
- Browser/OS credential stores: `Keychain*`, `Login Data`, `Cookies` SQLite
- Cloud provider configs: `~/.kube/config`, `~/.docker/config.json`
- Crypto wallets and trading creds: `~/.okx/*`, `~/.binance/*`, `wallet.dat`

Fail-open design: a broken hook never blocks legitimate work. Block actions
are logged to `calibration/audit_log.local.md`.

### 2. High-entropy string detection

Before any payload is shipped to an LLM, the redaction skill scans for:

- Base64 strings ≥ 32 chars with high entropy
- Hex strings ≥ 32 chars (likely keys/hashes)
- AWS-style access key patterns (`AKIA[A-Z0-9]{16}`)
- GitHub PAT patterns (`gh[pousr]_[A-Za-z0-9]{36,}`)
- JWT-shaped strings
- Common API key prefixes (`sk-`, `sk_live_`, `pk_live_`, `xoxb-`, etc.)

Matches are replaced with `<REDACTED:type>` placeholders. The mapping is
kept in-memory only and NEVER written to disk.

### 3. User-defined sensitive terms list

You declare your own sensitive terms (names, internal project codenames,
client codes, etc.) in `.pcoc/sensitive-terms.local.txt`. This file is
**gitignored** and never read by any tool except the redaction skill at
local-only call sites.

Format: one term or regex per line. Lines starting with `#` are comments.

Example (your local file — never commit):
```
# Internal client codes
SECRET_CLIENT_CODE_1
SECRET_CLIENT_CODE_2

# HR-sensitive names (separation, performance, etc.)
COWORKER_NAME_1
HR_BUSINESS_PARTNER_NAME

# Strategy parameters that should never leave the box
MAGIC_TUNING_CONSTANT_NAMES
```

### 4. Work / personal isolation

The `work-personal-split.cjs` hook detects when a session is mixing
overlays. Example: if you are in a `kunlun-xpu` overlay session and the
agent tries to read a path inside `~/quant/` or `~/.okx/`, the hook
**halts and asks for confirmation**.

Overlay context is declared in `overlays/<name>/overlay.yaml` and
re-injected after context compaction.

### 5. Skill calibration gate

Unlike fully autonomous skill self-evolution systems, every new or modified
skill in pcoc-agent must:

1. Pass calibration against golden cases (auto)
2. Receive an **explicit human promotion command** (`pcoc.promote <skill>`)
3. Be logged to `calibration/audit_log.md` with timestamp + reason

A skill that fails calibration goes to `.claude/skills/_staging/` (gitignored).

### 6. Local-first memory

Memory storage (`memory/pcoc_memory.db`) is a local SQLite file with FTS5.
No telemetry. No cloud sync. The schema is open and inspectable. If you
want to wipe, `rm memory/pcoc_memory.db`.

## What pcoc-agent does NOT protect against

- A compromised local machine (root attacker, malicious browser extension)
- A malicious LLM provider with full logging of your prompts
- You explicitly bypassing the privacy-guard via `--no-guard` (we log this
  loudly but do not prevent it)
- Side-channel leakage through file content the agent legitimately reads
  (e.g., if your codebase has a hard-coded API key in source, reading the
  source ships the key — fix your source)
- Network adversaries between your machine and the LLM provider (use TLS,
  obviously, but that's outside our scope)

## Threat scenarios we explicitly designed against

| Scenario                                                | Defense                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| Agent reads `.env` and quotes API key in answer        | privacy-guard path block + redaction skill |
| Agent runs `cat ~/.ssh/id_rsa` to "debug"               | privacy-guard path block                   |
| Personal Telegram bot gets used for work content       | overlay isolation + work-personal-split    |
| New auto-generated skill silently overwrites a vetted one | audit log + human promotion gate         |
| Sensitive client name leaks into a public plan artifact | sensitive-terms scan before write          |
| Skill self-grades itself as "great"                     | calibration runs A vs B against golden set, not LLM self-judgment |
| Memory DB stolen if laptop lost                         | optional disk-level encryption (see docs/PRIVACY.md) |

## Reporting a Vulnerability

If you find a security issue, **do not open a public issue**. Email the
maintainer (address in the repo's GitHub profile) or open a private
security advisory via GitHub:

```
https://github.com/LuciferJack/pcoc-agent/security/advisories/new
```

We aim to acknowledge within 72 hours.

## Disclosure Norms

- We disclose CVE-eligible bugs after a fix is shipped
- We do not name individual researchers without consent
- We thank contributors in `docs/SECURITY-HALL-OF-FAME.md`
