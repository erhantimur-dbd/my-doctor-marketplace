import {
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Baby,
  Activity,
  Flower,
  Ear,
  Smile,
  Apple,
  Droplets,
  Wind,
  Shield,
  Scan,
} from "lucide-react";

/**
 * Decorative specialty icons scattered across a hero section.
 * Wrap in a `relative` container; icons are absolutely positioned.
 *
 * @param hideOnMobile — adds `hidden md:block` to hide on small screens
 * @param variant — "light" for light backgrounds (colourful icons), "dark" for blue/gradient backgrounds (white icons)
 */
export function HeroSpecialtyIcons({
  hideOnMobile,
  variant = "light",
}: {
  hideOnMobile?: boolean;
  variant?: "light" | "dark";
} = {}) {
  // On dark (blue gradient) backgrounds use subtle white icons;
  // on light backgrounds use colourful semi-transparent icons.
  const d = variant === "dark";

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none${hideOnMobile ? " hidden md:block" : ""}`}
      aria-hidden="true"
    >
      {/* Top row */}
      <Stethoscope className={`absolute top-[8%] left-[2%] h-8 w-8 rotate-12 ${d ? "text-white/[0.07]" : "text-teal-400/20"}`} />
      <Heart className={`absolute top-[12%] left-[14%] h-6 w-6 -rotate-6 ${d ? "text-white/[0.05]" : "text-rose-400/20"}`} />
      <Flower className={`absolute top-[5%] left-[25%] h-6 w-6 rotate-[18deg] ${d ? "text-white/[0.06]" : "text-pink-400/20"}`} />
      <Activity className={`absolute top-[15%] left-[36%] h-7 w-7 -rotate-12 ${d ? "text-white/[0.05]" : "text-orange-400/20"}`} />
      <Brain className={`absolute top-[6%] left-[60%] h-8 w-8 rotate-6 ${d ? "text-white/[0.07]" : "text-purple-400/20"}`} />
      <Eye className={`absolute top-[14%] left-[73%] h-6 w-6 -rotate-6 ${d ? "text-white/[0.05]" : "text-blue-400/20"}`} />
      <Ear className={`absolute top-[4%] left-[84%] h-6 w-6 rotate-[10deg] ${d ? "text-white/[0.06]" : "text-amber-400/20"}`} />
      <Baby className={`absolute top-[10%] left-[94%] h-7 w-7 -rotate-12 ${d ? "text-white/[0.05]" : "text-pink-400/20"}`} />

      {/* Middle-left + middle-right edges */}
      <Scan className={`absolute top-[40%] left-[1%] h-6 w-6 rotate-[20deg] ${d ? "text-white/[0.06]" : "text-indigo-400/20"}`} />
      <Smile className={`absolute top-[55%] left-[4%] h-5 w-5 -rotate-[8deg] ${d ? "text-white/[0.05]" : "text-yellow-400/20"}`} />
      <Apple className={`absolute top-[35%] right-[2%] h-7 w-7 rotate-12 ${d ? "text-white/[0.07]" : "text-green-400/20"}`} />
      <Wind className={`absolute top-[52%] right-[5%] h-6 w-6 -rotate-[15deg] ${d ? "text-white/[0.05]" : "text-sky-400/20"}`} />

      {/* Bottom row */}
      <Activity className={`absolute bottom-[12%] left-[3%] h-6 w-6 -rotate-[20deg] ${d ? "text-white/[0.05]" : "text-emerald-400/20"}`} />
      <Apple className={`absolute bottom-[8%] left-[13%] h-7 w-7 rotate-12 ${d ? "text-white/[0.06]" : "text-lime-400/20"}`} />
      <Droplets className={`absolute bottom-[15%] left-[24%] h-5 w-5 -rotate-6 ${d ? "text-white/[0.05]" : "text-cyan-400/20"}`} />
      <Shield className={`absolute bottom-[6%] left-[35%] h-6 w-6 rotate-[15deg] ${d ? "text-white/[0.07]" : "text-emerald-400/20"}`} />
      <Baby className={`absolute bottom-[18%] left-[48%] h-5 w-5 rotate-6 ${d ? "text-white/[0.05]" : "text-fuchsia-400/20"}`} />
      <Heart className={`absolute bottom-[10%] left-[58%] h-5 w-5 rotate-[22deg] ${d ? "text-white/[0.06]" : "text-red-400/20"}`} />
      <Flower className={`absolute bottom-[5%] left-[68%] h-6 w-6 -rotate-12 ${d ? "text-white/[0.05]" : "text-violet-400/20"}`} />
      <Activity className={`absolute bottom-[14%] left-[77%] h-7 w-7 rotate-[25deg] ${d ? "text-white/[0.06]" : "text-amber-400/20"}`} />
      <Droplets className={`absolute bottom-[8%] left-[87%] h-5 w-5 -rotate-[15deg] ${d ? "text-white/[0.05]" : "text-blue-400/20"}`} />
      <Brain className={`absolute bottom-[16%] left-[95%] h-6 w-6 rotate-6 ${d ? "text-white/[0.07]" : "text-purple-400/20"}`} />
    </div>
  );
}
