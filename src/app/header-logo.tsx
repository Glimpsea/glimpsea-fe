import Image from "next/image";
import Link from "next/link";

export function HeaderLogo({ href }: { href: string }) {
  return (
    <Link className="header-logo wordmark" href={href}>
      <Image src="/glimpsea-logo.svg" alt="" width={91} height={51} loading="eager" unoptimized />
      Glimpsea
    </Link>
  );
}
