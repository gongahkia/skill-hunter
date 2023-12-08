// eg
    /*
    var paragraphs = document.querySelectorAll('p');
    paragraphs.forEach(function (paragraph) {
    paragraph.style.backgroundColor = 'red';
    });
    */

alert("temporary elit notification huatah")

// check whether other possible elit file formats that dont fit this specified mold
// format final output text to be as easy to read as possible

// ---------- THIS CODE GOES IN CHRONOLOGICAL ORDER ----------

var caseTitle = document.querySelector(".caseTitle");
caseTitle.style.backgroundColor = "yellow";

var infoTable = document.querySelector("#info-table");
infoTable.style.backgroundColor = "yellow";
// add code to iterate through this table

// add code to examine the txt.body after the table we just iterated over of class="txt-body"

var imp = document.querySelectorAll(".Judg-Heading-1");
var count = 0;
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
        case "Conclusion":
            paragraph.style.backgroundColor = "yellow";
            break;
        default:
            count += 1
            console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
            console.log(`Heading found: ${paragraph.textContent.trim()}`);
    }
});
