/*
FUA 
    * implement actual toggling of the site code first with reference to the archived repo main.js code

    * add credits made by gabriel ong and my github at the top right of the page
    * consider adding a general link to FAQs per here --> https://sso.agc.gov.sg/Help/FAQ

    * figure out if i can make the hovering definition prettier like the previous definitions in the version 1 of this project
        * add additional URL links so those words can be clicked to be brought to the definition section 

    * add code that handles conversion of newline characters and other non-html specific characters to html so that the text is rendered cleanly
    when fedback and displayed

    * add further support to seperate and store part numbers and part headers in the created json

    * integrate further functionality such as 
        * statutes referenced within other statutes can be linked and their respective URLs will be clickable as well
        * mention of a given limb or section dependent on other sections will also be clickable, can be brought to that dependent section immediately
        * allow statutes and their composite sections and subsections to fold accordingly
            * implement with the collapsible class with code from https://www.w3schools.com/howto/howto_js_collapsible.asp
 
    * allow user customisation via specification of additional configurations within a local .json file users can place in the same directory as the manifest.json
        * add a ui button on the pop-up page to tweak settings
            * add functionality and link to the
                * change font
                * change colorscheme
                * functions i've implemented above
        * add serialising and deserialising functions to read this config.json
        * add documentation for what can be customised in the README.md

        * rewrite the frontend to be pretty and minimal with nice smooth animations 
            * reference idea --> https://cdn.prod.website-files.com/62dabe5dc266a398da4d2629/62fcf2e4a604ce2bd71b7011_all-activities.png   

    * consider adding a local notepad that users can use to save specific statutes or an AI integration that explains what a given statute means to users

    * clean up the description, screenshots and installation and USAGE instructions in the README.md
    * HARD DEADLINE 7 Nov to get skill_hunter up and running
        * email Jerrold Soh then to sell my app and harvest free classpart if possible
        * value proposition will be any statute viewed via SSO
        * tort-law specific statutes include Tort Limitation Act, POHA, Penal Code (find others)
    * test to ensure the browser extension runs on all statutes including longer ones like the Penal Code
    * test out functionality of browser extension on the following browsers, then specify which browsers the extension is functional for in the README.md under browser support
        * google chrome
        * microsoft edge
        * mozilla firefox 
        * brave
        * opera
        * safari (come up with a browser-specific version for portability and runnability on macs if required)
    * consider handling installation of skill_hunter using docker or some other tools, ask GPT what other tooling alternatives there are for this
*/

// ~~~~~~~~~~ CODE STARTS HERE ~~~~~~~~~~

// ~~~~~ HELPER FUNCTIONS ~~~~~

function deserialiseJSON(inp_json) {
    /*
    deserialises a JSON string for easy 
    debugging
    */
    return JSON.stringify(inp_json, null, 4)
}

function formatLogicalConnecters(input_sentence) {
    /*
    formats any logical connectors within a 
    sentence by bolding and italicising them
    */
    const logicalConnectingWords = [
    "and", "also", "as well as", "in addition", "furthermore", "moreover",
    "but", "however", "on the other hand", "yet", "although", "nevertheless",
    "because", "since", "therefore", "thus", "as a result", "consequently",
    "similarly", "likewise", "in the same way", "first", "then", "next", 
    "finally", "afterward", "if", "unless", "provided that",
    "besides", "not only... but also", "along with", "as well",
    "despite", "in contrast", "on the contrary", "even though", "rather",
    "due to", "owing to", "for this reason", "accordingly",
    "in comparison", "just as", "equally", "correspondingly",
    "subsequently", "prior to", "simultaneously", "at the same time", "earlier",
    "in case", "assuming that", "even if", "as long as",
    "granted that", "admittedly", "regardless",
    "in summary", "to sum up", "in conclusion", "all in all", "ultimately",
    "for example", "for instance", "to illustrate", "in other words",
    "or", "nor", "either", "alternatively", "otherwise"
    ];
    const regexPattern = new RegExp(`\\b(${logicalConnectingWords.join('|')})\\b`, 'gi');
    return input_sentence.replace(regexPattern, (match) => `<b><i>${match}</i></b>`);
}

