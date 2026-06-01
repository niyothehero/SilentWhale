"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import {
  ACTIVE_CHAIN,
  SILENT_WHALE_ABI,
  SILENT_WHALE_ADDRESS,
  isContractConfigured,
} from "@/lib/silent-whale";

type WalletState = {
  address?: string;
  chainId?: number;
  isConnecting: boolean;
  error?: string;
};

export function useSilentWhale() {
  const [wallet, setWallet] = useState<WalletState>({ isConnecting: false });

  const hasWallet = useMemo(
    () => typeof window !== "undefined" && Boolean(window.ethereum),
    []
  );

  const refreshWallet = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const [accounts, chainHex] = await Promise.all([
        window.ethereum.request({ method: "eth_accounts" }) as Promise<string[]>,
        window.ethereum.request({ method: "eth_chainId" }) as Promise<string>,
      ]);
      setWallet((current) => ({
        ...current,
        address: accounts[0],
        chainId: Number(chainHex),
        error: undefined,
      }));
    } catch (error: any) {
      setWallet((current) => ({
        ...current,
        address: undefined,
        chainId: undefined,
        error: error?.message || "Could not refresh wallet state.",
      }));
    }
  }, []);

  const ensureNetwork = useCallback(async () => {
    if (!window.ethereum) throw new Error("Wallet extension not found.");
    const currentChain = Number(
      await window.ethereum.request({ method: "eth_chainId" })
    );
    if (currentChain === ACTIVE_CHAIN.id) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ACTIVE_CHAIN.hexId }],
      });
    } catch (error: any) {
      if (error?.code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ACTIVE_CHAIN.hexId,
            chainName: ACTIVE_CHAIN.name,
            rpcUrls: [ACTIVE_CHAIN.rpcUrl],
            nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
            blockExplorerUrls: [ACTIVE_CHAIN.explorer],
          },
        ],
      });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setWallet({ isConnecting: false, error: "Wallet extension not found." });
      return;
    }

    setWallet((current) => ({ ...current, isConnecting: true, error: undefined }));
    try {
      await ensureNetwork();
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setWallet({
        address: accounts[0],
        chainId: Number(network.chainId),
        isConnecting: false,
      });
    } catch (error: any) {
      setWallet((current) => ({
        ...current,
        isConnecting: false,
        error: error?.message || "Wallet connection failed.",
      }));
    }
  }, [ensureNetwork]);

  const getWriteContract = useCallback(async () => {
    if (!window.ethereum) throw new Error("Wallet extension not found.");
    if (!isContractConfigured()) {
      throw new Error("NEXT_PUBLIC_SILENT_WHALE_ADDRESS is not configured.");
    }
    await ensureNetwork();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(SILENT_WHALE_ADDRESS, SILENT_WHALE_ABI, signer);
  }, [ensureNetwork]);

  useEffect(() => {
    refreshWallet();
    if (!window.ethereum) return;

    const handleAccounts = () => refreshWallet();
    const handleChain = () => refreshWallet();

    window.ethereum.on?.("accountsChanged", handleAccounts);
    window.ethereum.on?.("chainChanged", handleChain);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum?.removeListener?.("chainChanged", handleChain);
    };
  }, [refreshWallet]);

  return {
    ...wallet,
    hasWallet,
    configured: isContractConfigured(),
    connect,
    ensureNetwork,
    getWriteContract,
  };
}
