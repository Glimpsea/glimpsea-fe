import Image from "next/image";
import Link from "next/link";

export function HeaderLogo({ href }: { href: string }) {
  return (
    <Link className="header-logo" href={href}>
      <Image src="/glimpsea-logo.svg" alt="Glimpsea" width={91} height={51} loading="eager" unoptimized />
    </Link>
  );
}
