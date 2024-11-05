const modalOverlay = document.getElementById("modalOverlay");
const cancelButton = document.getElementById("cancelButton");
const simplifyButton = document.getElementById("simplifyButton");
const settingsButton = document.getElementById("settingsButton");

cancelButton.addEventListener("click", () => {
    console.log("Cancel button clicked!");
    if (chrome.tabs) { // CHROME
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "cancel" }); 
        });
    } else if (browser.tabs) { // FIREFOX
        browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
            browser.tabs.sendMessage(tabs[0].id, { action: "cancel" }); 
        });
    } else { // UNSUPPORTED BROWSER
        console.error("Error hit: tabs API not supported in this environment");
    }
    window.close()
});

settingsButton.addEventListener("click", () => {
    console.log("Settings button clicked!");
    if (chrome.tabs) { // CHROME
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "settings" }); 
        });
    } else if (browser.tabs) { // FIREFOX
        browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
            browser.tabs.sendMessage(tabs[0].id, { action: "settings" }); 
        });
    } else { // UNSUPPORTED BROWSER
        console.error("Error hit: tabs API not supported in this environment");
    }
    window.close()
});

simplifyButton.addEventListener("click", () => {
    console.log("Simplify button clicked!");
    if (chrome.tabs) { // CHROME
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "simplify" , toggle: true });
        });
    } else if (browser.tabs) { // FIREFOX
        browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
            browser.tabs.sendMessage(tabs[0].id, { action: "simplify", toggle: true });
        });
    } else { // UNSUPPORTED BROWSER
        console.error("Error hit: tabs API not supported in this environment");
    }
    window.close()
});

// function hideModal() {
//     modalOverlay.style.visibility = "hidden";
// }

// // hide the modal when clicking outside of the overlay 
// modalOverlay.addEventListener("click", (event) => {
//     if (event.target === modalOverlay) {
//         hideModal(); 
//     }
// });