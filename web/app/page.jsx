import Background from '@/components/Background';
import Boot from '@/components/Boot';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Stats from '@/components/Stats';
import Gap from '@/components/Gap';
import How from '@/components/How';
import Features from '@/components/Features';
import { Faq, Final, Footer, Pricing, Reviews, Trust } from '@/components/Sections';

export default function Page() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <Background />
      <Boot />
      <Nav />
      <main id="main">
        <Hero />
        <Stats />
        <Gap />
        <How />
        <Features />
        <Trust />
        <Reviews />
        <Pricing />
        <Faq />
        <Final />
      </main>
      <Footer />
    </>
  );
}
