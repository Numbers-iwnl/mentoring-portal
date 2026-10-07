import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-white to-champagne-300 text-graphite-950 shadow-soft hover:from-champagne-50 hover:to-white",
  dark: "bg-graphite-950 text-white shadow-soft hover:bg-graphite-850",
  secondary: "border border-[rgba(0,6,35,0.12)] bg-white/80 text-ink shadow-sm hover:border-champagne-500 hover:bg-white",
  ghost: "text-[rgba(245,247,248,0.82)] hover:bg-white/10 hover:text-white",
  danger: "bg-red-900 text-white hover:bg-red-800"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: ButtonVariant }) {
  return (
    <Link
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
