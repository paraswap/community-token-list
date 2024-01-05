const fs = require("fs")
require('dotenv').config();

const { JsonRpcProvider } = require('@ethersproject/providers');
const { Interface, AbiCoder } = require('@ethersproject/abi');
const { Contract } = require('@ethersproject/contracts');
const ERC20ABI = require('./lib/abi/erc20.abi.json');
const MultiCallerABI = require('./lib/abi/multicaller.abi.json');

const coder = new AbiCoder();

const CHAIN_ID_ETHEREUM = 1;
const CHAIN_ID_BINANCE = 56;
const CHAIN_ID_POLYGON = 137;
const CHAIN_ID_AVALANCHE = 43114;
const CHAIN_ID_FANTOM = 250;

const Web3Provider = {
    [CHAIN_ID_ETHEREUM]: process.env.HTTP_PROVIDER_1 || '',
    [CHAIN_ID_BINANCE]: process.env.HTTP_PROVIDER_56 || '',
    [CHAIN_ID_POLYGON]: process.env.HTTP_PROVIDER_137 || '',
    [CHAIN_ID_FANTOM]: process.env.HTTP_PROVIDER_250 || '',
    [CHAIN_ID_AVALANCHE]: process.env.HTTP_PROVIDER_43114 || '',
};

const MULTICALL_ADDRESS = {
    [CHAIN_ID_ETHEREUM]: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    [CHAIN_ID_BINANCE]: '0xdc6e2b14260f972ad4e5a31c68294fba7e720701',
    [CHAIN_ID_POLYGON]: '0xdC6E2b14260F972ad4e5a31c68294Fba7E720701',
    [CHAIN_ID_FANTOM]: '0xdC6E2b14260F972ad4e5a31c68294Fba7E720701',
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

const newlist = fs.readFileSync(`${__dirname}/sources/tokens.tsv`, 'utf-8').split('\n').map(l => {
    const [address, chainId] = l.split('\t');

    const meta = allTokenLists.find(t => t.address.toLowerCase() == address.toLowerCase() && chainId == t.chainId) || { name: "", symbol: "", decimals: "" }

    return { ...meta, address: address.toLowerCase(), chainId: parseInt(chainId) }
});
fs.writeFileSync(`${__dirname}/sources/newList.json`, JSON.stringify(newlist));

/*
const newTokenList = tokenlist.tokens.filter(t => {
    return !!newlist.find(nt => nt.address == t.address.toLowerCase() && nt.chainId == t.chainId);
})
const newStableList = stablelist.tokens.filter(t => {
    return !!newlist.find(nt => nt.address == t.address.toLowerCase() && nt.chainId == t.chainId);
})
const newExtraList = extralist.tokens.filter(t => {
    return !!newlist.find(nt => nt.address == t.address.toLowerCase() && nt.chainId == t.chainId);
})

function printCount(oldTS, nList, label) {
    console.log(label, oldTS.tokens.length, "->", nList.length, "tokens");
}
printCount(tokenlist, newTokenList, 'tokenList')
printCount(stablelist, newStableList, 'stablelist')
printCount(extralist, newExtraList, "extralist")

console.log('old lists', tokenlist.tokens.length + stablelist.tokens.length + extralist.tokens.length);
console.log('new lists', newTokenList.length + newStableList.length + newExtraList.length);
*/

async function getMeta(tokenAddress, chainId) {
    console.log('getMeta', tokenAddress, chainId);
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

    console.log(tokenAddress, { symbol, name, decimals });

    return { symbol, name, decimals };
}

async function retrieveMissingTokensData() {
    const missingTokens = newlist.filter(nt => !nt.decimals);
    console.log('missingTokens', missingTokens.length);

    const missingTokensWithMeta = await Promise.all(
        missingTokens
            .filter(mt => mt.chainId == 1)
            .map(async mt => {
                const meta = await getMeta(mt.address, mt.chainId);

                return { ...mt, ...meta };
            }))

    console.log('missingTokensWithMeta', missingTokensWithMeta, missingTokensWithMeta.length);

}

retrieveMissingTokensData()
//console.log('newlist', newlist);