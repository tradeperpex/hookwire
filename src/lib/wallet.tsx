"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { CHAIN_ID, robinhood } from "./chain";

type Eip1193 = {
  request(a: { method: string; params?: unknown }): Promise<unknown>;
  on?(ev: string, fn: (...a: unknown[]) => void): void;
  removeListener?(ev: string, fn: (...a: unknown[]) => void): void;
};

type Ctx = {
  account?: Address;
  chainId?: number;
  hasProvider: boolean;
  busy: boolean;
  error?: string;
  connect(): Promise<void>;
  disconnect(): void;
  switchChain(): Promise<void>;
  walletClient(): WalletClient | undefined;
};

const WalletCtx = createContext<Ctx | null>(null);
const KEY = "hookwire.connected";

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<Eip1193>();
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const announced = useRef<Eip1193[]>([]);

  // Find a wallet. Prefer the injected provider, otherwise the first EIP-6963 announcement.
  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const p = (e as CustomEvent<{ provider: Eip1193 }>).detail?.provider;
      if (p) {
        announced.current.push(p);
        setProvider((cur) => cur ?? p);
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (window.ethereum) setProvider(window.ethereum);
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  const hydrateFrom = useCallback(async (p: Eip1193) => {
    const [accs, cid] = await Promise.all([p.request({ method: "eth_accounts" }), p.request({ method: "eth_chainId" })]);
    const a = (accs as string[])[0] as Address | undefined;
    setAccount(a);
    setChainId(parseInt(cid as string, 16));
  }, []);

  // Silent reconnect.
  useEffect(() => {
    if (!provider) return;
    if (localStorage.getItem(KEY) === "1") hydrateFrom(provider).catch(() => {});
    const onAccounts = (accs: unknown) => setAccount(((accs as string[])[0] as Address) || undefined);
    const onChain = (cid: unknown) => setChainId(parseInt(cid as string, 16));
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, hydrateFrom]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError("No wallet found. Install a browser wallet such as MetaMask or Rabby, or open this page inside your wallet app.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await hydrateFrom(provider);
      localStorage.setItem(KEY, "1");
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Connection was rejected.");
    } finally {
      setBusy(false);
    }
  }, [provider, hydrateFrom]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(KEY);
    setAccount(undefined);
  }, []);

  const switchChain = useCallback(async () => {
    if (!provider) return;
    setError(undefined);
    const hex = `0x${CHAIN_ID.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      const code = (e as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hex,
                chainName: "Robinhood Chain",
                nativeCurrency: robinhood.nativeCurrency,
                rpcUrls: robinhood.rpcUrls.default.http,
                blockExplorerUrls: [robinhood.blockExplorers.default.url],
              },
            ],
          });
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message.split("\n")[0] : "Could not add the network.");
        }
      } else {
        setError(e instanceof Error ? e.message.split("\n")[0] : "Could not switch network.");
      }
    }
    await hydrateFrom(provider).catch(() => {});
  }, [provider, hydrateFrom]);

  const walletClient = useCallback(() => {
    if (!provider || !account) return undefined;
    return createWalletClient({ account, chain: robinhood, transport: custom(provider) });
  }, [provider, account]);

  const value = useMemo<Ctx>(
    () => ({ account, chainId, hasProvider: !!provider, busy, error, connect, disconnect, switchChain, walletClient }),
    [account, chainId, provider, busy, error, connect, disconnect, switchChain, walletClient],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
