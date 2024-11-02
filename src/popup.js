// document.getElementById('simplifyButton').addEventListener('click', function() {
//     if (chrome.tabs) { // CHROME
//         alert("chrome")
//         chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
//         chrome.tabs.sendMessage(tabs[0].id, { toggle: true });
//         });
//     } else if (browser.tabs) { // FIREFOX
//         alert("firefox")
//         browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
//         browser.tabs.sendMessage(tabs[0].id, { toggle: true });
//         });
//     } else { // UNSUPPORTED BROWSER
//         console.error("tabs API not supported in this environment");
//     }
// });

document.getElementById('cancelButton').addEventListener('click', () => {
    window.close(); // Closes the popup
});

document.getElementById('simplifyButton').addEventListener('click', () => {
    // Implement your "simplify" functionality here
    console.log("Simplify button clicked!");
});
