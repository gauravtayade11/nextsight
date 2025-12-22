import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Comparison } from "@/components/sections/comparison";
import { CTA } from "@/components/sections/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Comparison />
      <CTA />
    </>
  );
}
