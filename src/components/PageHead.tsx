import type { ReactNode } from "react";

// Serif kicker over a gradient sans title, used at the top of every inner page.
export function PageHead({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <header>
      <p className="kicker rise" style={{ ["--i" as string]: 0 }}>
        {kicker}
      </p>
      <h1 className="page-title rise" style={{ ["--i" as string]: 1 }}>
        {title}
      </h1>
      <p className="lead rise" style={{ ["--i" as string]: 2, marginTop: 28, maxWidth: "56ch" }}>
        {children}
      </p>
    </header>
  );
}
