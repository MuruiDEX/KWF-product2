import Navbar from "@/components/Navbar"
import Hero from "@/components/Hero"
import WhyChooseUs from "@/components/WhyChooseUs"
import Benefits from "@/components/Benefits"
import Trainer from "@/components/Trainer"
import Schedule from "@/components/Schedule"
import Pricing from "@/components/Pricing"
import Gallery from "@/components/Gallery"
import Testimonials from "@/components/Testimonials"
import FAQ from "@/components/FAQ"
import CTA from "@/components/CTA"
import LiveTournament from "@/components/LiveTournament"
import StatsBand from "@/components/StatsBand"
import Athletes from "@/components/Athletes"
import LatestNews from "@/components/LatestNews"
import Footer from "@/components/Footer"
import SectionDivider from "@/components/SectionDivider"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <LiveTournament />
        <SectionDivider />
        <WhyChooseUs />
        <StatsBand />
        <Benefits />
        <Trainer />
        <Athletes />
        <Schedule />
        <Pricing />
        <Gallery />
        <LatestNews />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}