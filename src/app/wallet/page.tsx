import { notFound } from "next/navigation";
import { nearMode } from "@/lib/near-testnet";
import { WalletFlow } from "./wallet-flow";

export const dynamic = "force-dynamic";

export default async function WalletPage({ searchParams }: {
  searchParams: Promise<{ pair?: string; checkout?: string }>;
}) {
  if (!nearMode()) notFound();
  const { pair, checkout } = await searchParams;
  return (
    <main className="brief wrap">
      <h1 className="text-3xl font-semibold">{checkout ? "NEAR testnet checkout" : "Connect your NEAR wallet"}</h1>
      <WalletFlow pair={pair} checkout={checkout} />
    </main>
  );
}
