"use client";

import { Button, Icons } from "@/components/ui";

export function DeleteProduct({ action, name }: { action: () => Promise<void>; name: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}"? Its highlights and examples are deleted too. This cannot be undone.`)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="line" className="border-danger text-danger hover:bg-danger hover:text-white">
        <Icons.Trash2 size={16} aria-hidden /> Delete product
      </Button>
    </form>
  );
}
