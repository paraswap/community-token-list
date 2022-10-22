---
name: Token Request
about: Request a token addition
title: 'Add {TOKEN_SYMBOL}: {TOKEN_NAME}'
labels: token request
---

- [ ] I understand that token listing is not required to use the ParaSwap Protocol.
- [ ] I understand that filing an issue does not guarantee addition to the ParaSwap Community token list.
- [ ] I understand that adding a token still requires an approval by the ParaSwap DAO to be whitelisted for ParaBoost.

**Please provide the following information for your token.**

Token infos by chain:
````
 [
    {
        "chainId": {CHAIN_ID},
        "address": "{TOKEN_ADDRESS}",
        "symbol": "{TOKEN_SYMBOL}",
        "name": "{TOKEN_NAME}",
        "decimals": {TOKEN_DECIMALS},
        "logoURI": "{LOGO_URI}"
    },
]
````
List of supported chains: [chains.json](https://github.com/paraswap/community-token-list/blob/master/src/sources/chains.json "Supprted Chains").

Link to the official homepage of token:

Link to CoinMarketCap or CoinGecko page of token: 