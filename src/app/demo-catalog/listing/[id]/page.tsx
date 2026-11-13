import { demoListing } from "@/lib/demo-catalog";
import { notFound } from "next/navigation";

export default async function DemoListing({ params }: { params: Promise<{ id: string }> }) {
  const listing = demoListing((await params).id);
  if (!listing) notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <p>Glimpsea demo · Synthetic listing</p>
      <h1 className="text-3xl font-bold">{listing.title}</h1>
      <p>{listing.activePrice ?? "Price unavailable"}</p>
    </main>
  );
}
