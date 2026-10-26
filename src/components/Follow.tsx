import { SITE } from "@/lib/site";
import { FollowX } from "./XLink";
import { Reveal } from "./Reveal";

export function Follow() {
  return (
    <section id="follow" className="section" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
        <Reveal>
          <p className="label">Follow along</p>
          <h2 className="display-2" style={{ marginTop: 16 }}>
            Updates live on X.
          </h2>
          <p className="lead" style={{ marginTop: 16, marginInline: "auto" }}>
            New features, contract changes and keeper news go out at {SITE.xHandle} first.
          </p>
        </Reveal>
        <Reveal>
          <FollowX className="btn btn-primary" style={{ minHeight: 52, padding: "0 28px" }} />
        </Reveal>
      </div>
    </section>
  );
}
