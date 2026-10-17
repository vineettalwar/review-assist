import type { Metadata } from "next";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "New brand · Review Assist Admin" };

export default function OnboardingPage() {
  return <Wizard />;
}
