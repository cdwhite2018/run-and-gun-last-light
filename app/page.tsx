import type { Metadata } from "next";
import Game from "./Game";

export const metadata: Metadata = {
  title: "Run & Gun: Last Light",
  description: "Choose an unlikely hero, clear the ruins, and reach extraction.",
};

export default function Home() {
  return <Game />;
}
