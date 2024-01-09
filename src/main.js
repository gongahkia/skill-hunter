// FUA 
    // restructure how data is stored
    // work out how to preserve tabs and newlines and existing formatting
    // further check what other page information needs to be extracted
    // general structure of SSO website
        // each section title and its text are nested within a div classes are provXHdr and provTxtX where X is a number that increases
        // each provTxtX should check whether it starts with a number, if it does and not a bracket, then indent the portion otherwise dont indent
        // each provTxtX should then be under the provHdrX section with an indent
    // implement parser in a main.js file first
    // add later popups and other functions seperately
    // allow reformatting to include a gruvbox theme

// 2 implement
    // when this project's parsing is done, add this to git
    // make frontend layout like CCLAW L4 project with dynamic responsive tables
    // add a make file as required
    // allow toggling to reformat SSO site but include a gruvbox theme
    // work out how to port this over to manifest 3.0 for firefox and chrome later after implementing it in 2.0
    // upload this on firefox website

alert("walahi");

// ---------- PARSING ----------

var pageData = {
    statuteTitle:"",
    statuteBody:[]
}

var section = {
    sectionTitle:"",
    sectionBody:"",
}

var regex = /^prov\d+(Txt|Hdr)$/; // matching regex for prov1Hdr or prov1Txt
var elements = document.querySelectorAll('*'); 
var txtElements = [];
var hdrElements = [];
Array.from(elements).forEach(function(element) {
    if (regex.test(element.className)) {
        if (element.className.endsWith('Hdr')) {
            if (section.sectionTitle === "") {
                section.sectionTitle = element.textContent.trim();
            } else {
                pageData.statuteBody.push(section);
                section = {
                    sectionTitle:"",
                    sectionBody:"",
                }
                section.sectionTitle = element.textContent.trim();
            }
        } else if (element.className.endsWith('Txt')) {
            section.sectionBody += element.textContent.trim();
        }
    } else if (element.className === "legis-title") {
        pageData.statuteTitle = element.textContent.trim();
    }
});
pageData.statuteBody.push(section);

console.log(pageData);

// --------- REFORMATTING ----------