function needsIndentation(line) {
    /*
    checks whether a given line fulfills the 
    pattern for indentation
    */
    const pattern = /^\((?:[a-z]|[1-9][0-9]*)\)\s/;
    return pattern.test(line);
}

function randomEmoji() {
    /*
    returns a random emoji from a predefined list
    */
    const emojiArray = [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", 
        "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "🥲", "🤗", "🤩", "🤔", "🤨", "😐", 
        "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", 
        "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😶‍🌫️", "🥴", "😵", "😵‍💫", "🤯", 
        "🤠", "😎", "🥳", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", 
        "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", 
        "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", 
        "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
        "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", 
        "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", 
        "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", 
        "🦶", "🖖", "👂", "🦻", "👃", "👀", "👁️", "👅", "👄", "🫦", "🧠", "🫀", "🫁",
        "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🦝", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", 
        "🐷", "🐽", "🐸", "🐵", "🦍", "🦧", "🦮", "🐕", "🐩", "🐈", "🐈‍⬛", "🐅", "🐆", 
        "🦓", "🦄", "🦌", "🐂", "🐄", "🐖", "🦏", "🦛", "🐪", "🐫", "🦙", "🦒", "🐘", 
        "🦏", "🦣", "🐁", "🐀", "🦫", "🦔", "🐇", "🦨", "🦡", "🦇", "🐓", "🦉", "🦅", 
        "🦆", "🦢", "🦜", "🦩", "🐥", "🐣", "🐤", "🦋", "🐌", "🐛", "🐜", "🦗", "🐞", 
        "🦂", "🦟", "🦠", "🌻", "🌼", "🌸", "💐", "🏵️", "🌹", "🥀", "🪷", "🪹", "🌲", 
        "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🌵", "🌾", "🌱", "🪴", "🍁", "🍂", "🍃", 
        "🪺", "🌍", "🌎", "🌏", "🌐", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", 
        "🍎", "🍏", "🍒", "🍓", "🫐", "🥝", "🍅", "🫒", "🥥", "🥑", "🍆", "🥔", "🥕", 
        "🌽", "🌶️", "🫑", "🥒", "🥬", "🧄", "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", 
        "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", 
        "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", 
        "🥗", "🍿", "🧈", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", 
        "🍤", "🍥", "🦪", "🍡", "🧁", "🍰", "🎂", "🍨", "🍧", "🍦", "🍩", "🍪", "🍫", 
        "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", 
        "🍺", "🍻", "🥂", "🥃", "🥤", "🧋", "🧃", "🧉", "🧊", "🌍", "🌎", "🌏", "🌐", 
        "🗺️", "🗾", "🧭", "🏔️", "⛰️", "🏕️", "🏖️", "🏜️", "🏝️", "🏞️", "🏟️", "🏛️", "🏗️", 
        "🏘️", "🏙️", "🏚️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", 
        "🏫", "🏬", "🏭", "🏯", "🏰", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", 
        "⛲", "⛺", "🏠", "🌅", "🌄", "🌇", "🌆", "🌉", "🌌", "🌠", "🎆", "🎇", "🧨", 
        "✨", "✴️", "🏙️", "🏞️", "🌋", "🌁", "🛤️", "🛣️", "🛫", "🛬", "🚂", "🛤️", "🚄", 
        "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", 
        "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🛻", "🚚", "🚛", "🚜", 
        "🏎️", "🏍️", "🛵", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "⌚", "📱", "📲", 
        "💻", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "🧮", "💾", "💿", "📀", "🧲", "📡", 
        "🔋", "🔌", "💡", "🔦", "🕯️", "💰", "💳", "💎", "⚖️", "🔧", "🔨", "⚒️", "🛠️", 
        "⛏️", "🔩", "⚙️", "🗜️", "🔫", "💣", "🧨", "🪓", "🧱", "🛡️", "🦯", "🧲", "🪚", 
        "🪛", "🪒", "🔑", "🗝️", "🚪", "🪑", "🛏️", "🛋️", "🚿", "🛁", "🚽", "🪠", "🧻", 
        "🧼", "🧽", "🪣", "🧴", "🛒", "🚬", "⚰️", "⚱️", "🗿", "🪆", "🪐", "🛰️", "🛸", 
        "🛎️", "🚪", "🛌", "🛀", "🚿", "🛋️"
    ];
    return emojiArray[Math.floor(Math.random() * emojiArray.length)];
}

