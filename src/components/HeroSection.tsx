"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ChainStatus } from "./ChainStatus";
import { CtaButton } from "./CtaButton";
import { FollowX } from "./XLink";

const STREAM = "https://stream.mux.com/T6oQJQ02cQ6N01TR6iHwZkKFkbepS34dkkIc9iukgy400g.m3u8";
// First frame of the stream, served from this site, so the poster is the same picture as the video.
const POSTER = "/hero-poster-v2.jpg";

export function HeroSection() {
  preload(POSTER, { as: "image", fetchPriority: "high" });
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let hls: { destroy: () => void } | undefined;
    let dead = false;

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (dead) return;
      if (Hls.isSupported()) {
        const h = new Hls();
        hls = h;
        h.loadSource(STREAM);
        h.attachMedia(video);
        h.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = STREAM;
        video.addEventListener("loadedmetadata", () => video.play().catch(() => {}), { once: true });
      }
    })();

    return () => {
      dead = true;
      hls?.destroy();
    };
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: `url(${POSTER})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <video
        ref={ref}
        className="hero-video absolute inset-0 h-full w-full object-cover opacity-60"
        poster={POSTER}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute top-[-20%] left-[20%] h-[600px] w-[600px] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen" />
      <div className="pointer-events-none absolute right-[20%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-900/20 blur-[120px] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

      <div className="relative z-10 mx-auto mt-20 flex max-w-5xl flex-col items-center gap-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="flex justify-center">
            <ChainStatus />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl leading-[1.1] text-white sm:text-5xl lg:text-[48px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Rules that act while you sleep
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-6xl leading-[0.9] font-semibold tracking-tighter sm:text-8xl lg:text-[136px]"
            style={{
              fontFamily: "var(--font-sans)",
              background: "linear-gradient(to bottom, #ffffff 0%, #ffffff 45%, #b4c0ff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              paddingBottom: "0.08em",
            }}
          >
            Hold the line.
          </motion.h1>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-xl text-lg leading-[1.65] sm:text-[20px]"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          Set a take profit, stop loss or trailing stop on any token on Robinhood Chain. Your tokens stay in your wallet until the rule fires.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col items-center gap-6 sm:flex-row"
        >
          <CtaButton href="/app">Open the app</CtaButton>
          <Link href="#try" className="textlink group">
            Try a rule on paper
            <ArrowRight size={18} />
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="label"
        >
          Non-custodial. Beta. Not audited.
        </motion.p>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1 }}>
          <FollowX />
        </motion.div>
      </div>
    </section>
  );
}
