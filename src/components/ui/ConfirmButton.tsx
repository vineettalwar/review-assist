"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { Button, type ButtonVariant } from "./Button";

/** Submit button that asks window.confirm before letting the surrounding form submit. */
export function ConfirmButton({
  message, onClick, variant = "ghost", size = "sm", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { message: string; variant?: ButtonVariant; size?: "md" | "sm" }) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(message)) e.preventDefault();
        else onClick?.(e);
      }}
      {...props}
    />
  );
}