// ~~~~~ COSMETIC ~~~~~

function applyColorScheme(scheme) {
    /*
    applies the specified colorscheme to 
    the browser and returns the current 
    browser colorscheme
    */
    const root = document.documentElement;
    const schemes = {
        'dark': {
            '--bg-color': '#1e1e1e',
            '--text-color': '#ffffff',
        },
        'light': {
            '--bg-color': '#ffffff',
            '--text-color': '#000000',
        },
        'gruvbox': {
            '--bg-color': '#282828',
            '--text-color': '#ebdbb2',
        },
        'everforest': {
            '--bg-color': '#2b3339',
            '--text-color': '#d3c6aa',
        },
        'solarized-dark': {
            '--bg-color': '#002b36',
            '--text-color': '#839496',
        },
        'solarized-light': {
            '--bg-color': '#fdf6e3',
            '--text-color': '#657b83',
        },
        'dracula': {
            '--bg-color': '#282a36',
            '--text-color': '#f8f8f2',
        },
        'monokai': {
            '--bg-color': '#272822',
            '--text-color': '#f8f8f2',
        },
        'nord': {
            '--bg-color': '#2e3440',
            '--text-color': '#d8dee9',
        },
        'tokyo-night': {
            '--bg-color': '#1a1b26',
            '--text-color': '#c0caf5',
        }
    };
    const selectedScheme = schemes[scheme];
    if (selectedScheme) {
        root.style.setProperty('--bg-color', selectedScheme['--bg-color']);
        root.style.setProperty('--text-color', selectedScheme['--text-color']);
    } else {
        console.warn(`Color scheme "${scheme}" not found`);
    }
}

