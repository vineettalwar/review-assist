"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Password" htmlFor="password" error={state.error}>
        <Input id="password" name="password" type="password" autoComplete="current-password" autoFocus required aria-invalid={!!state.error} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
