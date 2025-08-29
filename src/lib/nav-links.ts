import { LayoutDashboard, TestTubeDiagonal, type LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navLinks: NavLink[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/test-automation",
    label: "Test Otomasyonu",
    icon: TestTubeDiagonal,
  },
];

