// Homepage: клубная editorial-композиция 01–11.
// Hero → клуб → путь → соревнования → платформа → доказательства → запись.
// Все секции и функциональность сохранены; разделители — только система
// номеров + фоны, без россыпи декоративных элементов.

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import AppShell from "@/components/AppShell"
import Hero from "@/components/Hero"
import ClubAbout from "@/components/ClubAbout"
import Trainer from "@/components/Trainer"
import Benefits from "@/components/Benefits"
import StudentPath from "@/components/StudentPath"
import Schedule from "@/components/Schedule"
import Competition from "@/components/Competition"
import ClubToPlatform from "@/components/ClubToPlatform"
import LiveTournament from "@/components/LiveTournament"
import HomeTournaments from "@/components/HomeTournaments"
import HomeDirectory from "@/components/HomeDirectory"
import Gallery from "@/components/Gallery"
import Testimonials from "@/components/Testimonials"
import Pricing from "@/components/Pricing"
import CTA from "@/components/CTA"
import SectionDivider from "@/components/SectionDivider"
import SectionHeader from "@/components/ui/SectionHeader"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <AppShell>
      <Hero />
      <SectionDivider index="01" label="О клубе" kanji="極真" />
      <ClubAbout />
      <SectionDivider index="02" label="Тренер" />
      <Trainer />
      <SectionDivider index="03" label="Преимущества" />
      <Benefits />
      <SectionDivider index="04" label="Путь ученика" kanji="押忍" />
      <StudentPath />
      <Schedule />
      <SectionDivider index="05" label="Соревнования" kanji="道" />
      <Competition />
      <SectionDivider index="06" label="Платформа" kanji="空手" />
      <ClubToPlatform />
      <LiveTournament />
      <SectionDivider index="07" label="Турниры" />
      <HomeTournaments />
      <SectionDivider index="08" label="Сообщество" />
      <HomeDirectory />
      <SectionDivider index="09" label="Галерея" />
      <Gallery />
      <SectionDivider index="10" label="Тарифы" />
      <Testimonials />
      <Pricing />
      <SectionDivider index="11" label="Контакт" kanji="押忍" />
      <CTA />
      <section aria-label="Начать" className="kwf-section bg-dark-blue border-t border-white/10">
        <div className="kwf-container text-center">
          <SectionHeader
            dark
            eyebrow="KWF Platform"
            title="Найдите свой турнир"
            description="Календарь соревнований, сетки и live-результаты"
          />
          <Link href="/tournaments">
            <Button
              size="lg"
              className="bg-gold text-dark-blue hover:bg-accent-warm-light font-bold"
            >
              Найти турнир
              <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </section>
    </AppShell>
  )
}
