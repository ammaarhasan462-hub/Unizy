import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jet', display: 'swap' });

const TITLE = 'SaveMyGrade · The mark scheme your uni never gave you.';
const DESC =
  "At A-level you had mark schemes. At UCL you don't. Write an answer to an exam question in your module and get it marked against your department's own grading criteria, with the changes that would move you up a class.";

export const metadata = {
  metadataBase: new URL('https://unizy.uk'),
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/' },
  openGraph: { title: TITLE, description: 'Exam practice and marking for every UCL module.', type: 'website', url: 'https://unizy.uk/', images: ['/assets/og.png'] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: [{ url: '/assets/favicon.svg', type: 'image/svg+xml' }] },
};

export const viewport = { themeColor: '#06060b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
