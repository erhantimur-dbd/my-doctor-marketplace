import { type LucideIcon } from "lucide-react";
import {
  Calendar,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Gift,
  Heart,
  HelpCircle,
  BookOpen,
  MessageSquare,
  Receipt,
  Settings,
  Star,
  LayoutDashboard,
  User,
  Users,
  FileText,
  Crown,
  Clock,
  UserPlus,
  BarChart3,
  FlaskConical,
  Stethoscope,
  DollarSign,
  Tag,
  ScrollText,
  Building2,
} from "lucide-react";

export interface SidebarLink {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Whether this link should show the UnreadBadge */
  hasUnreadBadge?: boolean;
}

export interface SidebarGroup {
  label?: string;
  links: SidebarLink[];
}

// ─── Doctor Portal (17 items) ────────────────────────────────────────────────

export const doctorSidebarLinks: SidebarLink[] = [
  { href: "/doctor-dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/doctor-dashboard/calendar", icon: Calendar, label: "Calendar" },
  { href: "/doctor-dashboard/bookings", icon: Clock, label: "Bookings" },
  { href: "/doctor-dashboard/patients", icon: Users, label: "Patients" },
  { href: "/doctor-dashboard/profile", icon: User, label: "Profile" },
  { href: "/doctor-dashboard/reviews", icon: Star, label: "Reviews" },
  { href: "/doctor-dashboard/payments", icon: CreditCard, label: "Payments" },
  { href: "/doctor-dashboard/invoices", icon: Receipt, label: "Invoices" },
  { href: "/doctor-dashboard/analytics", icon: BarChart3, label: "Analytics" },
  {
    href: "/doctor-dashboard/medical-testing",
    icon: FlaskConical,
    label: "Medical Testing",
  },
  { href: "/doctor-dashboard/policies", icon: FileText, label: "Policies" },
  {
    href: "/doctor-dashboard/organization",
    icon: Building2,
    label: "Organization",
  },
  {
    href: "/doctor-dashboard/organization/billing",
    icon: Crown,
    label: "License & Billing",
  },
  { href: "/doctor-dashboard/referrals", icon: UserPlus, label: "Referrals" },
  // { href: "/doctor-dashboard/prescriptions", icon: FileText, label: "Prescriptions" }, // Hidden for now
  {
    href: "/doctor-dashboard/messages",
    icon: MessageSquare,
    label: "Messages",
    hasUnreadBadge: true,
  },
  { href: "/doctor-dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/help-center", icon: BookOpen, label: "Help Center" },
  { href: "/doctor-dashboard/support", icon: HelpCircle, label: "Support" },
];

export const doctorSidebarGroups: SidebarGroup[] = [
  {
    links: [
      { href: "/doctor-dashboard", icon: LayoutDashboard, label: "Overview" },
      {
        href: "/doctor-dashboard/calendar",
        icon: Calendar,
        label: "Calendar",
      },
      { href: "/doctor-dashboard/bookings", icon: Clock, label: "Bookings" },
      { href: "/doctor-dashboard/patients", icon: Users, label: "Patients" },
    ],
  },
  {
    label: "Profile",
    links: [
      { href: "/doctor-dashboard/profile", icon: User, label: "Profile" },
      { href: "/doctor-dashboard/reviews", icon: Star, label: "Reviews" },
    ],
  },
  {
    label: "Financial",
    links: [
      {
        href: "/doctor-dashboard/payments",
        icon: CreditCard,
        label: "Payments",
      },
      { href: "/doctor-dashboard/invoices", icon: Receipt, label: "Invoices" },
      {
        href: "/doctor-dashboard/analytics",
        icon: BarChart3,
        label: "Analytics",
      },
    ],
  },
  {
    label: "Services",
    links: [
      {
        href: "/doctor-dashboard/medical-testing",
        icon: FlaskConical,
        label: "Medical Testing",
      },
      {
        href: "/doctor-dashboard/policies",
        icon: FileText,
        label: "Policies",
      },
      {
        href: "/doctor-dashboard/referrals",
        icon: UserPlus,
        label: "Referrals",
      },
      // { href: "/doctor-dashboard/prescriptions", icon: FileText, label: "Prescriptions" }, // Hidden for now
    ],
  },
  {
    label: "Organization",
    links: [
      {
        href: "/doctor-dashboard/organization",
        icon: Building2,
        label: "Organization",
      },
      {
        href: "/doctor-dashboard/organization/members",
        icon: Users,
        label: "Team Members",
      },
      {
        href: "/doctor-dashboard/organization/billing",
        icon: Crown,
        label: "License & Billing",
      },
    ],
  },
  {
    label: "Communication & Settings",
    links: [
      {
        href: "/doctor-dashboard/messages",
        icon: MessageSquare,
        label: "Messages",
        hasUnreadBadge: true,
      },
      {
        href: "/doctor-dashboard/settings",
        icon: Settings,
        label: "Settings",
      },
      { href: "/help-center", icon: BookOpen, label: "Help Center" },
      {
        href: "/doctor-dashboard/support",
        icon: HelpCircle,
        label: "Support",
      },
    ],
  },
];

// ─── Patient Portal (12 items) ───────────────────────────────────────────────

export const patientSidebarLinks: SidebarLink[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/bookings", icon: Calendar, label: "Bookings" },
  {
    href: "/dashboard/treatment-plans",
    icon: ClipboardList,
    label: "Treatment Plans",
  },
  { href: "/dashboard/payments", icon: CreditCard, label: "Payments" },
  { href: "/dashboard/invoices", icon: Receipt, label: "Invoices" },
  { href: "/dashboard/favorites", icon: Heart, label: "Saved Doctors" },
  { href: "/dashboard/family", icon: Users, label: "Family" },
  // { href: "/dashboard/prescriptions", icon: FileText, label: "Prescriptions" }, // Hidden for now
  { href: "/dashboard/reviews", icon: Star, label: "My Reviews" },
  {
    href: "/dashboard/messages",
    icon: MessageSquare,
    label: "Messages",
    hasUnreadBadge: true,
  },
  { href: "/dashboard/referrals", icon: Gift, label: "Referrals" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/help-center", icon: BookOpen, label: "Help Center" },
  { href: "/dashboard/support", icon: HelpCircle, label: "Support" },
];

// ─── Admin Portal (11 items) ─────────────────────────────────────────────────

export const adminSidebarLinks: SidebarLink[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/approvals", icon: ClipboardCheck, label: "Approvals" },
  { href: "/admin/doctors", icon: Stethoscope, label: "Doctors" },
  { href: "/admin/patients", icon: Users, label: "Patients" },
  { href: "/admin/bookings", icon: Calendar, label: "Bookings" },
  { href: "/admin/reviews", icon: Star, label: "Reviews" },
  { href: "/admin/revenue", icon: DollarSign, label: "Revenue" },
  { href: "/admin/organizations", icon: Building2, label: "Organizations" },
  { href: "/admin/licenses", icon: Crown, label: "Licenses" },
  { href: "/admin/waitlist", icon: ClipboardList, label: "Waitlist" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/support", icon: HelpCircle, label: "Support" },
  { href: "/admin/audit-log", icon: ScrollText, label: "Audit Log" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];
