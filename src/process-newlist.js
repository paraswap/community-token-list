const fs = require("fs")
require('dotenv').config();

const { JsonRpcProvider } = require('@ethersproject/providers');
const { Interface, AbiCoder } = require('@ethersproject/abi');
const { Contract } = require('@ethersproject/contracts');
const ERC20ABI = require('./lib/abi/erc20.abi.json');
const MultiCallerABI = require('./lib/abi/multicaller.abi.json');
const beautify = require("json-beautify");

const coder = new AbiCoder();

const CHAIN_ID_ETHEREUM = 1;
const CHAIN_ID_BINANCE = 56;
const CHAIN_ID_POLYGON = 137;
const CHAIN_ID_AVALANCHE = 43114;
const CHAIN_ID_FANTOM = 250;
const CHAIN_ID_OPTIMISM = 10;
const CHAIN_ID_ZKEMV = 1101;
const CHAIN_ID_BASE = 8453;
const CHAIN_ID_ARB = 42161;

const Web3Provider = {
    [CHAIN_ID_ETHEREUM]: process.env.HTTP_PROVIDER_1 || '',
    [CHAIN_ID_BINANCE]: process.env.HTTP_PROVIDER_56 || '',
    [CHAIN_ID_POLYGON]: process.env.HTTP_PROVIDER_137 || '',
    [CHAIN_ID_FANTOM]: process.env.HTTP_PROVIDER_250 || '',
    [CHAIN_ID_AVALANCHE]: process.env.HTTP_PROVIDER_43114 || '',
    [CHAIN_ID_OPTIMISM]: process.env.HTTP_PROVIDER_10 || '',
    [CHAIN_ID_ZKEMV]: process.env.HTTP_PROVIDER_1101 || '',
    [CHAIN_ID_BASE]: process.env.HTTP_PROVIDER_8453 || '',
    [CHAIN_ID_ARB]: process.env.HTTP_PROVIDER_42161 || '',
};

const MULTICALL_ADDRESS = {
    [CHAIN_ID_ETHEREUM]: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    [CHAIN_ID_POLYGON]: '0x275617327c958bD06b5D6b871E7f491D76113dd8',
    [CHAIN_ID_BINANCE]: '0xC50F4c1E81c873B2204D7eFf7069Ffec6Fbe136D',
    [CHAIN_ID_FANTOM]: '0xdC6E2b14260F972ad4e5a31c68294Fba7E720701',
    [CHAIN_ID_AVALANCHE]: '0xb14067B3C160E378DeEAFA8c0D03FF97Fbf0C408',
    [CHAIN_ID_OPTIMISM]: '0x2DC0E2aa608532Da689e89e237dF582B783E552C',
    [CHAIN_ID_ZKEMV]: '0x6cA478C852DfA8941FC819fDf248606eA04780B6',
    [CHAIN_ID_BASE]: '0xeDF6D2a16e8081F777eB623EeB4411466556aF3d',
    [CHAIN_ID_ARB]: '0x7eCfBaa8742fDf5756DAC92fbc8b90a19b8815bF',
};

const NATIVE_TOKEN = {
    [CHAIN_ID_ETHEREUM]: 'ETH',
    [CHAIN_ID_POLYGON]: 'MATIC',
    [CHAIN_ID_BINANCE]: 'BNB',
    [CHAIN_ID_FANTOM]: 'FTM',
    [CHAIN_ID_AVALANCHE]: 'AVAX',
    [CHAIN_ID_OPTIMISM]: 'ETH',
    [CHAIN_ID_ZKEMV]: 'ETH',
    [CHAIN_ID_BASE]: 'ETH',
    [CHAIN_ID_ARB]: 'ETH',
};

const tokenlist = require('./sources/paraswap.tokenlist.json');
const stablelist = require('./sources/paraswap.stablelist.json');
const extralist = require('./sources/paraswap.extralist.json');
const allTokenLists = tokenlist.tokens.concat(stablelist.tokens).concat(extralist.tokens);

class Provider {
    static jsonRpcProviders = {};
    static getJsonRpcProvider(network) {
        if (!this.jsonRpcProviders[network]) {
            if (!Web3Provider[network])
                throw new Error(`Provider not defined for network ${network}`);
            this.jsonRpcProviders[network] = new JsonRpcProvider(
                Web3Provider[network],
            );
        }
        return this.jsonRpcProviders[network];
    }
}

