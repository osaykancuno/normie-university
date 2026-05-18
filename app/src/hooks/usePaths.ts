"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { PATH_REGISTRY_ABI, getAddresses } from "@/lib/contracts";
import {
  DEMO_PATHS,
  getDemoPathById,
  isDemoMode,
  type DemoPath,
} from "@/lib/demo-data";

const ZERO = "0x0000000000000000000000000000000000000000";

export type Path = {
  pathId: bigint;
  name: string;
  description: string;
  skillIds: readonly bigint[];
  discountBps: number;
  contentURI: string;
  creator: `0x${string}`;
  createdAt: bigint;
  updatedAt: bigint;
  isActive: boolean;
  totalPurchases: bigint;
};

function demoToPath(p: DemoPath): Path {
  return {
    pathId: p.pathId,
    name: p.name,
    description: p.description,
    skillIds: p.skillIds,
    discountBps: p.discountBps,
    contentURI: p.contentURI,
    creator: "0x5111A100000000000000000000000000000000Ab",
    createdAt: 0n,
    updatedAt: 0n,
    isActive: p.isActive,
    totalPurchases: p.totalPurchases,
  };
}

/// True when no PathRegistry is deployed → demo dataset.
function isPathDemo(): boolean {
  const addr = getAddresses();
  // Falls back to demo if PathRegistry isn't deployed yet OR the system as a whole is in demo mode.
  return addr.PathRegistry === ZERO || isDemoMode(addr.SkillRegistry);
}

/// Total number of paths.
export function useTotalPaths() {
  const addr = getAddresses();
  const demo = isPathDemo();
  const live = useReadContract({
    address: addr.PathRegistry,
    abi: PATH_REGISTRY_ABI,
    functionName: "totalPaths",
    query: { enabled: !demo },
  });
  if (demo) {
    return {
      ...live,
      data: BigInt(DEMO_PATHS.length),
      isLoading: false,
      isError: false,
      error: null,
    } as typeof live;
  }
  return live;
}

/// Fetch a single path.
export function usePath(pathId: bigint | undefined) {
  const addr = getAddresses();
  const demo = isPathDemo();
  const live = useReadContract({
    address: addr.PathRegistry,
    abi: PATH_REGISTRY_ABI,
    functionName: "getPath",
    args: pathId !== undefined ? [pathId] : undefined,
    query: { enabled: !demo && pathId !== undefined },
  });
  if (demo) {
    const found = getDemoPathById(pathId);
    return {
      ...live,
      data: found ? demoToPath(found) : undefined,
      isLoading: false,
      isError: !found,
      error: found ? null : new Error("Path not found"),
    } as typeof live;
  }
  return live;
}

/// Fetch all paths.
export function useAllPaths() {
  const addr = getAddresses();
  const demo = isPathDemo();
  const { data: total } = useTotalPaths();
  const n = demo ? DEMO_PATHS.length : total ? Number(total) : 0;

  const contracts = useMemo(
    () =>
      demo
        ? []
        : Array.from({ length: n }, (_, i) => ({
            address: addr.PathRegistry,
            abi: PATH_REGISTRY_ABI,
            functionName: "getPath" as const,
            args: [BigInt(i + 1)] as const,
          })),
    [addr.PathRegistry, n, demo]
  );

  const res = useReadContracts({
    contracts,
    query: { enabled: !demo && n > 0 },
  });

  if (demo) {
    return {
      paths: DEMO_PATHS.map(demoToPath),
      isLoading: false,
      isError: false,
      error: null,
    } as { paths: Path[]; isLoading: boolean; isError: boolean; error: Error | null };
  }

  const paths: Path[] = (res.data ?? [])
    .map((r) => (r.status === "success" ? (r.result as unknown as Path) : null))
    .filter((p): p is Path => p !== null);

  return { paths, ...res };
}

/// Get the discounted USDC price of a path (smallest unit).
export function usePathPriceUsdc(pathId: bigint | undefined) {
  const addr = getAddresses();
  const demo = isPathDemo();
  const live = useReadContract({
    address: addr.PathRegistry,
    abi: PATH_REGISTRY_ABI,
    functionName: "getPathPriceInUsdc",
    args: pathId !== undefined ? [pathId] : undefined,
    query: { enabled: !demo && pathId !== undefined },
  });
  return live;
}

/// Get the discounted ETH price of a path (wei).
export function usePathPriceWei(pathId: bigint | undefined) {
  const addr = getAddresses();
  const demo = isPathDemo();
  const live = useReadContract({
    address: addr.PathRegistry,
    abi: PATH_REGISTRY_ABI,
    functionName: "getPathPriceInWei",
    args: pathId !== undefined ? [pathId] : undefined,
    query: { enabled: !demo && pathId !== undefined },
  });
  return live;
}

/// Write: buy a path with ETH (atomically purchases all skills in the bundle).
export function usePurchasePath() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const purchasePath = (pathId: bigint, priceInWei: bigint) =>
    writeContract({
      address: addr.PathRegistry,
      abi: PATH_REGISTRY_ABI,
      functionName: "purchasePath",
      args: [pathId],
      value: priceInWei,
    });

  const purchasePathAsync = (pathId: bigint, priceInWei: bigint) =>
    writeContractAsync({
      address: addr.PathRegistry,
      abi: PATH_REGISTRY_ABI,
      functionName: "purchasePath",
      args: [pathId],
      value: priceInWei,
    });

  return { purchasePath, purchasePathAsync, txHash: data, isPending, error };
}

/// Write: buy a path with USDC (requires prior approve on PathRegistry).
export function usePurchasePathWithUsdc() {
  const addr = getAddresses();
  const { writeContract, writeContractAsync, data, isPending, error } = useWriteContract();

  const purchasePathWithUsdc = (pathId: bigint) =>
    writeContract({
      address: addr.PathRegistry,
      abi: PATH_REGISTRY_ABI,
      functionName: "purchasePathWithUsdc",
      args: [pathId],
    });

  const purchasePathWithUsdcAsync = (pathId: bigint) =>
    writeContractAsync({
      address: addr.PathRegistry,
      abi: PATH_REGISTRY_ABI,
      functionName: "purchasePathWithUsdc",
      args: [pathId],
    });

  return { purchasePathWithUsdc, purchasePathWithUsdcAsync, txHash: data, isPending, error };
}
