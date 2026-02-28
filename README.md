[![](https://img.shields.io/badge/skill_hunter_1.0-deprecated-red)](https://github.com/gongahkia/skill-hunter/releases/tag/1.0) [![](https://img.shields.io/badge/skill_hunter_2.0-passing-green)](https://github.com/gongahkia/skill-hunter/releases/tag/2.0) [![](https://img.shields.io/badge/skill_hunter_3.0-passing-dark_green)](https://github.com/gongahkia/skill-hunter/releases/tag/3.0)

# Skill Hunter

<p align="center">
<img src="./asset/logo/logo_words.png" width=50% height=50%>
</p>

[Monorepo](#skills) for [LegalTech](https://www.linkedin.com/pulse/legaltech-vs-lawtech-technological-twinship-transforming-2ifgc/) and [LawTech](https://www.linkedin.com/pulse/legaltech-vs-lawtech-technological-twinship-transforming-2ifgc/) workflow tools.

## Skills

`Skill Hunter` currently supports the following skills.

| Skill | Description | Stack | Screenshot |
| :--- | :--- | :--- | :--- |
| `Lovely Ghostwriter` | Browser extension for readable Singapore legislation on SSO. Simplifies the heavily-nested DOM structure of [SSO](https://sso.agc.gov.sg/) to one that is intuitive and easily understood by lawyers and programmers alike. | TypeScript, HTML/CSS, Webpack, Jest, npm | ![](./asset/screenshots/skill-hunter-screenshot-4.png) |
| `Double Face` | Multi-app contract review platform. Provides a full contract-ingestion and review stack (web, extension, desktop, API, workers). | Next.js, Electron, Fastify, BullMQ, Prisma, PostgreSQL, Redis, pnpm/Turborepo | ![](./asset/screenshots/skill-hunter-screenshot-1.png) |
| `Conver Hands` | Litigation readiness bundle product. Provides evidence/findings ingestion, bundle generation, hash/signature verification, a static operator console, and a queue-driven export worker. | Fastify, Zod, TypeScript, pnpm, tsx, static web (HTML/CSS/JS) | Screenshot pending. |
| `Order Stamp` | Adversarial clause detector product. Provides a heuristic detector API, a Manifest V3 browser extension for active-tab scans/highlighting, and a batch detection worker. | Fastify, Zod, TypeScript, pnpm, tsx, Chrome Extension MV3 | Screenshot pending. |
| `Sun and Moon` | Case chronology builder. Provides case/event ingestion, chronology analytics (gaps/conflicts/monthly grouping), a static chronology console, and a timeline snapshot worker. | Fastify, Zod, TypeScript, pnpm, tsx, static web (HTML/CSS/JS) | Screenshot pending. |
| `Fun Fun Cloth` | Policy-to-clause compiler. Provides a policy DSL compiler API, clause simulation endpoints, a static policy editor/simulator, and a batch policy compiler worker. | Fastify, Zod, TypeScript, pnpm, tsx, static web (HTML/CSS/JS) | Screenshot pending. |

## Stack

### Lovely Ghostwriter (`lovely-ghostwriter`)

* *Frontend*: [TypeScript](https://www.typescriptlang.org/), [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [Webpack](https://webpack.js.org/), [Jest](https://jestjs.io/), [npm](https://www.npmjs.com/)

### Double Face (`double-face`)

* *Frontend*: [Next.js](https://nextjs.org/), [Electron](https://www.electronjs.org/)
* *Backend*: [Fastify](https://fastify.dev/), [BullMQ](https://docs.bullmq.io/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/repo)
* *DB*: [Prisma](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)

### Conver Hands (`conver-hands`)

* *Frontend*: [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* *Backend*: [Fastify](https://fastify.dev/), [Zod](https://zod.dev/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/)
* *Workers*: [tsx](https://tsx.is/), [TypeScript](https://www.typescriptlang.org/)

### Order Stamp (`order-stamp`)

* *Frontend*: [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* *Backend*: [Fastify](https://fastify.dev/), [Zod](https://zod.dev/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/)
* *Workers*: [tsx](https://tsx.is/), [TypeScript](https://www.typescriptlang.org/)

### Sun and Moon (`sun-and-moon`)

* *Frontend*: [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* *Backend*: [Fastify](https://fastify.dev/), [Zod](https://zod.dev/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/)
* *Workers*: [tsx](https://tsx.is/), [TypeScript](https://www.typescriptlang.org/)

### Fun Fun Cloth (`fun-fun-cloth`)

* *Frontend*: [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* *Backend*: [Fastify](https://fastify.dev/), [Zod](https://zod.dev/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/)
* *Workers*: [tsx](https://tsx.is/), [TypeScript](https://www.typescriptlang.org/)

### Shared

* *Code Quality*: [ESLint](https://eslint.org/), [Prettier](https://prettier.io/)

## [Presentation](./asset/presentation/class_part.pdf)

## Supported browsers

Find `Skill Hunter` on the [Chrome Web Store](https://chromewebstore.google.com) or [Firefox browser Add-ons](https://addons.mozilla.org/en-US/firefox/).

| Browser | Status | Link |
| :--- | :--- | :--- | 
| Google Chrome | ![](https://img.shields.io/badge/Status-Awaiting%20Approval-orange) | ... | 
| Firefox | ![](https://img.shields.io/badge/Status-Up-brightgreen) | [addons.mozilla.org/en-US/firefox/addon/skill-hunter/](https://addons.mozilla.org/en-US/firefox/addon/skill-hunter/) |
| Safari | ![](https://img.shields.io/badge/Status-Unsupported-red) | NIL | 

## Installation

Build the monorepo locally.

### CLI

Manually install everything yourself

```console
$ git clone https://github.com/gongahkia/skill-hunter
$ cd skill-hunter
$ ./onboard.sh
```

Optional build pass after install.

```console
$ ./onboard.sh --build
```

Manual setup (fallback).

```console
$ cd lovely-ghostwriter && npm install
$ make
$ cd ../double-face
$ pnpm install
$ pnpm build
$ cd ..
$ pnpm -C conver-hands/api install
$ pnpm -C conver-hands/web install
$ pnpm -C conver-hands/worker-export install
$ pnpm -C order-stamp/api install
$ pnpm -C order-stamp/worker-detection install
$ pnpm -C sun-and-moon/api install
$ pnpm -C sun-and-moon/web install
$ pnpm -C sun-and-moon/worker-timeline install
$ pnpm -C fun-fun-cloth/api install
$ pnpm -C fun-fun-cloth/web install
$ pnpm -C fun-fun-cloth/worker-compiler install
```

Run the new standalone tools from repo root.

```console
$ pnpm -C conver-hands dev:api          # http://127.0.0.1:4011
$ pnpm -C conver-hands dev:web          # http://127.0.0.1:4171
$ pnpm -C order-stamp dev:api           # http://127.0.0.1:4012
$ pnpm -C sun-and-moon dev:api          # http://127.0.0.1:4013
$ pnpm -C sun-and-moon dev:web          # http://127.0.0.1:4173
$ pnpm -C fun-fun-cloth dev:api         # http://127.0.0.1:4014
$ pnpm -C fun-fun-cloth dev:web         # http://127.0.0.1:4174
$ pnpm -C conver-hands worker
$ pnpm -C order-stamp worker
$ pnpm -C sun-and-moon worker
$ pnpm -C fun-fun-cloth worker
```

### GUI

1. Click *Code*.

![](./asset/screenshots/skill-hunter-installation-1.png)

2. Click *Download ZIP*.

![](./asset/screenshots/skill-hunter-installation-2.png)

3. Unzip the ZIP file.

## Browser support

Support for browsers like Opera, Vivaldi have not been extensively tested for the extension, but should work while support for Manifest V3 persists. [Open an issue](https://github.com/gongahkia/skill-hunter/issues) for further support.

## References

The name `Skill Hunter` is in reference to the Nen ability of [Chrollo Lucilfer](https://hunterxhunter.fandom.com/wiki/Chrollo_Lucilfer) (クロロ＝ルシルフル), the founder and leader of the Phantom Troupe in the ongoing manga series, [HunterXhunter](https://hunterxhunter.fandom.com/wiki/Hunterpedia).

![](https://i.redd.it/531lsuu5cj081.jpg)
