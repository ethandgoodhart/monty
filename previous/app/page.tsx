import { Navbar } from "@/app/components/navbar";
import { Hero } from "@/app/components/hero";
import { Features } from "@/app/components/features";
import { HowItWorks } from "@/app/components/how-it-works";
import { Partners } from "@/app/components/partners";
import { Testimonials } from "@/app/components/testimonials";
import { CtaBanner } from "@/app/components/cta-banner";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#111]">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Partners />
      <Testimonials />
      <CtaBanner />
    </main>
  );
}
