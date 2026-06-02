# US Fixture Candidates

Candidate case pages for CourtListener, Justia, and Google Scholar adapters.
Feeds issues #8, #9, and #10.

---

## CourtListener

| URL | Why useful for parser coverage |
|-----|-------------------------------|
| https://www.courtlistener.com/opinion/84759/marbury-v-madison/ | Single majority opinion with no concurrences or dissents — good baseline for the simplest parser path. |
| https://www.courtlistener.com/opinion/108713/roe-v-wade/ | Multiple concurrences (Burger, Douglas, Stewart) and dissents (White, Rehnquist) — exercises multi-opinion parsing. |
| https://www.courtlistener.com/opinion/2812209/obergefell-v-hodges/ | Consolidated case with parties from four states — tests complex party-list and multi-docket structures. |

---

## Justia

| URL | Why useful for parser coverage |
|-----|-------------------------------|
| https://supreme.justia.com/cases/federal/us/384/436/ | Landmark with multiple consolidated dockets merged into one page — tests Justia's combined-case layout. |
| https://law.justia.com/cases/federal/appellate-courts/ca9/23-927/23-927-2025-11-12.html | Recent Ninth Circuit opinion — tests modern Justia formatting and recent-case metadata handling. |
| https://law.justia.com/cases/california/supreme-court/2024/s279622.html | State supreme court ruling with statutory interpretation of a ballot measure — covers state-level page structure. |

---

## Google Scholar

| URL | Why useful for parser coverage |
|-----|-------------------------------|
| https://scholar.google.com/scholar_case?case=9834052745083343188 | Simple foundational opinion — baseline for Scholar-specific HTML structure and citation rendering. |
| https://scholar.google.com/scholar_case?case=694784363938594707 | Short rights-based ruling with inline citations — tests Scholar's citation hyperlink parsing. |
| https://scholar.google.com/scholar_case?case=13326303469560303663 | Cert denial with divided concurrence — tests handling of non-merits dispositions and split opinions. |
