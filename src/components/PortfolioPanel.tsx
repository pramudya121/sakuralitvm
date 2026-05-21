import { useEffect, useMemo, useState } from "react";
import { Contract, formatUnits, parseEther, parseUnits, isAddress } from "ethers";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Send, Wallet, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TOKENS, type TokenInfo } from "@/lib/tokens";
import { CHAIN, ERC20_ABI } from "@/lib/web3/contracts";
import { readProvider } from "@/lib/web3/ethers";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";

type Holding = TokenInfo & { balance: number; usd: number };

const COLORS = ["oklch(0.72 0.18 350)", "oklch(0.7 0.18 250)", "oklch(0.75 0.18 170)", "oklch(0.78 0.18 80)", "oklch(0.7 0.18 30)", "oklch(0.7 0.18 300)", "oklch(0.7 0.18 200)", "oklch(0.7 0.18 120)"];

export function PortfolioPanel() {
  const { address, signer, balance } = useWallet();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTarget, setSendTarget] = useState<Holding | null>(null);

  useEffect(() => {
    if (!address) { setHoldings([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const items: Holding[] = [];
      for (const t of TOKENS) {
        try {
          if (t.address === "native") {
            items.push({ ...t, balance: +balance, usd: +balance });
            continue;
          }
          if (!t.address || !isAddress(t.address)) continue;
          const c = new Contract(t.address, ERC20_ABI, readProvider);
          const raw: bigint = await c.balanceOf(address);
          const bal = +formatUnits(raw, t.decimals);
          if (bal > 0) items.push({ ...t, balance: bal, usd: bal });
        } catch {}
      }
      setHoldings(items);
      setLoading(false);
    })();
  }, [address, balance]);

  const chartData = useMemo(() =>
    holdings.filter((h) => h.balance > 0).map((h) => ({ name: h.symbol, value: h.balance })), [holdings]);

  if (!address) return null;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="form-panel rounded-2xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Wallet className="w-4 h-4" /> Token Balances</h3>
          {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p> :
            holdings.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No tokens detected.</p> : (
              <div className="space-y-1.5">
                {holdings.map((h) => (
                  <div key={h.symbol} className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-accent/40 transition border border-transparent hover:border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={h.logo} alt="" className="w-9 h-9 rounded-full bg-muted shrink-0" onError={(e) => { (e.currentTarget.style.display = "none"); }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{h.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{h.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="font-mono text-sm font-bold text-right">{h.balance.toFixed(4)}</div>
                      <Button size="sm" variant="outline" className="rounded-full h-8 px-3"
                        onClick={() => setSendTarget(h)}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Send
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="form-panel rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Allocation</h3>
          {chartData.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No balances to chart.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => Number(v).toFixed(4)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="form-panel rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Holdings (Bar)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SendDialog target={sendTarget} onClose={() => setSendTarget(null)} signer={signer} />
    </div>
  );
}

function SendDialog({ target, onClose, signer }: { target: Holding | null; onClose: () => void; signer: any }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!target) { setTo(""); setAmount(""); } }, [target]);

  async function handleSend() {
    if (!target) return;
    if (!signer) return toast.error("Connect wallet");
    if (!isAddress(to)) return toast.error("Invalid recipient address");
    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) return toast.error("Enter amount");
    if (n > target.balance) return toast.error(`Insufficient ${target.symbol} balance`);
    setBusy(true);
    try {
      toast.loading("Confirm in wallet...", { id: "send" });
      if (target.address === "native") {
        const tx = await signer.sendTransaction({ to, value: parseEther(amount) });
        await tx.wait();
      } else {
        const c = new Contract(target.address, ERC20_ABI, signer);
        const tx = await c.transfer(to, parseUnits(amount, target.decimals));
        await tx.wait();
      }
      toast.success(`Sent ${amount} ${target.symbol}!`, { id: "send" });
      onClose();
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Send failed", { id: "send" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="form-panel max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {target && <img src={target.logo} className="w-7 h-7 rounded-full" alt="" />}
            Send {target?.symbol}
          </DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="rounded-xl p-3 bg-muted/40 border border-border">
              <div className="text-xs text-muted-foreground">Available</div>
              <div className="font-mono text-lg font-bold">{target.balance.toFixed(6)} {target.symbol}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Recipient</label>
              <Input placeholder="0x..." value={to} onChange={(e) => setTo(e.target.value)} className="font-mono mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Amount</span>
                <button onClick={() => setAmount(target.balance.toString())} className="text-primary font-semibold">MAX</button>
              </label>
              <div className="flex gap-2 mt-1">
                <Input type="number" step="0.0001" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {[25, 50, 75].map((p) => (
                  <button key={p} type="button" onClick={() => setAmount(((target.balance * p) / 100).toString())}
                    className="px-2.5 rounded-lg text-xs font-semibold border border-border hover:bg-accent">{p}%</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">On-chain transfer — double-check the recipient address.</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1" /> Cancel</Button>
          <Button onClick={handleSend} disabled={busy} className="rounded-full px-6">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
