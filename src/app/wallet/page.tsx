import { notFound } from "next/navigation";
import { nearMode } from "@/lib/near-testnet";
import { WalletFlow } from "./wallet-flow";

export const dynamic = "force-dynamic";

export default async function WalletPage({ searchParams }: {
  searchParams: Promise<{ pair?: string; checkout?: string; panel?: string }>;
}) {
  if (!nearMode()) notFound();
  const { pair, checkout, panel } = await searchParams;
  const panelOrigin = typeof panel === "string" && /^chrome-extension:\/\/[a-p]{32}$/.test(panel) ? panel : undefined;
  return (
    <main className={panelOrigin ? "p-2" : "brief wrap"}>
      <h1 className={panelOrigin ? "text-xl font-semibold" : "text-3xl font-semibold"}>{checkout ? "NEAR testnet checkout" : "Connect your NEAR wallet"}</h1>
      <WalletFlow pair={pair} checkout={checkout} panelOrigin={panelOrigin} />
    </main>
  );
}
