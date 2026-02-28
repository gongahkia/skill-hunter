[![](https://img.shields.io/badge/skill_hunter_1.0-deprecated-red)](https://github.com/gongahkia/skill-hunter/releases/tag/1.0) [![](https://img.shields.io/badge/skill_hunter_2.0-passing-green)](https://github.com/gongahkia/skill-hunter/releases/tag/2.0) [![](https://img.shields.io/badge/skill_hunter_3.0-passing-dark_green)](https://github.com/gongahkia/skill-hunter/releases/tag/3.0)

# Skill Hunter

<p align="center">
<img src="./asset/logo/logo_words.png" width=50% height=50%>
</p>

[Monorepo](#skills) for legal workflow tools.

## Skills

* `Skill Hunter`: Browser extension for readable Singapore legislation on SSO
    * [SSO](https://sso.agc.gov.sg/) is the most-referenced source for lawyers when keeping up to date with Singapore Legislation. Time is often spent poring over definitions and navigating between interpretation and offence sections. `Skill Hunter` simplifies the heavily-nested DOM structure of the webpage to one that is intuitive and easily understood by lawyers and programmers alike.
* `Legal Tech Thing`: Multi-app contract review platform
    * `legal-tech-thing` extends this repository into a full contract-ingestion and review stack (web, extension, desktop, API, workers), so one repo now contains two legal-productivity "skills" with different use cases.

## Screenshots

### Skill Hunter

![](./asset/screenshots/skill-hunter-screenshot-4.png)

### Legal Tech Thing

![](./asset/screenshots/)

## Stack

### Skill Hunter (`skill-hunter/`)

* [TypeScript](https://www.typescriptlang.org/), [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS), [Webpack](https://webpack.js.org/), [Jest](https://jestjs.io/), [npm](https://www.npmjs.com/)

### Legal Tech Thing (`legal-tech-thing/`)

* *Frontend*: [Next.js](https://nextjs.org/), [Electron](https://www.electronjs.org/)
* *Backend*: [Fastify](https://fastify.dev/), [BullMQ](https://docs.bullmq.io/), [TypeScript](https://www.typescriptlang.org/), [pnpm](https://pnpm.io/), [Turborepo](https://turbo.build/repo)
* *DB*: [Prisma](https://www.prisma.io/), [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)

### Shared

* *Code Quality*: [ESLint](https://eslint.org/), [Prettier](https://prettier.io/)

## Supported browsers

Find `Skill Hunter` on the [Chrome Web Store](https://chromewebstore.google.com) or [Firefox browser Add-ons](https://addons.mozilla.org/en-US/firefox/).

| Browser | Status | Link |
| :--- | :--- | :--- | 
| Google Chrome | ![](https://img.shields.io/badge/Status-Awaiting%20Approval-orange) | ... | 
| Firefox | ![](https://img.shields.io/badge/Status-Up-brightgreen) | [addons.mozilla.org/en-US/firefox/addon/skill-hunter/](https://addons.mozilla.org/en-US/firefox/addon/skill-hunter/) |
| Safari | ![](https://img.shields.io/badge/Status-Unsupported-red) | NIL | 

## [Presentation](./asset/presentation/class_part.pdf)

## Installation

Build the monorepo locally.

### CLI

```console
$ git clone https://github.com/gongahkia/skill-hunter
$ cd skill-hunter
$ npm install
$ make
$ cd skills/legal-tech-thing
$ pnpm install
$ pnpm build
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
