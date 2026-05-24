import { BrowserProvider, Contract, JsonRpcProvider, Network, parseEther, formatEther, type Eip1193Provider } from "ethers";
import { CHAIN, CONTRACTS, MARKETPLACE_ABI, NFT_ABI, OFFER_ABI, ROUTER_ABI, FACTORY_ABI, ERC20_ABI, PAIR_ABI, AUTONOMOUS_ABI } from "./contracts";

import { emitWeb3Sync } from "./sync";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[]; isMetaMask?: boolean; isOkxWallet?: boolean; isBitKeep?: boolean };
    okxwallet?: Eip1193Provider;
    bitkeep?: { ethereum?: Eip1193Provider };
  }
}

export type WalletKind = "metamask" | "okx" | "bitget";

export function pickProvider(kind: WalletKind): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  if (kind === "okx") return window.okxwallet ?? null;
  if (kind === "bitget") return window.bitkeep?.ethereum ?? null;
  const eth = window.ethereum;
  if (!eth) return null;
  if (eth.providers?.length) {
    const mm = eth.providers.find((p: any) => p.isMetaMask && !p.isOkxWallet && !p.isBitKeep);
    if (mm) return mm;
  }
  return eth;
}

// Lazy read-only provider. Constructing JsonRpcProvider eagerly triggers
// async I/O (detectNetwork) at module init, which Cloudflare Workers reject
// during SSR ("Disallowed operation called within global scope"). The Proxy
// defers construction until the first property access from a request handler.
let _readProvider: JsonRpcProvider | null = null;
function getReadProvider(): JsonRpcProvider {
  if (!_readProvider) {
    const net = Network.from({ chainId: CHAIN.id, name: CHAIN.name });
    _readProvider = new JsonRpcProvider(CHAIN.rpcUrl, net, { staticNetwork: net });
  }
  return _readProvider;
}
export const readProvider = new Proxy({} as JsonRpcProvider, {
  get(_t, prop) {
    const p = getReadProvider() as any;
    const v = p[prop];
    return typeof v === "function" ? v.bind(p) : v;
  },
});

export async function connectWallet(kind: WalletKind = "metamask") {
  const injected = pickProvider(kind);
  if (!injected) throw new Error(`${kind} wallet not detected. Please install it.`);
  const provider = new BrowserProvider(injected, "any");
  const accounts = await provider.send("eth_requestAccounts", []);
  await ensureChain(injected);
  const signer = await provider.getSigner();
  return { provider, signer, address: accounts[0] as string };
}

export async function ensureChain(injected: Eip1193Provider) {
  try {
    await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hexId }] });
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await injected.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN.hexId,
          chainName: CHAIN.name,
          nativeCurrency: { name: CHAIN.symbol, symbol: CHAIN.symbol, decimals: CHAIN.decimals },
          rpcUrls: [CHAIN.rpcUrl],
          blockExplorerUrls: [CHAIN.explorer],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function getSigner(kind: WalletKind = "metamask") {
  const { signer } = await connectWallet(kind);
  return signer;
}

export function getContract(address: string, abi: any, signerOrProvider?: any) {
  return new Contract(address, abi, signerOrProvider ?? readProvider);
}

export const marketplaceRead = () => new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
export const nftRead = () => new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
export const offerRead = () => new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);
export const routerRead = () => new Contract(CONTRACTS.router, ROUTER_ABI, readProvider);
export const factoryRead = () => new Contract(CONTRACTS.factory, FACTORY_ABI, readProvider);

async function waitAndSync(txPromise: Promise<any>, reason: string) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  emitWeb3Sync(reason);
  return receipt;
}

