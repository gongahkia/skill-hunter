const DEBUG_MODE = false;
function debugLog(message) { if (DEBUG_MODE) Logger.log(message); }

const CONFIG = {
  PREFIXES: ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'],
  PRIORITY: { FIXME: 1, TODO: 2, REV: 3, TEMP: 4, REF: 5 },
  FALLBACK_COLORS: ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bff6b', '#6bd9ff', '#b06bff', '#ff6bb0', '#c8c8c8'],
  COLORSCHEMES: {
    gruvbox: { BACKGROUND: '#282828', TODO: '#FABD2F', FIXME: '#FB4934', TEMP: '#8EC07C', REF: '#83A598', REV: '#D3869B' },
    everforest: { BACKGROUND: '#2b3339', TODO: '#d8a657', FIXME: '#e67e80', TEMP: '#a7c080', REF: '#7fbbb3', REV: '#d699b6' },
    tokyoNight: { BACKGROUND: '#1a1b26', TODO: '#e0af68', FIXME: '#f7768e', TEMP: '#9ece6a', REF: '#7aa2f7', REV: '#bb9af7' },
    atomDark: { BACKGROUND: '#282c34', TODO: '#e5c07b', FIXME: '#e06c75', TEMP: '#98c379', REF: '#61afef', REV: '#c678dd' },
    monokai: { BACKGROUND: '#272822', TODO: '#f4bf75', FIXME: '#f92672', TEMP: '#a6e22e', REF: '#66d9ef', REV: '#ae81ff' },
    github: { BACKGROUND: '#ffffff', TODO: '#6f42c1', FIXME: '#d73a49', TEMP: '#28a745', REF: '#0366d6', REV: '#005cc5' },
    ayu: { BACKGROUND: '#0f1419', TODO: '#ff9940', FIXME: '#f07178', TEMP: '#aad94c', REF: '#39bae6', REV: '#c296eb' },
    dracula: { BACKGROUND: '#282a36', TODO: '#f1fa8c', FIXME: '#ff5555', TEMP: '#50fa7b', REF: '#8be9fd', REV: '#bd93f9' },
    rosePine: { BACKGROUND: '#191724', TODO: '#f6c177', FIXME: '#eb6f92', TEMP: '#9ccfd8', REF: '#31748f', REV: '#c4a7e7' },
    spacemacs: { BACKGROUND: '#1f2022', TODO: '#dcaeea', FIXME: '#fc5c94', TEMP: '#86dc2f', REF: '#36c6d3', REV: '#a9a1e1' },
  },
  ACTIVE_COLORSCHEME: 'gruvbox',
};

// ---------- PERSISTENCE ----------

function getActiveColorscheme() {
  return PropertiesService.getUserProperties().getProperty('owl_colorscheme') || CONFIG.ACTIVE_COLORSCHEME;
}
function setActiveColorscheme(name) {
  if (CONFIG.COLORSCHEMES[name]) PropertiesService.getUserProperties().setProperty('owl_colorscheme', name);
}
function getDarkMode() {
  var val = PropertiesService.getUserProperties().getProperty('owl_darkmode');
  return val === null ? true : val === 'true';
}
function setDarkMode(enabled) {
  PropertiesService.getUserProperties().setProperty('owl_darkmode', String(enabled));
}
function getCustomPrefixes() {
  var val = PropertiesService.getUserProperties().getProperty('owl_custom_prefixes');
  return val ? JSON.parse(val) : [];
}
function setCustomPrefixes(arr) {
  PropertiesService.getUserProperties().setProperty('owl_custom_prefixes', JSON.stringify(arr));
}

// ---------- HELPERS ----------

function getAllPrefixes() { return CONFIG.PREFIXES.concat(getCustomPrefixes()); }
function getColorForPrefix(prefix, colorscheme) {
  if (colorscheme[prefix]) return colorscheme[prefix];
  var custom = getCustomPrefixes();
  var idx = custom.indexOf(prefix);
  return idx >= 0 ? CONFIG.FALLBACK_COLORS[idx % CONFIG.FALLBACK_COLORS.length] : '#ffffff';
}
function getPriority(prefix) { return CONFIG.PRIORITY[prefix] || 99; }
function buildScanResult(prefixes, tags) {
  var scheme = getActiveColorscheme();
  var colorscheme = CONFIG.COLORSCHEMES[scheme];
  var colors = {};
  for (var i = 0; i < prefixes.length; i++) colors[prefixes[i]] = getColorForPrefix(prefixes[i], colorscheme);
  colors['BACKGROUND'] = colorscheme['BACKGROUND'];
  return {
    prefixes: prefixes, tags: tags, colorscheme: colors,
    availableSchemes: Object.keys(CONFIG.COLORSCHEMES), activeScheme: scheme,
    priority: CONFIG.PRIORITY, darkMode: getDarkMode(),
  };
}

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
