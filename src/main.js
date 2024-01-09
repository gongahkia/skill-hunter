// FUA 
    // continue adding code where i stopped --> restructure how data is stored
    // further check what other page information needs to be extracted
    // work out general structure of SSO website
        // each section title and its text are nested within a div classes are provXHdr and provTxtX where X is a number that increases
        // use regex?
    // implement parser in a main.js file first
    // add later popups and other functions seperately

// 2 implement
    // rename this project nicely
    // get actual good assets for the icon pictures
    // when this project's parsing is done, add this to git
    // make frontend layout like CCLAW L4 project with dynamic responsive tables
    // add a make file as required
    // allow toggling to reformat SSO site but include a gruvbox theme
    // work out how to port this over to manifest 3.0 for firefox and chrome later after implementing it in 2.0
    // upload this on firefox website

alert("walahi");

var pageData = {
    pageTitle:"",
    pageBody:{}
}

var regex = /^prov\d+(Txt|Hdr)$/; // matching regex for prov1Hdr or prov1Txt
var elements = document.querySelectorAll('*'); 
var txtElements = [];
var hdrElements = [];
Array.from(elements).forEach(function(element) {
    if (regex.test(element.className)) {
        if (element.className.endsWith('Txt')) {
            txtElements.push(element);
        } else if (element.className.endsWith('Hdr')) {
            hdrElements.push(element);
        }
    }
});

txtElements.forEach(textEl => console.log(textEl.textContent));
hdrElements.forEach(headEl => console.log(headEl.textContent));
