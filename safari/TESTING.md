# Safari development and testing

The Safari app embeds the same compiled extension used by Chrome and Firefox.
Its Xcode build phase runs Webpack and stages a Safari manifest with a
nonpersistent background script. The shared `dist/manifest.json` stays unchanged.
The toolbar popup and inline preview behavior are shared across the browsers.

## Without Xcode

Install Node.js 22+, npm, and Python 3.9+, then run from the repository root:

```sh
npm ci
make safari-test
make safari-prepare
```

The staged, validated resources are in `build/safari-extension/`. Portable tests
cover missing scripts and popup assets, manifest conversion, repeated builds,
and native bundle integrity using synthetic app fixtures. They do not compile Swift.

On a Mac with Safari, enable **Allow Remote Automation** in Safari's developer
settings, then run:

```sh
make safari-browser-test
```

This starts a temporary local fixture server and a Safari WebDriver session.
It checks real pointer hovers, Escape dismissal, three toggle cycles, original
page controls, and preservation of source text, title, and layout. Extension
APIs are simulated in this test; it does not verify an installed extension,
toolbar popup, site permissions, or background network requests.

## With full Xcode

Use Xcode 16 or later. The native deployment target is macOS 13.3, whose bundled
Safari 16.4 supports the regular expression lookbehind used by the shared code.
Node, npm, and Python must be available in Xcode's build environment. The build
phase also searches `/opt/homebrew/bin` and `/usr/local/bin`; when using a version
manager, launch Xcode from a shell with that environment or run the Make target.

```sh
npm ci
make safari-test
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer make safari-check
```

Adjust `DEVELOPER_DIR` if Xcode is installed elsewhere. `safari-check` builds the
shared **Skill Hunter** scheme without signing, then validates the app's versions,
bundle identifiers, embedded extension registration, executables, and compiled
web resources. Output:

```text
build/safari/DerivedData/Build/Products/Debug/Skill Hunter.app
```

You can also open `safari/Skill Hunter/Skill Hunter.xcodeproj` and run that scheme.
The extension's **Build WebExtension resources** phase always rebuilds JavaScript,
so Xcode cannot silently package a stale `dist/` directory. If an older build left
unmanaged extension resources in DerivedData, clean the Xcode build folder first.

## Installed extension checks

1. For the unsigned development build, enable **Allow Unsigned Extensions** in
   Safari's developer settings. This setting may need enabling again after a
   Safari restart. Signed distribution is a separate step.
2. Open the built app. Use **Open Safari Settings** to enable Skill Hunter and
   allow website access to SSO and eLitigation.
3. Open [the Consumer Protection Act](https://sso.agc.gov.sg/Act/CPFTA2003?WholeDoc=1)
   and [Voltas v York, 2024 SGCA 12](https://www.elitigation.sg/gd/s/2024_SGCA_12).
4. Check that the toolbar popup shows page properties and its inline preview toggle.
5. Enable previews, hover a definition and a section reference, and follow a
   source link. On the judgment, hover a cited statute and another judgment citation
   to exercise background lookups and any rendered-source fallback.
6. Dismiss a card with Escape. Disable previews and confirm that underlines disappear
   while the original page layout, navigation, and controls remain usable.
7. Reload the page and restart Safari to check the saved preview preference.

The project currently has no XCTest target. `safari-check` validates a built app;
`safari-browser-test` checks the Safari engine. The installed-extension steps above
are the remaining manual integration checks, including historical-version and
official-source access failures.
