import { Controls } from "@/components/Controls";
import { HeroSection } from "@/components/HeroSection";
import { Simulator } from "@/components/Simulator";
import { How } from "@/components/How";
import { Roadmap } from "@/components/Roadmap";
import { Token } from "@/components/Token";

export default function Page() {
  return (
    <>
      <HeroSection />
      <Simulator />
      <How />
      <Controls />
      <Roadmap />
      <Token />
    </>
  );
}
