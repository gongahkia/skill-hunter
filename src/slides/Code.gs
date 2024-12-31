function onOpen() {
  const ui = SlidesApp.getUi();
  ui.createMenu('Owl')
    .addItem('Get Tags', 'showTagsSidebar')
    .addItem('Credits', 'showCredits')
    .addToUi();
}

function showCredits() {
  const html = HtmlService.createHtmlOutputFromFile('Credits')
      .setWidth(200)
      .setHeight(150);
  SlidesApp.getUi().showModalDialog(html, 'Credits 🙇🏻');
}

function showTagsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('OwlSidebar')
    .setWidth(300)
    .setHeight(400);
  SlidesApp.getUi().showSidebar(html.setTitle('Owl 🦉'));
}

function getTaggedLines() {
  const presentation = SlidesApp.getActivePresentation();
  const slides = presentation.getSlides();
  const prefixes = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV'];
  const tags = {};
  for (const slide of slides) {
    const shapes = slide.getShapes();
    for (const shape of shapes) {
      if (shape.getText()) {
        const textContent = shape.getText().asString();
        const lines = textContent.split('\n');
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
      }
    }
  }
  Logger.log(tags);
  return { prefixes, tags };
}