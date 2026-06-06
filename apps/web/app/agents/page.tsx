import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mog Agent Identity | Monad Mogs",
  description: "Connect a wallet, generate an AgentURI, and register a Mog agent through ERC-8004.",
};

export default function AgentsPage() {
  redirect("/#agents");
}
