// FUA
    // 2 implement
        // frontend (main.js)
            // format final output text to be as easy to read as possible using pure html and css and ask gpt to help me format this
            // responsive HTML and CSS
            // might have to add another html file here that is later generated dynamically if rendering doesn't work out, or change the core page content fundamentally 
            // allow toggling of page content
            // add further frontend using this https://www.linkedin.com/posts/praveen-shrivastav_unique-html-elements-ugcPost-7136674622204166144-NYvx?utm_source=share&utm_medium=member_desktop
        // extension specific (manifest.json)
            // allow the extension to run when the button is clicked
            // clean up extension description as well, make manifest.json code cleaner
    // playtest 
        // check other possible elit file formats that dont fit this specified mold
        // check other browsers that might not support this extension
        // https://www.elitigation.sg/gdviewer/s/2009_SGCA_3
        // https://www.elitigation.sg/gdviewer/s/2005_SGCA_2
        // https://www.elitigation.sg/gd/s/2006_SGCA_40

// -------------------- THIS CODE GOES IN CHRONOLOGICAL ORDER --------------------

// ---------- UNIVERSAL HEADER ---------- DONE!!!

var page = {
    caseTitle: "",
    caseNumber: "",
    caseDate: "",
    caseTribunalCourt: "",
    caseCoram: "",
    caseCounsel: "",
    caseParties: "",
    caseLegalIssues: [],
    caseBody: {}
};

var count = 0;

// case title
var a = document.querySelector(".caseTitle");
a.style.backgroundColor = "green";
page.caseTitle = a.textContent.trim();

// case summary data
var infoTable = document.querySelector("#info-table");
infoTable.style.backgroundColor = "yellow";
for (var i=0; i < infoTable.rows.length; i++) {
    var cells = infoTable.rows[i].cells;
    for (var q=0; q< cells.length; q++) {
        if (i === 0 && q === 2) {
            page.caseNumber = cells[q].innerText;
        } else if (i === 1 && q === 2) {
            page.caseDate = cells[q].innerText;
        } else if (i === 2 && q === 2) {
            page.caseTribunalCourt = cells[q].innerText;
        } else if (i === 3 && q === 2) {
            page.caseCoram = cells[q].innerText;
        } else if (i === 4 && q === 2) {
            page.caseCounsel = cells[q].innerText;
        } else if (i === 5 && q === 2) {
            page.caseParties = cells[q].innerText;
        } else {
            console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
            console.log(`Incorrect number of arguments for case summary table. Logged 'i':${i}, 'q':${q}.`);
        }
    }
}

// case legal issues
var legalIssues = document.querySelector("div.txt-body");
legalIssues.style.backgroundColor = "magenta";
if (legalIssues) {
    legalIssues.childNodes.forEach((childNode) => {
        if (childNode.nodeType === 1 && childNode.textContent != "") {
            page.caseLegalIssues.push(childNode.textContent.trim());
        }
    });
} else {
    console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
    console.log("No legal issues found.");
}

// console.log(`Case title: ${page.caseTitle}\nCase date: ${page.caseDate}\nCase tribunal / Courts: ${page.caseTribunalCourt}\nCase coram: ${page.caseCoram}\nCase counsel: ${page.caseCounsel}\nCase parties: ${page.caseParties}\nCase legal issues: ${page.caseLegalIssues}`);

// ---------- SPECIFIC BODY CONTENT ----------- DONE!!!

function secNumberCheck(a) {
    return /^\d/.test(a);
}

var imp = document.querySelectorAll("p");
var secName = "";
var buffer = [];
imp.forEach(function(paragraph) {
    if (paragraph.classList.contains("Judg-Heading-1")) {
        if (secName === "") {
            secName = paragraph.textContent.trim();
        } else {
            page.caseBody[secName] = buffer;
            secName = paragraph.textContent.trim();
            alert(buffer);
            buffer = [];
        }
        paragraph.style.backgroundColor = "yellow";
    } else if (paragraph.classList.contains("Judg-1")) { 
        if (secNumberCheck(paragraph.textContent.trim())) {
            paragraph.style.backgroundColor = "blue";
            buffer.push(paragraph.textContent.trim());
        }
    } else {
        count += 1;
        console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
        console.log("Unexpected conditional case hit.");
    }
});
page.caseBody[secName] = buffer;

// console.log(`Case body: ${JSON.stringify(page)}`);
// console.log(`Case body: ${JSON.stringify(page.caseBody)}`);

// ---------- FRONT-END CREATION ----------

