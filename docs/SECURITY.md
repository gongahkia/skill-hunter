# Security

## Reporting

Report suspected vulnerabilities privately before opening a public issue.

- Email: security@dorso.dev
- GPG fingerprint: TODO: add maintainer release-key fingerprint before store submission.
- Public fallback: if email acknowledgement does not arrive within 7 days, open a GitHub issue with only a minimal title and no exploit details.

Include:

- Affected Dorso version, browser, and OS.
- Clear reproduction steps.
- Extension permissions or host permissions involved.
- Impact on chatbot page content, LeetCode submissions, local storage, CLI export, badge signing, or optional leaderboard data.
- Any proof of concept needed to reproduce locally.

Do not include real third-party chatbot conversations, secrets, cookies, session tokens, API keys, or private repository content in reports.

## Scope

In scope:

- Extension code in `src/extension/`.
- Shared challenge, scoring, storage, and validation code in `src/shared/`.
- JSON schemas and bundled challenge packs under `schemas/` and `src/shared/data/`.
- Build scripts under `scripts/`.
- Optional CLI export code under `cli/`.
- Optional stateless badge and leaderboard worker code under `cloudflare/`.

Out of scope:

- Archived v2 code under `archive/`.
- Historical release artifacts under `artifacts/`.
- Vulnerabilities requiring malware, stolen devices, compromised browsers, or attacker control of a user's GitHub account.
- Denial-of-service reports with no realistic security impact.
- Social engineering against maintainers or users.

## Disclosure Timeline

Dorso uses a 90-day coordinated disclosure window.

1. Day 0: reporter sends the private report.
2. Day 7: maintainer acknowledges receipt or the reporter may use the public fallback without details.
3. Day 30: maintainer shares triage status when the issue is reproducible.
4. Day 90: reporter may publish after giving the maintainer at least 7 days' notice.

Critical active exploitation can justify faster disclosure, but coordinate privately first when possible.

## Hall Of Fame

Accepted reports may be credited with this format:

| Reporter | Finding | Severity | Fixed In | Disclosure |
| --- | --- | --- | --- | --- |
| Name or handle | Short issue class | Low/Medium/High/Critical | Version or commit | YYYY-MM-DD |

Reporters may request anonymous credit or no credit.

## Why Extension Reports Matter

Dorso runs on chatbot domains and deliberately gates AI-assistant usage. That means extension bugs can affect pages where users may enter private prompts, code, credentials by mistake, work notes, or repository details.

Public 2026 research showed why this class of extension needs a clear reporting path. OX Security reported malicious Chrome extensions that exfiltrated ChatGPT and DeepSeek conversations plus browsing data, with more than 900,000 combined downloads. LayerX reported a separate campaign of ChatGPT-themed Chrome and Edge extensions designed to steal ChatGPT session tokens. Dorso is local-first and does not collect chatbot content, but the permission surface still deserves fast private reporting when something looks wrong.

References:

- OX Security: <https://www.ox.security/blog/malicious-chrome-extensions-steal-chatgpt-deepseek-conversations/>
- LayerX Security: <https://layerxsecurity.com/blog/how-we-discovered-a-campaign-of-16-malicious-extensions-chatgpt/>
