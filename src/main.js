// FUA 
    // !! work out how to preserve tabs and newlines and existing formatting
    // !! include a search of existing words and if a word is a definition, then edit it in the html to show a tag that will appear w different color and shows definition when hovered over as per test.html
    // implement the following check
        // !! def should be included, maybe add extra tag to pay attention to this => specify it is a definition section and can retroactively add the definitons within the "" by searching for the definiton in previous sections, effectively achieving what SSOparser on github did
            // this should be nested within the existing general provTxtHdrRegex check
        // !! section limbs will be under the class p1No and pTxt, with p1No being the letter and pTxt being the internal text provided
        // implement a check for each provTxtX should check whether it starts with a number, if it does and not a bracket, then indent the portion otherwise dont indent
            // frontend wise each provTxtX should then be under the provHdrX section with an indent
    // further develop understanding of structure of SSO website, class names are quite specific
        // structure of SSO website
            // each section title and its text are nested within a div classes are provXHdr and provTxtX where X is a number that increases
            // amendNote should be removed from the text to be printed
            // def should be included, maybe add extra tag to pay attention to this => specify it is a definition section
            // section limbs will be under the class p1No and pTxt, with p1No being the letter and pTxt being the internal text provided
    // continue testing if the amendNote check I've implemented works
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
var definitionRegex = /“([^”]+)”/;
var legislationTitle = "legis-title";
var amendNoteClass = ".amendNote";
var definitionClass = ".def";
var amendNote = [];

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
                    sectionTitle: element.textContent.trim(),
                    sectionBody:"",
                }
            }
        } else if (element.className.endsWith('Txt')) {
            section.sectionBody += element.textContent.trim();
            if (element.querySelector(amendNoteClass)){
                if (!amendNote.includes(element.querySelector(amendNoteClass).textContent)) {
                    amendNote.push(element.querySelector(amendNoteClass).textContent);
                }

                // console.log(amendNote);
                // console.log(section.sectionBody);
                
                amendNote.forEach(function (word) {
                    // console.log(amendNote);
                    section.sectionBody = section.sectionBody.split(word).join("\n");
                    // section.sectionBody = section.sectionBody.replace(new RegExp("\\b" + word + "\\b", 'g'), "");
                });
            }
        }
    }
});
pageData.statuteBody.push(section);

function extractDefinition(inputString) {
    var match = inputString.match(definitionRegex);
    var result = {
        term:"",
        definition:"",
    };
    if (match && match[1]) {
        result.term = match[1];
        result.definition = inputString;
    }
    return result;
}

var definitionElements = document.querySelectorAll(definitionClass);
definitionElements.forEach(el => pageData.statuteDefinitions.push(extractDefinition(el.textContent)));
pageData.statuteDefinitions.forEach(definitionPair => {
    amendNote.forEach(am => {
        definitionPair.definition = definitionPair.definition.split(am).join("");
    });
});
console.log(pageData);

// --------- REFORMATTING ----------
    // add tags for definitions here