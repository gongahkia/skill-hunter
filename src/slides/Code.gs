const DEBUG_MODE = false;

/**
 * Conditionally logs a message based on DEBUG_MODE setting.
 * @param {string} message - The message to log
 */
function debugLog(message) {
  if (DEBUG_MODE) {
    Logger.log(message);
  }
}

/**
 * Centralized configuration for Owl extension.
 * Contains supported tag prefixes and all available colorschemes.
 */
const CONFIG = {
  PREFIXES: ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'],

  COLORSCHEMES: {
    gruvbox: {
      BACKGROUND: '#282828',
      TODO: '#FABD2F',
      FIXME: '#FB4934',
      TEMP: '#8EC07C',
      REF: '#83A598',
      REV: '#D3869B',
    },
    everforest: {
      BACKGROUND: '#2b3339',
      TODO: '#d8a657',
      FIXME: '#e67e80',
      TEMP: '#a7c080',
      REF: '#7fbbb3',
      REV: '#d699b6',
    },
    tokyoNight: {
      BACKGROUND: '#1a1b26',
      TODO: '#e0af68',
      FIXME: '#f7768e',
      TEMP: '#9ece6a',
      REF: '#7aa2f7',
      REV: '#bb9af7',
    },
    atomDark: {
      BACKGROUND: '#282c34',
      TODO: '#e5c07b',
      FIXME: '#e06c75',
      TEMP: '#98c379',
      REF: '#61afef',
      REV: '#c678dd',
    },
    monokai: {
      BACKGROUND: '#272822',
      TODO: '#f4bf75',
      FIXME: '#f92672',
      TEMP: '#a6e22e',
      REF: '#66d9ef',
      REV: '#ae81ff',
    },
    github: {
      BACKGROUND: '#ffffff',
      TODO: '#6f42c1',
      FIXME: '#d73a49',
      TEMP: '#28a745',
      REF: '#0366d6',
      REV: '#005cc5',
    },
    ayu: {
      BACKGROUND: '#0f1419',
      TODO: '#ff9940',
      FIXME: '#f07178',
      TEMP: '#aad94c',
      REF: '#39bae6',
      REV: '#c296eb',
    },
    dracula: {
      BACKGROUND: '#282a36',
      TODO: '#f1fa8c',
      FIXME: '#ff5555',
      TEMP: '#50fa7b',
      REF: '#8be9fd',
      REV: '#bd93f9',
    },
    rosePine: {
      BACKGROUND: '#191724',
      TODO: '#f6c177',
      FIXME: '#eb6f92',
      TEMP: '#9ccfd8',
      REF: '#31748f',
      REV: '#c4a7e7',
    },
    spacemacs: {
      BACKGROUND: '#1f2022',
      TODO: '#dcaeea',
      FIXME: '#fc5c94',
      TEMP: '#86dc2f',
      REF: '#36c6d3',
      REV: '#a9a1e1',
    },
  },

  // Active colorscheme (change this to switch themes)
  ACTIVE_COLORSCHEME: 'gruvbox',
};

/**
 * Creates the Owl menu when the presentation is opened.
 * Adds "Get Tags" and "Credits" menu items to the presentation UI.
 */
function onOpen() {
  const ui = SlidesApp.getUi();
  ui.createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Credits', 'showCredits')
    .addToUi();
}

/**
 * Displays the credits modal dialog.
 * Shows attribution information in a 200x150px modal.
 */
function showCredits() {
  const html = HtmlService.createHtmlOutputFromFile('Credits')
      .setWidth(200)
      .setHeight(150);
  SlidesApp.getUi().showModalDialog(html, 'Credits');
}

/**
 * Displays the Owl sidebar containing tagged lines.
 * Creates a 300x400px sidebar that shows all detected tags in the presentation.
 */
function showTagsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('OwlSidebar')
    .setWidth(300)
    .setHeight(400);
  SlidesApp.getUi().showSidebar(html.setTitle('Slides Owl'));
}

/**
 * Scans the active Google Slides presentation for tagged lines.
 * Searches through all shapes in all slides for text starting with predefined
 * tag prefixes (TODO, FIXME, TEMP, REF, REV) and organizes them by tag type.
 *
 * @returns {Object} Object containing:
 *   - prefixes: Array of supported tag prefixes
 *   - tags: Object mapping prefixes to arrays of tagged content
 *   - colorschemeGruvbox: Active colorscheme configuration
 */
function getTaggedLines() {
  const presentation = SlidesApp.getActivePresentation();
  const slides = presentation.getSlides();
  const prefixes = CONFIG.PREFIXES;
  const colorscheme = CONFIG.COLORSCHEMES[CONFIG.ACTIVE_COLORSCHEME];
  const tags = {};
  for (const slide of slides) {
    const shapes = slide.getShapes();
    for (const shape of shapes) {
      if (shape.getText()) {
        const textContent = shape.getText().asString();
        const lines = textContent.split('\n');
        for (let line of lines) {
          debugLog(`Checking line: '${line}'`);
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
              debugLog(`Found tag: ${prefix} in line: '${trimmedLine}'`);
            }
          }
        }
      }
    }
  }
  debugLog(tags);
  return { prefixes, tags, colorscheme };
}