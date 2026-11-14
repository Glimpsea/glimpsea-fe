import { cookies } from "next/headers";
import { reportSessionOwner } from "@/lib/extension-demo";
import { nearOwner, nearSessionCookie, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export async function reportOwner(id: string) {
  const jar = await cookies();
  return reportSessionOwner(jar.get(`glimpsea_report_${id}`)?.value, id)
    ?? (nearMode() ? nearOwner(sessionAccount(jar.get(nearSessionCookie)?.value)) : undefined);
}
