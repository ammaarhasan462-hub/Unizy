import Background from '@/components/Background';
import Boot from '@/components/Boot';
import Intro from '@/components/Intro';
import Nav from '@/components/Nav';
import { StoryTop, StoryEnd } from '@/components/Story';
import { Faq, Footer, Pricing, Reviews, Trust } from '@/components/Sections';

export default function Page() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <Intro />
      <Background />
      <Boot />
      <Nav />
      <main id="main">
        <StoryTop />
        <Trust />
        <Reviews />
        <Pricing />
        <Faq />
        <StoryEnd />
      </main>
      <Footer />
    </>
  );
}
