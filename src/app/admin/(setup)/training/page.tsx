import { redirect } from "next/navigation";

/** Training lives on each product page now (playground + examples). */
export default function TrainingRedirect() {
  redirect("/admin/products");
}
