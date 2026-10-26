// A solid hook, cut once by the wire.
export function Mark({
  size = 24,
  className,
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="30 0 340 500"
      width={(size * 340) / 500}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M270 0H370V51.7L270 153.7Z" />
      <path d="M270 186.3L370 84.3V330A170 170 0 0 1 30 330V250L130 190V330A70 70 0 0 0 270 330Z" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "1.3rem",
        letterSpacing: "-0.045em",
        lineHeight: 1,
      }}
    >
      hookwire
    </span>
  );
}
