// Chain & contract config for LitVM LiteForge Testnet
export const CHAIN = {
  id: 4441,
  hexId: "0x1159",
  name: "LitVM LiteForge",
  rpcUrl: "https://liteforge.rpc.caldera.xyz/http",
  explorer: "https://liteforge.explorer.caldera.xyz",
  symbol: "zkLTC",
  decimals: 18,
};

export const CONTRACTS = {
  marketplace: "0x5b5d3b6294D807c20Dfa6F152aA0567D1C459328",
  nftCollection: "0x1FbCc6dfE9Bc06F7cb5745f6F7c5Fc076413Cb00",
  offer: "0x6B3c22C63b2811F4872D8C3bF9B5e511707A98d1",
  factory: "0x5687FDA3BdE14d38057699c402606ab470EcA873",
  weth: "0x4Fd3765cde8D1d2BE4EdbaA03940AfC56794c304",
  router: "0xd28967D75750f477E450Df81C73f34E2713B86B4",
  autonomous: "0xbE50e133A3d0E2eD5581987D62da649d64e202C5",
};


export const MARKETPLACE_ABI = [
  "function buyNFT(uint256 listingId) payable",
  "function cancelListing(uint256 listingId)",
  "function listNFT(address nft, uint256 tokenId, uint256 price)",
  "function updateListingPrice(uint256 listingId, uint256 newPrice)",
  "function feeRecipient() view returns (address)",
  "function marketplaceFee() view returns (uint256)",
  "function listingCount() view returns (uint256)",
  "function listings(uint256) view returns (address seller, address nft, uint256 tokenId, uint256 price, bool active)",
  "function getActiveListing(address nft, uint256 tokenId) view returns (uint256 listingId, address seller, uint256 price, bool active)",
  "event Listed(uint256 indexed listingId, address indexed seller, address nft, uint256 tokenId, uint256 price)",
  "event Sold(uint256 indexed listingId, address indexed buyer, uint256 price)",
  "event ListingCancelled(uint256 indexed listingId, address indexed seller)",
];

export const NFT_ABI = [
  "function mintNFT(address to, string uri) returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function totalMinted() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export const OFFER_ABI = [
  "function makeOffer(address nft, uint256 tokenId) payable",
  "function acceptOffer(address nft, uint256 tokenId, uint256 offerIdx)",
  "function cancelOffer(address nft, uint256 tokenId, uint256 offerIdx)",
  "function listNFT(address nft, uint256 tokenId, uint256 price)",
  "function unlistNFT(uint256 listingId)",
  "function buyNFT(uint256 listingId) payable",
  "function listings(uint256) view returns (address seller, address nft, uint256 tokenId, uint256 price, bool active)",
  "function offers(address, uint256, uint256) view returns (address offerer, uint256 value, bool active)",
  "event OfferMade(address indexed nft, uint256 indexed tokenId, uint256 offerIdx, address offerer, uint256 value)",
  "event OfferAccepted(address indexed nft, uint256 indexed tokenId, uint256 offerIdx, address offerer, uint256 value, address seller)",
  "event OfferCancelled(address indexed nft, uint256 indexed tokenId, uint256 offerIdx)",
];

export const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address)",
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
];

export const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)",
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256)",
  "function removeLiquidityETH(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) returns (uint256,uint256)",
  "function swapExactETHForTokens(uint256 amountOutMin,address[] path,address to,uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[])",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[])",
  "function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[])",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function deposit() payable",
  "function withdraw(uint256)",
];

export const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];
