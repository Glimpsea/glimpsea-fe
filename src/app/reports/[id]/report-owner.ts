import { cookies } from "next/headers";
import { reportSessionOwner } from "@/lib/extension-demo";
import { nearOwner, nearSessionCookie, sessionAccount } from "@/lib/near-auth";
import { nearMode } from "@/lib/near-testnet";

export async function reportOwner(id: string, cookieName = `glimpsea_report_${id}`) {
  const jar = await cookies();
  return reportSessionOwner(jar.get(cookieName)?.value, id)
    ?? (nearMode() ? nearOwner(sessionAccount(jar.get(nearSessionCookie)?.value)) : undefined);
}