// ---------- NFT actions ----------
export async function mintNFT(
  signer: any,
  file: File,
  name: string,
  description: string,
  onProgress?: (s: string) => void,
  extra?: Record<string, any>,
) {
  onProgress?.("Uploading image...");
  // Lazy import to keep web3 module client-bundle small
  const { supabase } = await import("@/integrations/supabase/client");
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("nft-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  let imageUrl: string;
  if (upErr) {
    onProgress?.("Storage upload failed, using on-chain encoding...");
    imageUrl = await fileToDataUrl(file);
  } else {
    imageUrl = supabase.storage.from("nft-images").getPublicUrl(path).data.publicUrl;
  }
  const metadata = { name, description, image: imageUrl, ...(extra ?? {}) };
  const tokenUri = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
  onProgress?.("Confirm in wallet...");
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);
  const to = await signer.getAddress();
  const tx = await nft.mintNFT(to, tokenUri);
  onProgress?.("Minting on-chain...");
  const receipt = await tx.wait();
  onProgress?.("Minted!");
  return receipt;
}

export async function listNFT(signer: any, tokenId: bigint | number, priceEth: string) {
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);
  const approved = await nft.getApproved(tokenId);
  if (approved.toLowerCase() !== CONTRACTS.marketplace.toLowerCase()) {
    const tx0 = await nft.approve(CONTRACTS.marketplace, tokenId);
    await tx0.wait();
  }
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, signer);
  return waitAndSync(mp.listNFT(CONTRACTS.nftCollection, tokenId, parseEther(priceEth)), "list-nft");
}

export async function buyNFT(signer: any, listingId: bigint | number, priceWei: bigint) {
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, signer);
  return waitAndSync(mp.buyNFT(listingId, { value: priceWei }), "buy-nft");
}

export async function cancelListing(signer: any, listingId: bigint | number) {
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, signer);
  return waitAndSync(mp.cancelListing(listingId), "cancel-listing");
}

export async function updateListingPrice(signer: any, listingId: bigint | number, newPriceEth: string) {
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, signer);
  return waitAndSync(mp.updateListingPrice(listingId, parseEther(newPriceEth)), "update-listing");
}

// Transfer NFT to another wallet
export async function transferNFT(signer: any, to: string, tokenId: bigint | number) {
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);
  const from = await signer.getAddress();
  return waitAndSync(nft.transferFrom(from, to, tokenId), "transfer-nft");
}

// Wrap native zkLTC -> WETH
export async function wrapNative(signer: any, amountEth: string) {
  const w = new Contract(CONTRACTS.weth, ERC20_ABI, signer);
  return waitAndSync(w.deposit({ value: parseEther(amountEth) }), "wrap-native");
}

// Unwrap WETH -> native
export async function unwrapNative(signer: any, amountEth: string) {
  const w = new Contract(CONTRACTS.weth, ERC20_ABI, signer);
  return waitAndSync(w.withdraw(parseEther(amountEth)), "unwrap-native");
}

// Read marketplace fee (basis points) + fee recipient
export async function getMarketplaceFeeInfo() {
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
  const [bps, recipient] = await Promise.all([
    mp.marketplaceFee().catch(() => 0n),
    mp.feeRecipient().catch(() => "0x0000000000000000000000000000000000000000"),
  ]);
  return { bps: Number(bps), percent: Number(bps) / 100, recipient: String(recipient) };
}

export async function makeOffer(signer: any, tokenId: bigint | number, priceEth: string) {
  const c = new Contract(CONTRACTS.offer, OFFER_ABI, signer);
  return waitAndSync(c.makeOffer(CONTRACTS.nftCollection, tokenId, { value: parseEther(priceEth) }), "make-offer");
}

export async function acceptOffer(signer: any, tokenId: bigint | number, offerIdx: bigint | number) {
  // Use operator approval — more robust than per-token approve which gets cleared on every transfer.
  const me = (await signer.getAddress()).toLowerCase();
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);

  // Sanity: confirm signer actually owns the token now (after any prior cancel-listing tx).
  const onChainOwner: string = await nft.ownerOf(tokenId);
  if (onChainOwner.toLowerCase() !== me) {
    throw new Error(
      `NFT belum kembali ke wallet kamu (owner: ${onChainOwner.slice(0, 8)}...). Coba refresh sebentar lalu Accept lagi.`,
    );
  }

  const isOp: boolean = await nft.isApprovedForAll(me, CONTRACTS.offer).catch(() => false);
  if (!isOp) {
    const txA = await nft.setApprovalForAll(CONTRACTS.offer, true);
    await txA.wait();
  }

  const c = new Contract(CONTRACTS.offer, OFFER_ABI, signer);
  return waitAndSync(c.acceptOffer(CONTRACTS.nftCollection, tokenId, offerIdx), "accept-offer");
}

