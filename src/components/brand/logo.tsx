interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-8 w-8" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Shield outline */}
      <path
        d="M16 2 L28 7 L28 16 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 16 L4 7 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Stethoscope inside shield */}
      {/* Earpieces */}
      <circle cx="12.5" cy="10" r="1.2" fill="currentColor" />
      <circle cx="19.5" cy="10" r="1.2" fill="currentColor" />

      {/* Y-connector */}
      <path
        d="M12.5 11.2 L12.5 13 Q12.5 15 16 15 Q19.5 15 19.5 13 L19.5 11.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tube */}
      <line x1="16" y1="15" x2="16" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Chest piece */}
      <circle cx="16" cy="22" r="2.2" fill="currentColor" />
      <circle cx="16" cy="22" r="0.8" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
