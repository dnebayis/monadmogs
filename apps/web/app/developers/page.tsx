import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Developers | Monad Mogs",
  description: "API docs, builder kit, and code examples for Monad Mogs.",
};

export default function DevelopersPage() {
  redirect("/#docs");
}
