"use client";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./Button";

/** Submit button that disables itself and swaps its label while the form's action runs. */
export function SubmitButton({ children, pending, variant, size, className }: { children: React.ReactNode; pending?: string; variant?: ButtonVariant; size?: "md" | "sm"; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={busy} aria-busy={busy}>
      {busy && pending ? pending : children}
    </Button>
  );
}
