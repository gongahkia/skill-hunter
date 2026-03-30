// ---------- MENU ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Highlight Tags', 'highlightTags')
    .addItem('Credits', 'showCredits')
    .addToUi();
}
function showCredits() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Credits').setWidth(200).setHeight(150), 'Credits');
}
function showTagsSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('OwlSidebar').setWidth(300).setHeight(400).setTitle('Sheets Owl'));
}

// ---------- SCAN ----------

function getTaggedCells() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var values = sheet.getDataRange().getValues();
  var prefixes = getAllPrefixes();
  var tags = {};
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var cell = values[r][c];
      if (typeof cell === 'string') {
        var trimmed = cell.trim();
        for (var p = 0; p < prefixes.length; p++) {
          if (trimmed.toUpperCase().startsWith(prefixes[p])) {
            var text = trimmed.slice(prefixes[p].length).trim();
            if (text.length > 0) {
              if (!tags[prefixes[p]]) tags[prefixes[p]] = [];
              tags[prefixes[p]].push({ text: text, row: r + 1, col: c + 1 });
            }
          }
        }
      }
    }
  }
  return buildScanResult(prefixes, tags);
}

// ---------- NAVIGATION ----------

function navigateToCell(row, col) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.setActiveRange(sheet.getRange(row, col));
}

// ---------- INLINE HIGHLIGHTING ----------

function highlightTags() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var values = sheet.getDataRange().getValues();
  var prefixes = getAllPrefixes();
  var colorscheme = CONFIG.COLORSCHEMES[getActiveColorscheme()];
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (typeof values[r][c] === 'string') {
        var trimmed = values[r][c].trim();
        for (var p = 0; p < prefixes.length; p++) {
          if (trimmed.toUpperCase().startsWith(prefixes[p])) {
            sheet.getRange(r + 1, c + 1).setFontColor(getColorForPrefix(prefixes[p], colorscheme));
            break;
          }
        }
      }
    }
  }
}

// ---------- BATCH OPERATIONS ----------

function markTagDone(row, col, prefix) {
  var cell = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(row, col);
  var text = cell.getValue();
  if (typeof text === 'string') cell.setValue(text.replace(new RegExp(prefix, 'i'), 'DONE'));
}
function archiveTags(entries) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var archive = ss.getSheetByName('Owl Archive');
  if (!archive) { archive = ss.insertSheet('Owl Archive'); archive.appendRow(['Prefix', 'Text', 'Archived']); }
  var sheet = ss.getActiveSheet();
  for (var i = 0; i < entries.length; i++) {
    archive.appendRow([entries[i].prefix, entries[i].text, new Date().toISOString()]);
    sheet.getRange(entries[i].row, entries[i].col).clearContent();
  }
}