// Accept an offer even when the NFT is currently listed: cancel listing first, then accept.
export async function acceptOfferAuto(
  signer: any,
  tokenId: bigint | number,
  offerIdx: bigint | number,
  listingId?: bigint | number | null,
) {
  const me = (await signer.getAddress()).toLowerCase();
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);
  const currentOwner: string = await nft.ownerOf(tokenId);

  // Cancel only if the marketplace still escrows this NFT.
  if (
    listingId !== undefined && listingId !== null &&
    currentOwner.toLowerCase() === CONTRACTS.marketplace.toLowerCase()
  ) {
    const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, signer);
    const tx1 = await mp.cancelListing(listingId);
    await tx1.wait();
    emitWeb3Sync("cancel-listing-for-offer");

    // Poll until ownerOf reverts to the seller — RPC may lag a block.
    for (let i = 0; i < 10; i++) {
      const o: string = await nft.ownerOf(tokenId).catch(() => "");
      if (o.toLowerCase() === me) break;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return acceptOffer(signer, tokenId, offerIdx);
}


export async function cancelOffer(signer: any, tokenId: bigint | number, offerIdx: bigint | number) {
  const c = new Contract(CONTRACTS.offer, OFFER_ABI, signer);
  return waitAndSync(c.cancelOffer(CONTRACTS.nftCollection, tokenId, offerIdx), "cancel-offer");
}

// ---------- DEX ----------
export async function wrapEth(signer: any, amountEth: string) {
  const weth = new Contract(CONTRACTS.weth, ERC20_ABI, signer);
  return waitAndSync(weth.deposit({ value: parseEther(amountEth) }), "wrap-eth");
}

export async function approveToken(signer: any, token: string, spender: string, amount: bigint) {
  const t = new Contract(token, ERC20_ABI, signer);
  const owner = await signer.getAddress();
  const current: bigint = await t.allowance(owner, spender);
  if (current >= amount) return null;
  const tx = await t.approve(spender, amount);
  return tx.wait();
}

// Convert decimal slippage % (e.g. 0.5, 1, 3) to integer basis points safely.
// BigInt(99.5) throws — so we scale by 10_000 to support up to 4 decimals.
function minOutWithSlippage(amountOut: bigint, slippagePct: number): bigint {
  const bps = Math.max(0, Math.min(10_000, Math.round(slippagePct * 100))); // pct -> bps
  return (amountOut * BigInt(10_000 - bps)) / 10_000n;
}

export async function swapExactETHForTokens(signer: any, tokenOut: string, amountInEth: string, slippagePct = 1) {
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, signer);
  const path = [CONTRACTS.weth, tokenOut];
  const amountIn = parseEther(amountInEth);
  const amounts = await router.getAmountsOut(amountIn, path);
  const minOut = minOutWithSlippage(amounts[amounts.length - 1], slippagePct);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  return waitAndSync(router.swapExactETHForTokens(minOut, path, to, deadline, { value: amountIn }), "swap-eth-for-token");
}

export async function swapExactTokensForETH(signer: any, tokenIn: string, amountIn: bigint, slippagePct = 1) {
  await approveToken(signer, tokenIn, CONTRACTS.router, amountIn);
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, signer);
  const path = [tokenIn, CONTRACTS.weth];
  const amounts = await router.getAmountsOut(amountIn, path);
  const minOut = minOutWithSlippage(amounts[amounts.length - 1], slippagePct);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  return waitAndSync(router.swapExactTokensForETH(amountIn, minOut, path, to, deadline), "swap-token-for-eth");
}

/** Multi-hop swap with a custom path (smart routing). */
export async function swapExactTokensForTokens(signer: any, amountIn: bigint, path: string[], slippagePct = 1) {
  if (path.length < 2) throw new Error("Path too short");
  await approveToken(signer, path[0], CONTRACTS.router, amountIn);
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, signer);
  const amounts = await router.getAmountsOut(amountIn, path);
  const minOut = minOutWithSlippage(amounts[amounts.length - 1], slippagePct);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  return waitAndSync(router.swapExactTokensForTokens(amountIn, minOut, path, to, deadline), "swap-token-for-token");
}


