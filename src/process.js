const _ = require('lodash');
const axios = require('axios');
const fs = require('fs');
const beautify = require('json-beautify');
const { getAddress } = require('@ethersproject/address');

const { version } = require("../package.json");
const lists = require('./sources/lists.json');
const chains = require('./sources/chains.json');
const communityList = require('./sources/community-token-requests.json');

const TmpDir = `${__dirname}/sources/tmp`;
const TokensDir = `${__dirname}/sources/tokens`;
const ParaSwapList = `${__dirname}/sources/paraswap.tokenlist.json`;

function createTmpDir() {
  if (!fs.existsSync(TmpDir)) {
    fs.mkdirSync(TmpDir);
  }
}

function cleanTmpDir() {
  fs.rmSync(TmpDir, { recursive: true });
}

function SaveJSON(path, obj) {
  fs.writeFileSync(path, beautify(obj, null, 2, 80));
}

async function downloadLists() {
  const tokenLists = await Promise.all(
    lists.map(async ({ url, filename }) => {
      if (fs.existsSync(`${TmpDir}/${filename}.json`)) {
        const tokens = fs.readFileSync(`${TmpDir}/${filename}.json`, 'utf-8');
        return {
          filename, list: JSON.parse(tokens.map(({ chainId, address, symbol, name, decimals, logoURI }) => ({
            chainId, address: getAddress(address), symbol, name, decimals, logoURI
          })))
        };
      }

      const { data } = await axios.get(url);
      return {
        filename, list: data.tokens.map(({ chainId, address, symbol, name, decimals, logoURI }) => ({
          chainId, address: getAddress(address), symbol, name, decimals, logoURI
        }))
      };
    })
  )

  tokenLists.forEach(({ filename, list }) => {
    SaveJSON(`${TmpDir}/${filename}.json`, list);
  })

  return tokenLists;
}

async function processLists() {
  try {
    createTmpDir();

    const tokenLists = _(await downloadLists()).map(({ list }) => list)
      .concat(communityList)
      .flatten()
      .uniqBy('address')
      .filter(t => t.symbol.length < 6 && t.name.length < 15).value();

    const tokensByChain = Object.keys(chains).reduce((acc, chainId) => {
      acc[chainId] = tokenLists.filter(t => t.chainId === parseInt(chainId));
      return acc;
    }, {});

    Object.keys(chains).forEach(chainId => {
      if (tokensByChain[chainId] && tokensByChain[chainId].length) {
        SaveJSON(`${TokensDir}/${chains[chainId]}.json`, tokensByChain[chainId])
      }
    });

    return tokensByChain;
  }
  catch (e) {
    throw new Error(e);
  }
  finally {
    cleanTmpDir();
  }
}

async function buildList(tokensByChain) {
  const tokens = _(tokensByChain).values().flatten().value();
  const parsed = version.split(".");

  const list = {
    name: "ParaSwap Community Token Lists",
    timestamp: new Date().toISOString(),
    version: {
      major: +parsed[0],
      minor: +parsed[1],
      patch: +parsed[2],
    },
    tags: {},
    logoURI: "https://uploads-ssl.webflow.com/617aa5e4225be2555942852c/6214d5c4db4ce4d976b5f1f9_logo_paraswap-handbook%20copy%201.svg",
    keywords: ["ParaSwap", "Token Lists", "DAO", "Community"],
    tokens: tokens
      .sort((t1, t2) => {
        if (t1.chainId === t2.chainId) {
          return t1.symbol.toLowerCase() < t2.symbol.toLowerCase() ? -1 : 1;
        }
        return t1.chainId < t2.chainId ? -1 : 1;
      }),
  };

  return list;
}

async function process() {
  try {
    const tokensByChain = await processLists();

    const list = await buildList(tokensByChain);

    SaveJSON(ParaSwapList, list);

  } catch (error) {
    console.error('Error processing', error);
  }
}

module.exports = {
  process,
  processLists,
  buildList
}