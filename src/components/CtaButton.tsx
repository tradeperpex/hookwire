import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

// White pill with a blue arrow disc. The primary call to action.
export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn btn-primary btn-arrow">
      {children}
      <span className="disc" aria-hidden="true">
        <ArrowRight size={20} />
      </span>
    </Link>
  );
}
