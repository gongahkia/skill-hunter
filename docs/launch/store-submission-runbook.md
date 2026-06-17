# Store Submission Runbook

Use this after `npm run validate` passes and release artifacts are rebuilt.

## Local preflight

```console
npm run validate
npm run package
npm run package:firefox-source
npm run package:safari-local
shasum -a 256 rakuzaichi-chrome.zip rakuzaichi-firefox.xpi rakuzaichi-firefox-source.zip rakuzaichi-safari.zip
```

Expected artifacts:

- `rakuzaichi-chrome.zip`
- `rakuzaichi-firefox.xpi`
- `rakuzaichi-firefox-source.zip`
- `rakuzaichi-safari.zip` (unsigned local build only; not the App Store upload)

## Chrome Web Store

1. Open `https://chrome.google.com/webstore/devconsole/`.
2. Sign in with the publishing account.
3. If no developer account exists, complete the Chrome Web Store developer registration and verification first.
4. Click `Add new item`.
5. Upload `rakuzaichi-chrome.zip`.
6. Paste the Chrome fields from `docs/launch/store-listings.md`.
7. Upload screenshots from `asset/reference/1.png` through `asset/reference/5.png`; use `asset/reference/demo.gif` and `asset/reference/architecture.png` only where accepted.
8. Set category to `Productivity`.
9. Set support URL to `https://github.com/gongahkia/rakuzaichi/issues`.
10. Set privacy policy URL to `https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md`.
11. Fill permission justifications from `docs/launch/store-listings.md`.
12. Fill data/privacy fields to match `PRIVACY.md`: no telemetry, no analytics, chat data local, optional model fetch only for local extraction.
13. Save draft.
14. If ready to submit, click `Submit for review`.
15. Verify status at `https://chrome.google.com/webstore/devconsole/`.

## Firefox AMO

1. Open `https://addons.mozilla.org/developers/`.
2. Sign in or create a Mozilla account.
3. Click `Submit a New Add-on`.
4. Choose listed distribution on AMO.
5. Upload `rakuzaichi-firefox.xpi`.
6. If AMO requests source, upload `rakuzaichi-firefox-source.zip`.
7. Paste Firefox fields from `docs/launch/store-listings.md`.
8. Set license to `MIT`.
9. Paste reviewer notes from `docs/launch/store-listings.md`.
10. Set privacy policy URL to `https://github.com/gongahkia/rakuzaichi/blob/main/PRIVACY.md`.
11. Submit for review.
12. Verify queue/status at `https://addons.mozilla.org/developers/addons`.

## Safari / App Store Connect

1. Run `npm run safari:convert`.
2. Open `safari/Rakuzaichi/Rakuzaichi.xcodeproj` in Xcode.
3. Select the app target and extension target.
4. Set the Apple Developer team for both targets.
5. Confirm bundle ID `com.gabrielongzm.rakuzaichi`, or update docs if App Store Connect requires a different ID.
6. Build once locally in Xcode.
7. Product -> Archive.
8. In Organizer, choose Distribute App -> App Store Connect.
9. Upload the signed archive.
10. Open `https://appstoreconnect.apple.com/apps`.
11. Create/select the Rakuzaichi app record.
12. Paste Safari fields from `docs/launch/store-listings.md`.
13. Attach the uploaded build.
14. Fill privacy answers to match `PRIVACY.md`.
15. Submit for review or TestFlight review.
16. Verify TestFlight/App Review status in App Store Connect.

## References

- Chrome publish docs: `https://developer.chrome.com/docs/webstore/publish`
- Firefox submit docs: `https://extensionworkshop.com/documentation/publish/submitting-an-add-on/`
- Firefox source upload docs: `https://extensionworkshop.com/documentation/publish/source-code-submission/`
- Safari distribution docs: `https://developer.apple.com/safari/extensions/`
- Safari App Store Connect docs: `https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect`
