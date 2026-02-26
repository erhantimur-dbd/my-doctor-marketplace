/**
 * Color scheme for each medical specialty.
 * Soft pastel backgrounds with medium-saturated icons
 * for a calm, professional, trustworthy healthcare feel.
 *
 * Colors are semantically chosen:
 *   Cardiology → rose (heart), Neurology → violet (brain),
 *   Ophthalmology → sky (vision), Dentistry → emerald (fresh), etc.
 */

export interface SpecialtyColor {
  /** Icon container background */
  bg: string;
  /** Icon color */
  text: string;
  /** Icon container hover background (requires `group` on parent) */
  hoverBg: string;
  /** Card hover border color */
  border: string;
}

const colors: Record<string, SpecialtyColor> = {
  "general-practice": { bg: "bg-teal-50", text: "text-teal-600", hoverBg: "group-hover:bg-teal-100", border: "hover:border-teal-300" },
  "cardiology":       { bg: "bg-rose-50", text: "text-rose-600", hoverBg: "group-hover:bg-rose-100", border: "hover:border-rose-300" },
  "dermatology":      { bg: "bg-amber-50", text: "text-amber-600", hoverBg: "group-hover:bg-amber-100", border: "hover:border-amber-300" },
  "orthopedics":      { bg: "bg-indigo-50", text: "text-indigo-600", hoverBg: "group-hover:bg-indigo-100", border: "hover:border-indigo-300" },
  "neurology":        { bg: "bg-violet-50", text: "text-violet-600", hoverBg: "group-hover:bg-violet-100", border: "hover:border-violet-300" },
  "psychiatry":       { bg: "bg-purple-50", text: "text-purple-600", hoverBg: "group-hover:bg-purple-100", border: "hover:border-purple-300" },
  "psychology":       { bg: "bg-fuchsia-50", text: "text-fuchsia-600", hoverBg: "group-hover:bg-fuchsia-100", border: "hover:border-fuchsia-300" },
  "ophthalmology":    { bg: "bg-sky-50", text: "text-sky-600", hoverBg: "group-hover:bg-sky-100", border: "hover:border-sky-300" },
  "ent":              { bg: "bg-cyan-50", text: "text-cyan-600", hoverBg: "group-hover:bg-cyan-100", border: "hover:border-cyan-300" },
  "gynecology":       { bg: "bg-pink-50", text: "text-pink-600", hoverBg: "group-hover:bg-pink-100", border: "hover:border-pink-300" },
  "urology":          { bg: "bg-slate-100", text: "text-slate-600", hoverBg: "group-hover:bg-slate-200", border: "hover:border-slate-300" },
  "gastroenterology": { bg: "bg-lime-50", text: "text-lime-600", hoverBg: "group-hover:bg-lime-100", border: "hover:border-lime-300" },
  "endocrinology":    { bg: "bg-yellow-50", text: "text-yellow-600", hoverBg: "group-hover:bg-yellow-100", border: "hover:border-yellow-300" },
  "pulmonology":      { bg: "bg-green-50", text: "text-green-600", hoverBg: "group-hover:bg-green-100", border: "hover:border-green-300" },
  "oncology":         { bg: "bg-red-50", text: "text-red-600", hoverBg: "group-hover:bg-red-100", border: "hover:border-red-300" },
  "pediatrics":       { bg: "bg-orange-50", text: "text-orange-600", hoverBg: "group-hover:bg-orange-100", border: "hover:border-orange-300" },
  "dentistry":        { bg: "bg-emerald-50", text: "text-emerald-600", hoverBg: "group-hover:bg-emerald-100", border: "hover:border-emerald-300" },
  "aesthetic-medicine":{ bg: "bg-pink-50", text: "text-pink-600", hoverBg: "group-hover:bg-pink-100", border: "hover:border-pink-300" },
  "physiotherapy":    { bg: "bg-blue-50", text: "text-blue-600", hoverBg: "group-hover:bg-blue-100", border: "hover:border-blue-300" },
  "radiology":        { bg: "bg-zinc-100", text: "text-zinc-600", hoverBg: "group-hover:bg-zinc-200", border: "hover:border-zinc-300" },
  "nutrition":        { bg: "bg-lime-50", text: "text-lime-600", hoverBg: "group-hover:bg-lime-100", border: "hover:border-lime-300" },
  "allergy":          { bg: "bg-amber-50", text: "text-amber-600", hoverBg: "group-hover:bg-amber-100", border: "hover:border-amber-300" },
  "rheumatology":     { bg: "bg-orange-50", text: "text-orange-600", hoverBg: "group-hover:bg-orange-100", border: "hover:border-orange-300" },
  "nephrology":       { bg: "bg-teal-50", text: "text-teal-600", hoverBg: "group-hover:bg-teal-100", border: "hover:border-teal-300" },
};

const fallback: SpecialtyColor = {
  bg: "bg-gray-50",
  text: "text-gray-600",
  hoverBg: "group-hover:bg-gray-100",
  border: "hover:border-gray-300",
};

export function getSpecialtyColor(slug: string): SpecialtyColor {
  return colors[slug] || fallback;
}
