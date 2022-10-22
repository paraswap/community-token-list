const { process } = require('./process');

console.log('Processing...');

process().then(_ => console.log('Done'));