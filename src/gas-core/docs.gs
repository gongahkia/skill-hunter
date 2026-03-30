// ---------- MENU ----------

function onOpen() {
  DocumentApp.getUi().createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Highlight Tags', 'highlightTags')
    .addItem('Credits', 'showCredits')
    .addToUi();
}
function showCredits() {
  DocumentApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Credits').setWidth(200).setHeight(150), 'Credits');
}
function showTagsSidebar() {
  DocumentApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('OwlSidebar').setWidth(300).setHeight(400).setTitle('Docs Owl'));
}

// ---------- SCAN ----------

function getTaggedLines() {
  var paragraphs = DocumentApp.getActiveDocument().getBody().getParagraphs();
  var prefixes = getAllPrefixes();
  var tags = {};
  for (var i = 0; i < paragraphs.length; i++) {
    var text = paragraphs[i].getText().trim();
    for (var p = 0; p < prefixes.length; p++) {
      if (text.toUpperCase().startsWith(prefixes[p])) {
        var content = text.slice(prefixes[p].length).trim();
        if (content.length > 0) {
          if (!tags[prefixes[p]]) tags[prefixes[p]] = [];
          tags[prefixes[p]].push({ text: content, paragraphIndex: i });
        }
      }
    }
  }
  return buildScanResult(prefixes, tags);
}

// ---------- NAVIGATION ----------

function navigateToParagraph(idx) {
  var doc = DocumentApp.getActiveDocument();
  var paras = doc.getBody().getParagraphs();
  if (idx >= 0 && idx < paras.length) doc.setCursor(doc.newPosition(paras[idx], 0));
}

// ---------- INLINE HIGHLIGHTING ----------

function highlightTags() {
  var body = DocumentApp.getActiveDocument().getBody();
  var prefixes = getAllPrefixes();
  var colorscheme = CONFIG.COLORSCHEMES[getActiveColorscheme()];
  for (var p = 0; p < prefixes.length; p++) {
    var found = body.findText(prefixes[p]);
    while (found) {
      var elem = found.getElement();
      var start = found.getStartOffset();
      elem.asText().setForegroundColor(start, start + prefixes[p].length - 1, getColorForPrefix(prefixes[p], colorscheme));
      found = body.findText(prefixes[p], found);
    }
  }
}

// ---------- BATCH OPERATIONS ----------

function markTagDone(paragraphIndex, prefix) {
  var paras = DocumentApp.getActiveDocument().getBody().getParagraphs();
  if (paragraphIndex >= 0 && paragraphIndex < paras.length) {
    paras[paragraphIndex].setText(paras[paragraphIndex].getText().replace(new RegExp(prefix, 'i'), 'DONE'));
  }
}
function archiveTags(entries) {
  var body = DocumentApp.getActiveDocument().getBody();
  body.appendParagraph('--- Owl Archive ---');
  for (var i = 0; i < entries.length; i++) {
    body.appendParagraph('DONE ' + entries[i].prefix + ': ' + entries[i].text);
  }
  var paras = body.getParagraphs();
  var indices = entries.map(function(e) { return e.paragraphIndex; }).sort(function(a, b) { return b - a; });
  for (var j = 0; j < indices.length; j++) {
    if (indices[j] >= 0 && indices[j] < paras.length) body.removeChild(paras[indices[j]]);
  }
}
