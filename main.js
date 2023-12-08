// FUA
    // 2 implement
        // specific body content (main.js)
            // change and trim existing code 
            // add display of all headers of class:"Judg-Heading-1" via folding so that no important information is omitted
        // frontend (main.js)
            // format final output text to be as easy to read as possible using pure html and css and ask gpt to help me format this
            // responsive HTML and CSS
            // might have to add another html file here that is later generated dynamically if rendering doesn't work out, or change the core page content fundamentally 
            // allow toggling of page content
        // extension specific (manifest.json)
            // allow the extension to run when the button is clicked
            // clean up extension description as well, make manifest.json code cleaner
    // playtest 
        // check other possible elit file formats that dont fit this specified mold
        // check other browsers that might not support this extension

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
}

// alert(`Case title: ${page.caseTitle}\nCase date: ${page.caseDate}\nCase tribunal / Courts: ${page.caseTribunalCourt}\nCase coram: ${page.caseCoram}\nCase counsel: ${page.caseCounsel}\nCase parties: ${page.caseParties}\nCase legal issues: ${page.caseLegalIssues}`);

// ---------- SPECIFIC BODY CONTENT -----------

var imp = document.querySelectorAll(".Judg-Heading-1");
imp.forEach(function (paragraph) {
    switch (paragraph.textContent.trim()) {
        case "Introduction":
            paragraph.style.backgroundColor = "yellow";
            break;
        case "The decision in the court below":
            break;
        case "Factual background":
            paragraph.style.backgroundColor = "yellow";
            break
        case "Our decision":
            break
        case "Judgment":
            paragraph.style.backgroundColor = "yellow";
            break;
        case "Conclusion":
            paragraph.style.backgroundColor = "yellow";
            break;
        default:
            count += 1
            console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
            console.log(`Heading found: ${paragraph.textContent.trim()}`);
    }
});
