"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
];

const SHAPES = ["circle", "square", "triangle"] as const;

interface Particle {
  id: number;
  x: number;
  color: string;
  shape: (typeof SHAPES)[number];
  size: number;
  rotation: number;
  delay: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.5,
  }));
}

function ParticleShape({
  shape,
  color,
  size,
}: {
  shape: string;
  color: string;
  size: number;
}) {
  if (shape === "circle") {
    return (
      <div
        className="rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    );
  }
  if (shape === "square") {
    return (
      <div
        className="rounded-sm"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    );
  }
  // triangle
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      }}
    />
  );
}

interface ConfettiProps {
  /** Number of particles */
  count?: number;
  /** Duration in seconds before confetti disappears */
  duration?: number;
  /** Whether to show confetti */
  active?: boolean;
}

export function Confetti({
  count = 50,
  duration = 3,
  active = true,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setParticles(generateParticles(count));
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [active, count, duration]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                x: `${p.x}vw`,
                y: "-10%",
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: "110vh",
                rotate: p.rotation + 720,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: duration * 0.8 + Math.random() * duration * 0.4,
                delay: p.delay,
                ease: "easeIn",
              }}
              className="absolute"
            >
              <ParticleShape
                shape={p.shape}
                color={p.color}
                size={p.size}
              />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
