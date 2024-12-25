function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Tobimune')
    .addItem('Show Tags', 'showTagsSidebar')
    .addToUi();
}

function showTagsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('TagsSidebar')
    .setWidth(300)
    .setHeight(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getTaggedCells() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();

  const prefixes = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'];
  const colors = {
    'TODO': '#FFDDC1', // Light Orange
    'FIXME': '#FFABAB', // Light Red
    'TEMP': '#FFC3A0', // Light Peach
    'REF': '#A0D3E8', // Light Blue
    'REV': '#D5AAFF' // Light Purple
  };

  const tags = {};
  for (let row of values) {
    for (let cell of row) {
      Logger.log(`Checking cell: '${cell}'`);
      if (typeof cell === 'string') {
        const trimmedCell = cell.trim();
        for (let prefix of prefixes) {
          if (trimmedCell.toUpperCase().startsWith(prefix)) {
            if (!tags[prefix]) {
              tags[prefix] = [];
            }
            tags[prefix].push(trimmedCell);
            Logger.log(`Found tag: ${prefix} in cell: '${trimmedCell}'`);
          }
        }
      }
    }
  }
  Logger.log(tags);
  return { tags, colors };
}