function applyFont(font) {
    /*
    applies the specified font to the 
    browser and returns the current
    browser font
    */
    const availableFonts = ['Arial', 'Times New Roman', 'Comic Sans MS', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Palatino', 'Garamond', 'Helvetica'];
    if (availableFonts.includes(font)) {
        document.body.style.fontFamily = font;
    } else {
        console.warn(`Font "${font}" not supported`);
    }
    return None
}

// ~~~~~ SCRAPE DATA ~~~~~

function getPageMetadata() {
    /*
    returns basic metadata about the 
    current webpage
    */
    const title = document.title;
    const url = window.location.href;
    const characterSet = document.characterSet; // note that document.charset is now deprecated
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const description = descriptionMeta ? descriptionMeta.content : '';
    // const htmlBody = document.body.innerHTML; // ignoring this right now because it makes the returned JSON way too long
    const logoRef = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    const logoLink = logoRef ? logoRef.href : '';
    return {
        url,
        title,
        logoLink,
        characterSet,
        description
        // htmlBody
    };
}

function getPageBasicData() {
    /*
    returns metadata and other non-vital
    information about the current webpage
    */
    pageMetadata = getPageMetadata()
    const header = document.querySelector('div#topLeftPanel');
    linkedTableOfContents = []
    if (header) {
        legislationTitle = header.querySelector('div.legis-title')?.innerText.trim();
        legislationPdfLink = header.querySelector('span.fa.fa-file-pdf-o').parentElement.href.trim();
        legislationStatus = header.querySelector('div.status-value')?.innerText.trim();
    } else {
        legislationTitle = ""
        legislationPdfLink = ""
        legislationStatus = ""
    }
    const tableOfContents = document.querySelector('div#tocPanel.toc-panel div#tocNav nav#toc')
    if (tableOfContents) {
        elementArray = tableOfContents.querySelectorAll('a.nav-link')
        if (elementArray) {
            for (el of elementArray){
                linkedTableOfContents.push(
                    {
                        "referenceText": el.innerText.trim(),
                        "referenceUrl": el.href.trim()
                    }
                )
            }
        }
    }
    return {
        "pageMetadata": pageMetadata,
        "pageBasicData": {
            "legislationTitle": legislationTitle,
            "legislationPDFDownloadLink": legislationPdfLink,
            "legislationStatus": legislationStatus,
            "tableOfContents": linkedTableOfContents
        }
    }
}

function getLegislationMetaData() {
    /*
    extract meta data about the given 
    legislation for subsequent display
    */
    const legisFront = document.querySelector("div#colLegis div#legisContent div.front")
    if (legisFront){
        legislationName = legisFront.querySelector("table tbody tr td.actHd")?.innerText.trim();
        legislationDescription = legisFront.querySelector("table tbody tr td.longTitle")?.innerText.trim();
        legislationDate = legisFront.querySelector("table tbody tr td.cDate")?.innerText.trim();
        revisedLegislationName = legisFront.querySelector("table tbody tr td.revdHdr")?.innerText.trim();
        revisedLegislationText = legisFront.querySelector("table tbody tr td.revdTxt")?.innerText.trim();
    } else {
        legislationName = "";
        legislationDescription = "";
        legislationDate = "";
        revisedLegislationName = "";
        revisedLegislationText = "";
    }
    return {
        "legislationName": legislationName,
        "legislationDescription": legislationDescription,
        "legislationDate": legislationDate,
        "revisedLegislationName": revisedLegislationName,
        "revisedLegislationText": revisedLegislationText
    }
}

function getLegislationDefinitions() {
    /*
    extracts definitions from within
    legislation and places it within 
    a json object for later retrieval
    */
    const definitions = []; 
    const regex = /“([^”]+)”/g;
    const provisionContainers = document.querySelectorAll("#colLegis #legisContent div.body div[class^='prov']");
    provisionContainers.forEach(container => {
        const rows = container.querySelectorAll("table tbody tr");
        rows.forEach(row => {
            const definitionCell = row.querySelector("td.def");
            if (definitionCell) {
                const sentence = definitionCell.innerText.trim();
                let match;
                if ((match = regex.exec(sentence)) !== null) {
                    const term = match[1].trim(); 
                    definitions.push({ [term]: sentence }); 
                }
            }
        });
    });
    return definitions;
}

function getLegislationContent() {

    /*
    extract main bulk of the content from the 
    legislation document
    */

    const content = [] 
    const provisionContainers = document.querySelectorAll("#colLegis #legisContent div.body div[class^='prov']");

    // console.log(provisionContainers)

    provisionContainers.forEach(container => {

        const rows = container.querySelectorAll("table tbody tr");

        rows.forEach(row => {

            // console.log(row.innerText.trim())

            const sectionHeader = row.querySelector("td[class^='prov'][class$='Hdr']")
            if (sectionHeader) {
                const sectionHeaderText = sectionHeader.innerText.trim()
                const sectionHeaderID = sectionHeader.id.trim()
                // console.log(sectionHeaderID, sectionHeaderText)
                content.push(
                    {
                        "type": "sectionHeader",
                        "ID": sectionHeaderID,
                        "content": sectionHeaderText
                    }
                )
            } else {}

            const illustrationHeaderOrContent = row.querySelector("td.fs")
            if (illustrationHeaderOrContent) {
                if (illustrationHeaderOrContent.innerHTML.includes("<em>Illustration</em>") || illustrationHeaderOrContent.innerHTML.includes("<em>Illustrations</em>")) {
                    const illustrationHeaderText = illustrationHeaderOrContent.innerText.trim()
                    // console.log(illustrationHeaderText)
                    content.push(
                        {
                            "type": "illustrationHeader",
                            "ID": null,
                            "content": illustrationHeaderText
                        }
                    )
                } else {
                    const illustrationBodyText = illustrationHeaderOrContent.innerText.trim()
                    // console.log(illustrationBodyText)
                    content.push(
                        {
                            "type": "illustrationBody",
                            "ID": null,
                            "content": illustrationBodyText
                        }
                    )
                }
            } else {}

            const sectionBody = row.querySelector("td[class^='prov'][class$='Txt']")
            if (sectionBody) {
                const sectionBodyText = sectionBody.innerText.trim()
                // console.log(sectionBodyText)
                content.push(
                    {
                        "type": "sectionBody",
                        "ID": null,
                        "content": sectionBodyText
                    }
                )
            } else {}

            const provisionHeader = row.querySelector("td.partHdr")
            if (provisionHeader) {
                const provisionHeaderID = provisionHeader.id
                const provisionHeaderText = provisionHeader.innerText.trim()
                // console.log(provisionHeaderID, provisionHeaderText)
                content.push(
                    {
                        "type": "provisionHeader",
                        "ID": provisionHeaderID,
                        "content": provisionHeaderText
                    }
                )
            } else {}

            const provisionNumber = row.querySelector("td.part")
            if (provisionNumber) {
                const provisionNumberID = provisionNumber.id
                const provisionNumberText = provisionNumber.querySelector("div.partNo").innerText.trim()
                // console.log(provisionNumberID, provisionNumberText)
                content.push(
                    {
                        "type": "provisionNumber",
                        "ID": provisionNumberID,
                        "content": provisionNumberText
                    }
                )
            } else {}

        });
    });

    return content
}

// ~~~~~ CREATE ELEMENTS ~~~~~

function createGenericButton() {
    /*
    creates and appends a html button 
    component that then prints an alert 
    to the screen when clicked
    */
    const button = document.createElement("button");
    button.innerText = "poke me 🫵";
    button.style.position = "fixed"; 
    button.style.top = "10px";
    button.style.right = "10px";
    button.style.zIndex = "1000"; 
    button.style.padding = "10px"; 
    button.style.backgroundColor = "#4CAF50"; 
    button.style.color = "white"; 
    button.style.border = "none"; 
    button.style.borderRadius = "5px"; 
    button.style.cursor = "pointer"; 
    button.addEventListener("click", () => {
        alert("Ouch! 🤕");
    });
    document.body.appendChild(button);
    return None
}

function createTableOfContents(pageBasicData) {

    /*
    dynamically generates a clickable table 
    of contents based on the tableOfContents 
    scraped from the getPageBasicData() function
    */

    const legislationTitle = pageBasicData.legislationTitle;
    const tableOfContentsArray = pageBasicData.tableOfContents;
    var tableOfContentsString = "";
    const tableOfContentsStyle = `
    <style>
        .toc-container {
            width: 300px;
            background: white;
            border-radius: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .toc-header {
            background: #1a1b26;
            color: white;
            padding: 20px 24px;
            font-size: 18px;
            font-weight: 500;
            border-radius: 24px 24px 0 0;
            position: relative;
        }

        .toc-header::after {
            content: '';
            position: absolute;
            bottom: -24px;
            left: 0;
            right: 0;
            height: 24px;
            background: #1a1b26;
            border-radius: 0 0 24px 24px;
        }

        .toc-content {
            padding: 40px 24px 24px;
        }

        .toc-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .toc-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }

        .toc-item a {
            display: flex; 
            align-items: center; 
            padding: 8px 16px;
            color: #1a1b26;
            font-size: 14px;
            border-radius: 12px;
            cursor: pointer; 
            transition: background-color 0.2s, color 0.2s;
            text-decoration: none; 
        }

        .toc-item::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #ff4b6e;
            border-radius: 50%;
            margin-right: 12px;
            flex-shrink: 0;
        }

        .toc-item a.active {
            background: #ff4b6e;
            color: white;
        }

        .toc-item a.active::before {
            background: white;
        }

        .toc-item a:hover {
            background: #ff4b6e;
            color: white;
        }

        .toc-item a:hover::before {
            background: white;
        }

        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #e9e4ff 0%, #f3e7ff 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 16px;
        }
    </style>
    `;

    const tableOfContentsHeader = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
    `;

    const tableOfContentsBody = `
    </head>
    <body>
        <div class="toc-container">
            <div class="toc-header">
                ${legislationTitle} 📜
            </div>
            <div class="toc-content">
                <ul class="toc-list">
    `;

    const tableOfContentsFooter = `
                </ul>
            </div>
        </div>
    </body>
    </html>
    `;

    // console.log(tableOfContentsArray);
    tableOfContentsArray.forEach(element => {
        const text = element.referenceText
        const match = text.match(/^(\d+)/); 
        const formattedReferenceText = match ? `<span class='toc-sectionNo'>${match[0]}.</span> ${text.slice(match[0].length)}` : text;
        tableOfContentsString += `<li class='toc-item'><a href='${element.referenceUrl}' target='_blank'>${formattedReferenceText} ${randomEmoji()}</a></li>\n`;
    });

    return tableOfContentsString;
    // return `${tableOfContentsHeader}${tableOfContentsStyle}${tableOfContentsBody}${tableOfContentsString}${tableOfContentsFooter}`
}

function integrateDefinition(legislationContent, legislationDefinitions) {
    /*
    sort definitions by length, then embeds them 
    within the statute whilst avoiding recursive 
    definitions
    */
    legislationDefinitions.sort((a, b) => {
        const termA = Object.keys(a)[0];
        const termB = Object.keys(b)[0];
        return termB.length - termA.length; 
    });
    legislationContent.forEach(token => {
        if (token.type === "sectionBody") {
            let sectionContent = token.content.split('\n');
            sectionContent = sectionContent.map(line => {
                let modifiedLine = line;
                modifiedLine = modifiedLine.replace(/"/g, '&quot;');
                for (const definitionPair of legislationDefinitions) {
                    for (const [term, definition] of Object.entries(definitionPair)) {
                        const escapedTerm = term.replace(/"/g, '\\"');
                        const regex = new RegExp(`\\b(${escapedTerm})\\b`, 'g'); 
                        modifiedLine = modifiedLine.replace(regex, (match) => {
                            const safeDefinition = definition.replace(/"/g, '&quot;');
                            return `
                                <span class='statuteTerm-container' title='${safeDefinition}'>
                                    ${match}
                                    <span class='statuteDefinition-content'>
                                        ${safeDefinition}
                                    </span>
                                </span>`;
                        });
                    }
                }
                return modifiedLine; 
            });
            token.content = sectionContent.join('<br>');
        }
    });
}

function createContentBody(legislationContent, legislationDefinitions) {

    /*
    dynamically generates HTML based on the extracted
    legislation content, embedding definitions for words 
    that have been defined in the same statute
    */

    const contentBodyHeader = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
    `;

    const contentBodyStyle = `
        <style>
            .tab-indent {
                padding-left: 2em; 
            }

            .statuteTerm-container {
                font-weight: bold; 
                cursor: pointer; 
            }
            .statuteDefinition-content {
                display: none; 
                background: #f9f9f9; 
                border: 1px solid #ccc; 
                padding: 5px;
                position: absolute; 
                z-index: 1000; 
            }
        </style>
    </head>
    <body>
    ` // FUA add further styling here later

    const contentBodyFooter = `
    </body>
    </html>
    ` // FUA add content here later

    let contentBodyMain = ""

    integrateDefinition(legislationContent, legislationDefinitions)

    for (const contentToken of legislationContent) {

        switch (contentToken.type) {

            case "sectionHeader":
                contentBodyMain += `<h2>${contentToken.content}</h2>`
                break;

            case "sectionBody":
                for (line of contentToken.content.split("<br>")) {
                    if (needsIndentation(line)) {
                        contentBodyMain += `<span class="tab-indent">${line}<br></span>`;
                    } else {
                        contentBodyMain += `${line}<br>`
                    }
                }
                // contentBodyMain += `${contentToken.content}` 
                break;

            case "provisionHeader":
                // FUA do nothing for now
                break;

            case "provisionNumber":
                // FUA do nothing for now
                break;

            case "illustrationHeader":
                // FUA do nothing for now
                break;

            case "illustrationBody":
                // FUA do nothing for now
                break;

            default:
                console.log(`Unknown edgecase hit: ${contentToken}`)
                break;

        }
    }

    return contentBodyMain;
    // return `${contentBodyHeader}${contentBodyStyle}${contentBodyMain}${contentBodyFooter}`;
}

function createOverallHTMLContent(pageBasicData, legislationContent, legislationDefinitions) {
    return {
        "title": `Skill Hunter: ${pageBasicData.legislationTitle}</title>`,
        "style": `
            body {
                display: flex;
                margin: 0;
                background: linear-gradient(135deg, #e9e4ff 0%, #f3e7ff 100%);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                min-height: 100vh;
                transition: padding-left 0.3s ease; 
            }

            .toc-container {
                width: 300px;
                background: white;
                border-radius: 24px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                transition: transform 0.3s ease;
                position: relative;
            }

            .toc-header {
                background: #1a1b26;
                color: white;
                padding: 20px 24px;
                font-size: 18px;
                font-weight: 500;
                border-radius: 24px 24px 0 0;
                position: relative;
            }

            .toc-header::after {
                content: '';
                position: absolute;
                bottom: -24px;
                left: 0;
                right: 0;
                height: 24px;
                background: #1a1b26;
                border-radius: 0 0 24px 24px;
            }

            .toc-content {
                padding: 0 24px; 
                height: calc(100vh - 80px); 
                overflow-y: auto; 
            }

            .toc-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .toc-item a {
                display: flex; 
                align-items: center; 
                padding: 8px 16px;
                color: #1a1b26;
                font-size: 14px;
                border-radius: 12px;
                cursor: pointer; 
                transition: background-color 0.2s, color 0.2s;
                text-decoration: none; 
            }

            .toc-item::before {
                content: '';
                width: 8px;
                height: 8px;
                background: #ff4b6e;
                border-radius: 50%;
                margin-right: 12px;
                flex-shrink: 0;
            }

            .toc-item a.active {
                background: #ff4b6e;
                color: white;
            }

            .toc-item a.active::before {
                background: white;
            }

            .toc-item a:hover {
                background: #ff4b6e;
                color: white;
            }

            .toc-item a:hover::before {
                background: white;
            }

            .toc-sectionNo {
                font-size: 16px;
                font-weight: bold;
                margin-right: 8px;
            }

            .main-content {
                flex: 1;
                padding: 20px;
                height: calc(100vh - 40px); 
                overflow-y: auto; 
                transition: margin-left 0.3s ease; 
                margin-left: 0; 
            }

            .toggle-toc {
                position: absolute;
                top: 20px;
                left: 320px; 
                background: #ff4b6e;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                transition: background-color 0.2s;
                z-index: 1; 
            }

            .toggle-toc:hover {
                background: #e43e5c;
            }

            .tab-indent {
                padding-left: 2em; 
            }

            .statuteTerm-container {
                font-weight: bold; 
                cursor: pointer; 
                color: #ff4b6e; 
            }

            .statuteDefinition-content {
                display: none; 
                background-color: #333; 
                color: #fff; 
                border: 1px solid #ff4b6e; 
                padding: 10px;
                position: absolute; 
                z-index: 1000; 
                transform: translateX(-50%);
                opacity: 0; 
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
                white-space: pre-wrap; 
                width: auto; 
                overflow-y: auto;
                max-width: 850px;
                min-width: 500px; 
                max-height: 500px; 
                border-radius: 5px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                top: 100%; 
                left: 50%; 
            }

            .statuteTerm-container:hover {
                color: #e43e5c; 
            }

            .statuteTerm-container:hover .statuteDefinition-content {
                background: rgba(255, 255, 255, 0.95); 
                display: block; 
                opacity: 1;
                visibility: visible; 
            }
        `,
        "content": `
    <button class="toggle-toc">Toggle TOC</button>
    <div class="toc-container" id="toc">
        <div class="toc-header">
            ${pageBasicData.legislationTitle} 📜
        </div>
        <div class="toc-content">
            <ul class="toc-list">
                ${createTableOfContents(pageBasicData)}
            </ul>
        </div>
    </div>
    <div class="main-content" id="mainContent">
        <h1>
            ${pageBasicData.legislationTitle} 📜
        </h1>
        ${createContentBody(legislationContent, legislationDefinitions)}
    </div>
        <script>
            const toggleButton = document.querySelector('.toggle-toc');
            const tocContainer = document.getElementById('toc');
            const mainContent = document.getElementById('mainContent');
            toggleButton.addEventListener('click', () => {
                if (tocContainer.style.transform === 'translateX(-100%)') {
                    tocContainer.style.transform = 'translateX(0)';
                    mainContent.style.marginLeft = '320px'; 
                    toggleButton.style.left = '320px'; 
                } else {
                    tocContainer.style.transform = 'translateX(-100%)';
                    mainContent.style.marginLeft = '0'; 
                    toggleButton.style.left = '20px'; 
                }
            });
        </script>
        `
    };
}

function revertPage(backupTitle, backupStyle, backupContent) {
    /*
    revert the content of the webpage based on
    specified data
    */
    document.title = backupTitle || "",
    document.querySelector("style").innerHTML = backupStyle;
    document.body.innerHTML = backupContent || "";
}

function simplifyPage(overallHTMLContent) {
    /*
    simplifies the content of the webpage based on
    specified data
    */

    // ~ saving old values ~

    const backupTitle = document.title;
    const backupContent = document.body.innerHTML;
    let backupStyle = null;

    // ~ replacing new values ~

    const newTitle = overallHTMLContent.title
    const newStyle = overallHTMLContent.style
    const newContent = overallHTMLContent.content

    document.title = newTitle

    const styleEl = document.querySelector("style");
    if (styleEl) {
        backupStyle = styleEl.innerHTML;
        styleEl.innerHTML = newStyle;
    } else {
        var newStyleEl = document.createElement("style");
        newStyleEl.innerHTML = newStyle;
        document.head.appendChild(newStyleEl);
    }

    document.body.innerHTML = newContent;

    return {
        "title": backupTitle,
        "style": backupStyle,
        "content": backupContent,
    }
}

// ~~~~~ UNIVERSAL EXECUTED CODE ~~~~~

let simplifedState = false;
const generalPageBasicData = getPageBasicData()
const pageBasicData = generalPageBasicData.pageBasicData
const pageMetaData = generalPageBasicData.pageMetadata

const tableOfContentsHTMLString = createTableOfContents(pageBasicData)
console.log(tableOfContentsHTMLString)

if (window.location.href.endsWith("?WholeDoc=1")) {
    console.log("navigating to bottom of page...")
    window.location.href = pageBasicData.tableOfContents[pageBasicData.tableOfContents.length - 1].referenceUrl // resolves the issue of the page not loading
} else {}

// ~~~~~ BROWSER RUNTIME LISTENERS ~~~~~

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // alert("skill hunter launching...");
    console.log("something clicked...")
    if (request.action === "simplify") { 

        console.log("simplify button clicked...");

        const legislationContent = getLegislationContent();
        const legislationDefinitions = getLegislationDefinitions();
        // console.log(deserialiseJSON(legislationDefinitions));
        // console.log(deserialiseJSON(legislationContent));

        // const contentBodyHTMLString = createContentBody(legislationContent, legislationDefinitions)
        // console.log(contentBodyHTMLString)

        const overallHTMLContent = createOverallHTMLContent(pageBasicData, legislationContent, legislationDefinitions);
        console.log(deserialiseJSON(overallHTMLContent));

        if (request.toggle) {
            console.log("toggling page...");
            if (simplifedState) {
                console.log("reverting page...");
                revertPage(backupTitle, backupStyle, backupContent);
                simplifedState = false;
            } else {
                console.log("simplifying page...")
                backupHTMLContentMap = simplifyPage(overallHTMLContent);
                backupTitle = backupHTMLContentMap.title;
                backupStyle = backupHTMLContentMap.style;
                backupContent = backupHTMLContentMap.content;
                simplifedState = true;
            }
        } else {}

        sendResponse({ status: "success" });

    } else if (request.action === "settings") { 
        console.log("settings button clicked...");
        sendResponse({ status: "success" });

    } else if (request.action === "cancel") { 
        console.log("cancel button clicked...");
        sendResponse({ status: "success" });

    } else {
        console.log("unknown edgecase hit");
    } 
});
