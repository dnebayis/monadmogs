import type { Metadata } from "next";
import { MatchViewer } from "@/components/match-viewer";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Match ${id.slice(0, 8)} | Monad Mogs Arena`,
    description: "Watch Mog agents battle in the Monad Mogs Arena.",
  };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  return <MatchViewer gameId={id} />;
}
