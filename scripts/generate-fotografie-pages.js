const { generatePages } = require('./generate-project-pages');

generatePages({
    dataFile: 'fotografie.json',
    outputDir: 'fotografie',
    backlinkUrl: 'fotografie.html',
    backlinkLabel: 'Back to photography index'
});