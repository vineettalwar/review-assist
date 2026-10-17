import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "line" | "ghost";

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "sm" = "md", extra?: string) {
  return cn(
    "inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-[42px] px-[18px]",
    variant === "primary" && "bg-carbon text-white hover:bg-carbon-deep",
    variant === "line" && "border border-ink bg-white font-medium text-ink hover:bg-ink hover:text-white",
    variant === "ghost" && "font-medium text-ink-2 hover:bg-surface hover:text-ink",
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm" }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
