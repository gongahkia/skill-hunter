// FUA 
    // implement the following check
        // !! amendNote should be removed from the text to be printed
        // !! def should be included, maybe add extra tag to pay attention to this => specify it is a definition section and can retroactively add the definitons within the "" by searching for the definiton in previous sections, effectively achieving what SSOparser on github did
            // this should be nested within the existing general provTxtHdrRegex check
        // !! section limbs will be under the class p1No and pTxt, with p1No being the letter and pTxt being the internal text provided
        // implement a check for each provTxtX should check whether it starts with a number, if it does and not a bracket, then indent the portion otherwise dont indent
            // frontend wise each provTxtX should then be under the provHdrX section with an indent
    // !!! debug the issue with lazy loading for longer sites where despite clicking get full document, the parser can't detect or save more than one PART (eg in penal code or poha, only PART 1 is shown, is there a way I can circumvent this so all text is rendered?)
    // further develop understanding of structure of SSO website, class names are quite specific
        // structure of SSO website
            // each section title and its text are nested within a div classes are provXHdr and provTxtX where X is a number that increases
            // amendNote should be removed from the text to be printed
            // def should be included, maybe add extra tag to pay attention to this => specify it is a definition section
            // section limbs will be under the class p1No and pTxt, with p1No being the letter and pTxt being the internal text provided
    // work out how to preserve tabs and newlines and existing formatting
    // add popups and other functions seperately later
    // allow reformatting to include a gruvbox light and dark theme, matcha, everforest and rosepine theme

// 2 implement
    // when this project's parsing is done, add this to git
    // make frontend layout like CCLAW L4 project with dynamic responsive tables
    // add a make file as required
    // allow toggling to reformat SSO site but include a gruvbox theme
    // work out how to port this over to manifest 3.0 for firefox and chrome later after implementing it in 2.0
    // upload this on firefox website

// ---------- CODE STARTS HERE ----------

alert("walahi");

// ---------- PARSING ----------

var pageData = {
    statuteTitle:"",
    statuteBody:[],
    statuteDefinitions:[]
}

var section = {
    sectionTitle:"",
    sectionBody:"",
}


// SEARCH PARAMETERS

var provTxtHdrRegex = /^prov\d+(Txt|Hdr)$/; // matching regex for prov1Hdr or prov1Txt
var legislationTitle = "legis-title";

// ACTUAL LOGIC

var elements = document.querySelectorAll('*'); 
Array.from(elements).forEach(function(element) {
    if (element.className === legislationTitle) {
        pageData.statuteTitle = element.textContent.trim();
    } else if (provTxtHdrRegex.test(element.className)) {
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
    }
});
pageData.statuteBody.push(section);

console.log(pageData);

// --------- REFORMATTING ----------
