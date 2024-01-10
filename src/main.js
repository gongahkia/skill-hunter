// FUA 
    // !! implement a check for each provTxtX should check whether it starts with a number, if it does and not a bracket, then indent the portion otherwise dont indent
        // frontend wise each provTxtX should then be under the provHdrX section with an indent
    // !! implement a check that replaces all instances once within a section instead of split and join, then checking the count and passing an iteration when count is one to prevent recursive definitions
        // !! handle situations of recursive definitions, where one interpreted term is nested in another term, and resolve those instances accordingly
    // !! work out how to preserve tabs and newlines and existing formatting
    // !! add a div class called section that sections off each statute nicely
    // !! handle situations s of words beginning at the start, perhaps sort the array by length to avoid this issue?
    // !! handle situations of defintions not being the whole word but being part of one word, i can still define them but should resolve the space caused by split accordingly
    // !! work on front-end format of simplifyContent
    // !! should i remove the recursive definitions of the terms within the interpretation section terms within the interpretation section
    // !! make popup button look nicer
    // allow reformatting to include a gruvbox light and dark theme, matcha, everforest and rosepine theme
    // further develop understanding of structure of SSO website, class names are quite specific
        // structure of SSO website
            // each section title and its text are nested within a div classes are provXHdr and provTxtX where X is a number that increases
            // amendNote should be removed from the text to be printed
            // def should be included, maybe add extra tag to pay attention to this => specify it is a definition section
            // section limbs will be under the class p1No and pTxt, with p1No being the letter and pTxt being the internal text provided
    // continue testing if the amendNote check I've implemented works

// 2 implement
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

// HELPER FUNCTIONS

function integrateDefinition(pageData) {
    pageData.statuteBody.forEach(section => {
        pageData.statuteDefinitions.forEach(definitionPair => {
            if (section.sectionBody.includes(definitionPair.term)) {
                const rip = `
                    <div class="statuteTerm-container">
                        ${definitionPair.term}
                        <div class="statuteDefinition-content">${definitionPair.definition}</div>
                    </div>
                `;
                section.sectionBody = section.sectionBody.split(definitionPair.term).join(rip);
            }
        });
    });
}

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
                    section.sectionBody = section.sectionBody.split(word).join("<br>");
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
        result.term = match[1].trim();
        result.definition = inputString.trim();
    }
    return result;
}

var definitionElements = document.querySelectorAll(definitionClass);
definitionElements.forEach(el => pageData.statuteDefinitions.push(extractDefinition(el.textContent)));
pageData.statuteDefinitions.forEach(definitionPair => {
    amendNote.forEach(am => {
        definitionPair.definition = definitionPair.definition.split(am).join("").trim();
    });
});

// console.log(pageData);

// --------- REFORMATTING ----------
    // add tags for definitions here

integrateDefinition(pageData);

// console.log(pageData);

// ---------- FRONT-END ----------

function simplifyContent(pageData) {

    const backupTitle = document.title;
    const backup = document.body.innerHTML;

    var styleContent = `
    .body {
    font-family: 'Arial', sans-serif;
    background-color: #f8f8f8;
    color: #333;
    margin: 0;
    padding: 0;
    }

    .statuteTerm-container {
        position: relative;
        display: inline-block;
        color: darkGreen; /* Change the color as needed */
    }

    .statuteDefinition-content {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        max-width: 400px; /* Adjust the max-width as needed */
        min-width: 200px; /* Adjust the min-width as needed */
        max-height: 300px; /* Adjust the max-height as needed */
        overflow-y: auto; /* Add scroll if content exceeds max-height */
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
        white-space: pre-wrap; /* Preserve line breaks */
        width: auto; /* Allow dynamic sizing based on content */
    }

    .statuteTerm-container:hover .statuteDefinition-content {
        opacity: 1;
        visibility: visible;
    }

    .statuteTerm-container:hover {
        color: lightgreen; /* Change the color when hovered over */
    }

    .github-credit {
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 12px;
        color: #555;
    }
    `;

    document.body.innerHTML = `
    <div id="sectionBody"></div>
    <div class="github-credit">
        Designed and built by <a href="https://gongahkia.github.io/">Gabriel Ong</a> | <a href="https://github.com/gongahkia/skill-hunter">Source</a>
    </div>
    `;

    document.title = "Skill Hunter";

    var styleEl = document.querySelector("style");
    if (styleEl) {
        styleEl.innerHTML = styleContent;
    } else {
        var newStyleEl = document.createElement("style");
        newStyleEl.innerHTML = styleContent;
        document.head.appendChild(newStyleEl);
    }

    // FUA add more formatting html code here for sectionTitle and sectionBody

    console.log(pageData);

    var sectionBody = document.getElementById("sectionBody");
    pageData.statuteBody.forEach(sectionPair => {
        sectionBody.innerHTML += "<h2>" + sectionPair.sectionTitle + "</h2><br>";
        sectionBody.innerHTML += sectionPair.sectionBody + "<br>";
    });

    // sectionBody.innerHTML = JSON.stringify(pageData.statuteBody);

    return [backupTitle, backup];
}

function restoreContent(backupTitle, backup) {
    document.title = backupTitle || "",
    document.body.innerHTML = backup || "";
}

simplifiedState = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.toggle) {
    console.log("toggling");
    if (simplifiedState) {
        restoreContent(backupTitle, backup);
        simplifiedState = false;
    } else {
        backupPair = simplifyContent(pageData);
        backupTitle = backupPair[0];
        backup = backupPair[1];
        simplifiedState = true;
    }
  }
});