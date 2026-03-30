// ---------- MENU ----------

function onOpen() {
  SlidesApp.getUi().createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Highlight Tags', 'highlightTags')
    .addItem('Credits', 'showCredits')
    .addToUi();
}
function showCredits() {
  SlidesApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Credits').setWidth(200).setHeight(150), 'Credits');
}
function showTagsSidebar() {
  SlidesApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('OwlSidebar').setWidth(300).setHeight(400).setTitle('Slides Owl'));
}

// ---------- SCAN ----------

function getTaggedLines() {
  var slides = SlidesApp.getActivePresentation().getSlides();
  var prefixes = getAllPrefixes();
  var tags = {};
  for (var s = 0; s < slides.length; s++) {
    var shapes = slides[s].getShapes();
    for (var sh = 0; sh < shapes.length; sh++) {
      if (shapes[sh].getText()) {
        var lines = shapes[sh].getText().asString().split('\n');
        for (var l = 0; l < lines.length; l++) {
          var trimmed = lines[l].trim();
          for (var p = 0; p < prefixes.length; p++) {
            if (trimmed.toUpperCase().startsWith(prefixes[p])) {
              var content = trimmed.slice(prefixes[p].length).trim();
              if (content.length > 0) {
                if (!tags[prefixes[p]]) tags[prefixes[p]] = [];
                tags[prefixes[p]].push({ text: content, slideIndex: s, shapeId: shapes[sh].getObjectId() });
              }
            }
          }
        }
      }
    }
  }
  return buildScanResult(prefixes, tags);
}

// ---------- INLINE HIGHLIGHTING ----------

function highlightTags() {
  var slides = SlidesApp.getActivePresentation().getSlides();
  var prefixes = getAllPrefixes();
  var colorscheme = CONFIG.COLORSCHEMES[getActiveColorscheme()];
  for (var s = 0; s < slides.length; s++) {
    var shapes = slides[s].getShapes();
    for (var sh = 0; sh < shapes.length; sh++) {
      if (shapes[sh].getText()) {
        var textRange = shapes[sh].getText();
        var fullText = textRange.asString();
        for (var p = 0; p < prefixes.length; p++) {
          var idx = fullText.toUpperCase().indexOf(prefixes[p]);
          while (idx >= 0) {
            textRange.getRange(idx, idx + prefixes[p].length).getTextStyle()
              .setForegroundColor(getColorForPrefix(prefixes[p], colorscheme));
            idx = fullText.toUpperCase().indexOf(prefixes[p], idx + prefixes[p].length);
          }
        }
      }
    }
  }
}

// ---------- BATCH OPERATIONS ----------

function markTagDone(slideIndex, shapeId, prefix) {
  var slides = SlidesApp.getActivePresentation().getSlides();
  if (slideIndex >= 0 && slideIndex < slides.length) {
    var shapes = slides[slideIndex].getShapes();
    for (var i = 0; i < shapes.length; i++) {
      if (shapes[i].getObjectId() === shapeId) {
        var tr = shapes[i].getText();
        tr.setText(tr.asString().replace(new RegExp(prefix, 'i'), 'DONE'));
        break;
      }
    }
  }
}
function archiveTags(entries) {
  for (var i = 0; i < entries.length; i++) {
    markTagDone(entries[i].slideIndex, entries[i].shapeId, entries[i].prefix);
  }
}
