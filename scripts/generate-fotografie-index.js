const { generateCollectionPage } = require('./generate-collection-page');

generateCollectionPage({
    dataFile: 'fotografie.json',
    pageFile: 'fotografie.html',
    outputDir: 'fotografie'
});
