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
 * Colourful decorative specialty icons scattered across a hero section.
 * Designed for light backgrounds (primary/5 gradient).
 * Wrap in a `relative` container; icons are absolutely positioned.
 *
 * @param hideOnMobile  — adds `hidden md:block` to hide on small screens
 */
export function HeroSpecialtyIcons({ hideOnMobile }: { hideOnMobile?: boolean } = {}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none${hideOnMobile ? " hidden md:block" : ""}`}
      aria-hidden="true"
    >
      {/* Top row */}
      <Stethoscope className="absolute top-[8%] left-[2%] h-8 w-8 text-teal-400/20 rotate-12" />
      <Heart className="absolute top-[12%] left-[14%] h-6 w-6 text-rose-400/20 -rotate-6" />
      <Flower className="absolute top-[5%] left-[25%] h-6 w-6 text-pink-400/20 rotate-[18deg]" />
      <Activity className="absolute top-[15%] left-[36%] h-7 w-7 text-orange-400/20 -rotate-12" />
      <Brain className="absolute top-[6%] left-[60%] h-8 w-8 text-purple-400/20 rotate-6" />
      <Eye className="absolute top-[14%] left-[73%] h-6 w-6 text-blue-400/20 -rotate-6" />
      <Ear className="absolute top-[4%] left-[84%] h-6 w-6 text-amber-400/20 rotate-[10deg]" />
      <Baby className="absolute top-[10%] left-[94%] h-7 w-7 text-pink-400/20 -rotate-12" />

      {/* Middle-left + middle-right edges */}
      <Scan className="absolute top-[40%] left-[1%] h-6 w-6 text-indigo-400/20 rotate-[20deg]" />
      <Smile className="absolute top-[55%] left-[4%] h-5 w-5 text-yellow-400/20 -rotate-[8deg]" />
      <Apple className="absolute top-[35%] right-[2%] h-7 w-7 text-green-400/20 rotate-12" />
      <Wind className="absolute top-[52%] right-[5%] h-6 w-6 text-sky-400/20 -rotate-[15deg]" />

      {/* Bottom row */}
      <Activity className="absolute bottom-[12%] left-[3%] h-6 w-6 text-emerald-400/20 -rotate-[20deg]" />
      <Apple className="absolute bottom-[8%] left-[13%] h-7 w-7 text-lime-400/20 rotate-12" />
      <Droplets className="absolute bottom-[15%] left-[24%] h-5 w-5 text-cyan-400/20 -rotate-6" />
      <Shield className="absolute bottom-[6%] left-[35%] h-6 w-6 text-emerald-400/20 rotate-[15deg]" />
      <Baby className="absolute bottom-[18%] left-[48%] h-5 w-5 text-fuchsia-400/20 rotate-6" />
      <Heart className="absolute bottom-[10%] left-[58%] h-5 w-5 text-red-400/20 rotate-[22deg]" />
      <Flower className="absolute bottom-[5%] left-[68%] h-6 w-6 text-violet-400/20 -rotate-12" />
      <Activity className="absolute bottom-[14%] left-[77%] h-7 w-7 text-amber-400/20 rotate-[25deg]" />
      <Droplets className="absolute bottom-[8%] left-[87%] h-5 w-5 text-blue-400/20 -rotate-[15deg]" />
      <Brain className="absolute bottom-[16%] left-[95%] h-6 w-6 text-purple-400/20 rotate-6" />
    </div>
  );
}