let newlist;
if (!fs.existsSync(`${__dirname}/sources/newList.json`)) {
    newlist = fs.readFileSync(`${__dirname}/sources/tokens.tsv`, 'utf-8').split('\n').map(l => {
        const [address, chainId] = l.split('\t');

        const meta = allTokenLists.find(t => t.address.toLowerCase() == address.toLowerCase() && chainId == t.chainId) || { name: "", symbol: "", decimals: "" }

        return { ...meta, address: address.toLowerCase(), chainId: parseInt(chainId) }
    });
    fs.writeFileSync(`${__dirname}/sources/newList.json`, JSON.stringify(newlist));
}
else if (fs.existsSync(`${__dirname}/sources/fullTokens.json`)) {
    newlist = require('./sources/fullTokens.json');
}
else {
    newlist = require('./sources/newList.json');
}

let left = 0;
async function getMeta(tokenAddress, chainId) {
    try {
        if (tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
            return {
                symbol: NATIVE_TOKEN[chainId],
                name: NATIVE_TOKEN[chainId],
                decimals: 18
            };
        }

        const erc20Interface = new Interface(ERC20ABI);

        const provider = Provider.getJsonRpcProvider(chainId);
        const multicallContract = new Contract(
            MULTICALL_ADDRESS[chainId],
            MultiCallerABI,
            provider,
        );

        const multiCallData = [
            {
                target: tokenAddress,
                callData: erc20Interface.encodeFunctionData('symbol', []),
            },
            {
                target: tokenAddress,
                callData: erc20Interface.encodeFunctionData('name', []),
            },
            {
                target: tokenAddress,
                callData: erc20Interface.encodeFunctionData('decimals', []),
            }
        ]

        const data = (await multicallContract.functions.aggregate(
            multiCallData,
            { blockTag: "latest" },
        )).returnData

        const symbol = coder.decode(['string'], data[0])[0].toString()
        const name = coder.decode(['string'], data[1])[0].toString()
        const decimals = parseInt(coder.decode(['uint256'], data[2])[0])

        console.log(left--, tokenAddress, chainId, {
            symbol,
            name,
            decimals
        });

        return {
            symbol,
            name,
            decimals
        };

    } catch (error) {
        console.log("error", tokenAddress, chainId, error.message);
        return {};
    }
}

async function retrieveMissingTokensData() {
    const missingTokens = newlist.filter(nt => !nt.symbol);

    if (!missingTokens.length) return newlist;

    console.log('missingTokens', missingTokens.length);

    left = missingTokens.length;
    const missingTokensWithMeta = await Promise.all(
        missingTokens
            .map(async mt => {
                const meta = await getMeta(mt.address, mt.chainId);
                return { ...mt, ...meta };
            }))

    const fullTokens = newlist.map(t => {
        if (!t.symbol) {
            return missingTokensWithMeta.find(_t => _t.address == t.address && _t.chainId == t.chainId)
        }
        return t;
    })

    fs.writeFileSync(`${__dirname}/sources/fullTokens.json`, JSON.stringify(fullTokens));

    console.log('Saved', fullTokens.length - left, 'tokens to fullTokens.json');

    return fullTokens;
}

function cleanList(tlist, fullTokensList, path) {
    const newTList = {
        ...tlist,
        timestamp: new Date(),
        version: { "major": 2, "minor": 0, "patch": 0 },
        tokens: tlist.tokens.filter(t => {
            return !!fullTokensList.find(_t => (
                _t.address.toLowerCase() == t.address.toLowerCase() &&
                _t.chainId == t.chainId
            ))
        })
    }

    fs.writeFileSync(`${__dirname}/${path}`, beautify(newTList, null, 2, 80));

    return newTList
}

async function start() {
    const fullTokensList = await retrieveMissingTokensData();

    console.log('fullTokensList', fullTokensList.length);

    cleanList(extralist, fullTokensList, './sources/paraswap.extralist.json');
    cleanList(stablelist, fullTokensList, './sources/paraswap.stablelist.json');
    cleanList(tokenlist, fullTokensList, './sources/paraswap.tokenlist.json');
}

start();