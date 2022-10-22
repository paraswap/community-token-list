const packageJson = require('../package.json');
const schema = require('@uniswap/token-lists/src/tokenlist.schema.json');
const { expect } = require('chai');
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const beautify = require('json-beautify');

const { buildList } = require('../src/process');
const chains = require('../src/sources/chains.json');

const ajv = new Ajv({ allErrors: true, format: 'full' });
const validator = ajv.compile(schema);
let defaultTokenList;

before(async function () {
    this.timeout(120000);

    const tokensByChain = fs.readdirSync(path.join(__dirname, '../src/sources/tokens'))
        .reduce((acc, fileName) => {
            const chainName = fileName.replace('.json', '');
            const chainId = (_(chains).keys().find(c => chains[c] === chainName));

            acc[chainId] = require('../src/sources/tokens/' + fileName);
            return acc;
        }, {});

    defaultTokenList = await buildList(tokensByChain);

});

describe('buildList', () => {

    it('validates', () => {
        expect(validator(defaultTokenList)).to.equal(true);
    });
});