/** Try direct path first, then route through WETH. Returns best path + estimated out. */
export async function findBestRoute(amountIn: bigint, tokenIn: string, tokenOut: string): Promise<{ path: string[]; out: bigint; hops: number } | null> {
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, readProvider);
  const candidates: string[][] = [];
  if (tokenIn.toLowerCase() !== tokenOut.toLowerCase()) candidates.push([tokenIn, tokenOut]);
  if (tokenIn.toLowerCase() !== CONTRACTS.weth.toLowerCase() && tokenOut.toLowerCase() !== CONTRACTS.weth.toLowerCase()) {
    candidates.push([tokenIn, CONTRACTS.weth, tokenOut]);
  }
  let best: { path: string[]; out: bigint; hops: number } | null = null;
  for (const path of candidates) {
    try {
      const a = await router.getAmountsOut(amountIn, path);
      const out = a[a.length - 1] as bigint;
      if (!best || out > best.out) best = { path, out, hops: path.length - 1 };
    } catch { /* ignore unavailable path */ }
  }
  return best;
}

/** Uniswap v2 quote: amountB = amountA * reserveB / reserveA */
export function uniQuote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (reserveA === 0n) return 0n;
  return (amountA * reserveB) / reserveA;
}

export async function getPairInfo(tokenA: string, tokenB: string, owner?: string) {
  const factory = new Contract(CONTRACTS.factory, FACTORY_ABI, readProvider);
  const pair: string = await factory.getPair(tokenA, tokenB);
  if (!pair || pair === "0x0000000000000000000000000000000000000000") {
    return { pair: null as string | null, reserve0: 0n, reserve1: 0n, token0: "", token1: "", totalSupply: 0n, lpBalance: 0n };
  }
  const p = new Contract(pair, PAIR_ABI, readProvider);
  const [reserves, token0, token1, totalSupply, lpBalance] = await Promise.all([
    p.getReserves(),
    p.token0(),
    p.token1(),
    p.totalSupply(),
    owner ? p.balanceOf(owner) : Promise.resolve(0n),
  ]);
  return {
    pair,
    reserve0: reserves[0] as bigint,
    reserve1: reserves[1] as bigint,
    token0: String(token0),
    token1: String(token1),
    totalSupply: totalSupply as bigint,
    lpBalance: lpBalance as bigint,
  };
}

export async function getTokenBalance(token: string, owner: string): Promise<bigint> {
  const t = new Contract(token, ERC20_ABI, readProvider);
  return (await t.balanceOf(owner)) as bigint;
}

export async function getNativeBalance(owner: string): Promise<bigint> {
  return await readProvider.getBalance(owner);
}

export async function addLiquidityETH(signer: any, token: string, tokenAmount: bigint, ethAmountEth: string, slippagePct = 1) {
  await approveToken(signer, token, CONTRACTS.router, tokenAmount);
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, signer);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const ethAmount = parseEther(ethAmountEth);
  const minToken = minOutWithSlippage(tokenAmount, slippagePct);
  const minEth = minOutWithSlippage(ethAmount, slippagePct);
  return waitAndSync(router.addLiquidityETH(token, tokenAmount, minToken, minEth, to, deadline, { value: ethAmount }), "add-liquidity");
}

export async function removeLiquidityETH(signer: any, token: string, liquidity: bigint, pairAddr: string, minTokenOut: bigint = 0n, minEthOut: bigint = 0n) {
  // approve LP token
  await approveToken(signer, pairAddr, CONTRACTS.router, liquidity);
  const router = new Contract(CONTRACTS.router, ROUTER_ABI, signer);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  return waitAndSync(router.removeLiquidityETH(token, liquidity, minTokenOut, minEthOut, to, deadline), "remove-liquidity");
}

// Send native zkLTC or ERC20 token (amount as decimal string)
export async function sendToken(signer: any, tokenAddress: string | "native", to: string, amountEth: string) {
  if (tokenAddress === "native") {
    return waitAndSync(signer.sendTransaction({ to, value: parseEther(amountEth) }), "send-native");
  }
  const c = new Contract(tokenAddress, ERC20_ABI, signer);
  return waitAndSync(c.transfer(to, parseEther(amountEth)), "send-token");
}

