const { buildStablesList } = require('./process');

console.log('Processing...');

buildStablesList().then(_ => console.log('Done'));