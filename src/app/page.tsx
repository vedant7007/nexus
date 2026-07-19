import { LandingNav } from '@/components/marketing/LandingNav';
import { DemoSection } from '@/components/marketing/sections/DemoSection';
import { FeaturesSection } from '@/components/marketing/sections/FeaturesSection';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Hero } from '@/components/marketing/sections/Hero';
import { HowSection } from '@/components/marketing/sections/HowSection';
import { LanguageTicker } from '@/components/marketing/sections/LanguageTicker';
import { SiteFooter } from '@/components/marketing/sections/SiteFooter';
import { StackSection } from '@/components/marketing/sections/StackSection';
import { StatsSection } from '@/components/marketing/sections/StatsSection';
import { TrustSection } from '@/components/marketing/sections/TrustSection';
import { WhatSection } from '@/components/marketing/sections/WhatSection';

// A server component that composes small client "islands" (nav, typewriter,
// scroll-reveal, count-ups, the console preview) over static, crawlable HTML. No
// Firebase or chart imports, so it stays on the Lighthouse critical-path budget.
export default function HomePage() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <LandingNav />

      <main id="main">
        <Hero />
        <LanguageTicker />
        <WhatSection />
        <TrustSection />
        <HowSection />
        <FeaturesSection />
        <DemoSection />
        <StatsSection />
        <StackSection />
        <FinalCta />
      </main>

      <SiteFooter />
    </>
  );
}
