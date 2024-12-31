function onOpen() {
  const ui = DocumentApp.getUi();
  ui.createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Credits', 'showCredits')
    .addToUi();
}

function showCredits() {
  const html = HtmlService.createHtmlOutputFromFile('Credits')
      .setWidth(200)
      .setHeight(150);
  DocumentApp.getUi().showModalDialog(html, 'Credits 🙇🏻');
}

function showTagsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('OwlSidebar')
    .setWidth(300)
    .setHeight(400);
  DocumentApp.getUi().showSidebar(html.setTitle('Docs Owl 🦉'));
}

function getTaggedLines() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const text = body.getText();
  const lines = text.split('\n');
  const prefixes = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'];
  colorschemeGruvbox = {
    "BACKGROUND": "#282828",
    "TODO": "#FABD2F",
    "FIXME": "#FB4934",
    "TEMP": "#8EC07C",
    "REF": "#83A598",
    "REV": "#D3869B",
  }
  colorschemeEverforest = {
    "BACKGROUND": "#2b3339",
    "TODO": "#d8a657",
    "FIXME": "#e67e80",
    "TEMP": "#a7c080",
    "REF": "#7fbbb3",
    "REV": "#d699b6",
  }
  colorschemeTokyoNight = {
    "BACKGROUND": "#1a1b26",
    "TODO": "#e0af68",
    "FIXME": "#f7768e",
    "TEMP": "#9ece6a",
    "REF": "#7aa2f7",
    "REV": "#bb9af7",
  }
  colorschemeAtomDark = {
    "BACKGROUND": "#282c34",
    "TODO": "#e5c07b",
    "FIXME": "#e06c75",
    "TEMP": "#98c379",
    "REF": "#61afef",
    "REV": "#c678dd",
  }
  colorschemeMonokai = {
    "BACKGROUND": "#272822",
    "TODO": "#f4bf75",
    "FIXME": "#f92672",
    "TEMP": "#a6e22e",
    "REF": "#66d9ef",
    "REV": "#ae81ff",
  }
  colorschemeGithub = {
    "BACKGROUND": "#ffffff",
    "TODO": "#6f42c1",
    "FIXME": "#d73a49",
    "TEMP": "#28a745",
    "REF": "#0366d6",
    "REV": "#005cc5",
  }
  colorschemeAyu = {
    "BACKGROUND": "#0f1419",
    "TODO": "#ff9940",
    "FIXME": "#f07178",
    "TEMP": "#aad94c",
    "REF": "#39bae6",
    "REV": "#c296eb",
  }
  colorschemeDracula = {
    "BACKGROUND": "#282a36",
    "TODO": "#f1fa8c",
    "FIXME": "#ff5555",
    "TEMP": "#50fa7b",
    "REF": "#8be9fd",
    "REV": "#bd93f9",
  }
  colorschemeRosePine = {
    "BACKGROUND": "#191724",
    "TODO": "#f6c177",
    "FIXME": "#eb6f92",
    "TEMP": "#9ccfd8",
    "REF": "#31748f",
    "REV": "#c4a7e7",
  }
  colorschemeSpacemacs = {
    "BACKGROUND": "#1f2022",
    "TODO": "#dcaeea",
    "FIXME": "#fc5c94",
    "TEMP": "#86dc2f",
    "REF": "#36c6d3",
    "REV": "#a9a1e1",
  }
  const tags = {};
  for (let line of lines) {
    Logger.log(`Checking line: '${line}'`);
    const trimmedLine = line.trim();
    for (let prefix of prefixes) {
      if (trimmedLine.toUpperCase().startsWith(prefix)) {
        if (!tags[prefix]) {
          tags[prefix] = [];
        }
        const sanitisedLine = trimmedLine.slice(prefix.length).trim();
        if (sanitisedLine.length > 0) {
          tags[prefix].push(sanitisedLine);
        }
        Logger.log(`Found tag: ${prefix} in line: '${trimmedLine}'`);
      }
    }
  }
  Logger.log(tags);
  return { prefixes, tags, colorschemeGruvbox };
}