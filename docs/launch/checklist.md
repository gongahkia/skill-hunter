# Pre-launch Checklist

- [ ] Domain DNS live for the static landing page.
  Verify by: `curl -I https://rakuzaichi.<domain>/`

- [ ] Chrome Web Store listing approved.
  Verify by: `https://chrome.google.com/webstore/devconsole/`

- [ ] Firefox AMO listing approved.
  Verify by: `https://addons.mozilla.org/developers/addons`

- [ ] Safari TestFlight build available.
  Verify by: `https://appstoreconnect.apple.com/apps`

- [ ] README updated with current positioning, install notes, source link, and privacy link.
  Verify by: `rg -n "Zero-server browser-extension vault|PRIVACY.md|github.com/gongahkia/rakuzaichi" README.md`

- [ ] Demo GIF embedded near the top of README.
  Verify by: `test -f asset/reference/demo.gif && rg -n "demo.gif" README.md`

- [ ] PRIVACY.md linked from README and ready for store-review URLs.
  Verify by: `test -f PRIVACY.md && rg -n "PRIVACY.md" README.md`

- [ ] HN post drafted.
  Verify by: `test -f docs/launch/hn-post.md && rg -n "## Title|## Body|## First Comment" docs/launch/hn-post.md`

- [ ] Soft-launch drafts ready.
  Verify by: `test -f docs/launch/reddit-chatgpt.md && test -f docs/launch/reddit-localllama.md && test -f docs/launch/reddit-privacytools.md && test -f docs/launch/tweet-thread.md`

- [ ] Friends notified after approvals are live.
  Verify by: `https://mail.google.com/mail/u/0/#sent`