// ---------- Autonomous Settlement Agent ----------
export const autonomousRead = () => new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, readProvider);

async function ensureNftOperator(signer: any, operator: string) {
  const me = await signer.getAddress();
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, signer);
  const ok: boolean = await nft.isApprovedForAll(me, operator).catch(() => false);
  if (!ok) {
    const tx = await nft.setApprovalForAll(operator, true);
    await tx.wait();
  }
}

export async function asaList(signer: any, tokenId: bigint | number, priceEth: string) {
  await ensureNftOperator(signer, CONTRACTS.autonomous);
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.list(CONTRACTS.nftCollection, tokenId, parseEther(priceEth)), "asa-list");
}

export async function asaDelist(signer: any, tokenId: bigint | number) {
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.delist(CONTRACTS.nftCollection, tokenId), "asa-delist");
}

export async function asaBuyNow(signer: any, tokenId: bigint | number, priceWei: bigint) {
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.buyNow(CONTRACTS.nftCollection, tokenId, { value: priceWei }), "asa-buy");
}

export async function asaPlaceBid(signer: any, tokenId: bigint | number, priceEth: string) {
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.placeBid(CONTRACTS.nftCollection, tokenId, { value: parseEther(priceEth) }), "asa-bid");
}

export async function asaCancelBid(signer: any, tokenId: bigint | number) {
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.cancelBid(CONTRACTS.nftCollection, tokenId), "asa-cancel-bid");
}

export async function asaAcceptBid(signer: any, tokenId: bigint | number) {
  await ensureNftOperator(signer, CONTRACTS.autonomous);
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.acceptBid(CONTRACTS.nftCollection, tokenId), "asa-accept-bid");
}

export async function asaWithdraw(signer: any) {
  const c = new Contract(CONTRACTS.autonomous, AUTONOMOUS_ABI, signer);
  return waitAndSync(c.withdraw(), "asa-withdraw");
}

export async function asaGetListing(tokenId: bigint | number) {
  const r = await autonomousRead().getListing(CONTRACTS.nftCollection, tokenId);
  return { seller: String(r[0]), price: r[1] as bigint, active: Boolean(r[2]) };
}

export async function asaGetBid(tokenId: bigint | number) {
  const r = await autonomousRead().getBid(CONTRACTS.nftCollection, tokenId);
  return { bidder: String(r[0]), bidPrice: r[1] as bigint, active: Boolean(r[2]) };
}

export async function asaPendingWithdraw(owner: string): Promise<bigint> {
  return (await autonomousRead().pendingWithdrawals(owner)) as bigint;
}

export async function asaFeeBps(): Promise<number> {
  const v = await autonomousRead().feeBps().catch(() => 0n);
  return Number(v);
}


export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function shortAddr(a?: string) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

export function decodeTokenUri(uri: string): { name?: string; description?: string; image?: string; category?: string; attributes?: any[]; collection?: any; royalty_bps?: number } | null {
  try {
    let parsed: any = null;
    if (uri.startsWith("data:application/json;base64,")) {
      const json = atob(uri.replace("data:application/json;base64,", ""));
      parsed = JSON.parse(decodeURIComponent(escape(json)));
    } else if (uri.startsWith("data:application/json")) {
      parsed = JSON.parse(decodeURIComponent(uri.split(",")[1] ?? ""));
    } else { return null; }
    // Legacy fix: some NFTs were minted with description = JSON.stringify({description, category, ...})
    if (parsed && typeof parsed.description === "string" && parsed.description.trim().startsWith("{")) {
      try {
        const inner = JSON.parse(parsed.description);
        if (inner && typeof inner === "object") {
          parsed = { ...parsed, ...inner, description: typeof inner.description === "string" ? inner.description : "" };
        }
      } catch { /* leave as-is */ }
    }
    return parsed;
  } catch { return null; }
}

export { parseEther, formatEther };
export { PAIR_ABI, ERC20_ABI };
