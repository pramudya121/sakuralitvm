// Token registry with CoinMarketCap logos (64x64). 'native' = chain coin.
import { CONTRACTS } from "./web3/contracts";
import monLogo from "@/assets/token-mon.jpg";
import litvmLogo from "@/assets/token-litvm.png";

export type TokenInfo = {
  symbol: string;
  name: string;
  address: string | "native";
  decimals: number;
  cmcId: number;
  logo: string;
};

const logo = (id: number) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;

export const TOKENS: TokenInfo[] = [
  { symbol: "zkLTC",   name: "zk Litecoin",       address: "native",                                 decimals: 18, cmcId: 2,     logo: logo(2)     },
  { symbol: "wzkLTC",  name: "Wrapped zkLTC",     address: CONTRACTS.weth,                         decimals: 18, cmcId: 2,     logo: logo(2)     },
  { symbol: "ETH",     name: "Ethereum",          address: "0x5b0AE944A4Ee6241a5A638C440A0dCD42411bD3C", decimals: 18, cmcId: 1027,  logo: logo(1027)  },
  { symbol: "BNB",     name: "Binance Coin",      address: "0x31351646e2c5479A30f846dFa4297E9Dbe189a63", decimals: 18, cmcId: 1839,  logo: logo(1839)  },
  { symbol: "MON",     name: "Monad",             address: "0xa12C18847c41ECE267155ffAe112b8951AbbcA1C", decimals: 18, cmcId: 28478, logo: monLogo     },
  { symbol: "HYPE",    name: "Hyperliquid",       address: "0xBB3B44EB672650Fb4a1Cf6D9dc5d3b7494F333AB", decimals: 18, cmcId: 32196, logo: logo(32196) },
  
  { symbol: "LITVM",   name: "LitVM",             address: "0xF143eCFE3DFEEB4ae188cA4f1c7c7ab0b5F592eb", decimals: 18, cmcId: 0,     logo: litvmLogo   },
];

export const tokenLogo = (cmcId: number) => logo(cmcId);
