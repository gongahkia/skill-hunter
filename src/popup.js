document.getElementById('simplifyButton').addEventListener('click', function() {

  // FIREFOX
  browser.tabs.create({
    url: browser.extension.getURL("simple.html"),
    active: true
  });

  // CHROME
  chrome.tabs.create({
    url: chrome.extension.getURL("simple.html"),
    active: true
  });
});