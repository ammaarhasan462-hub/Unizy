import './globals.css';

const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

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

export const viewport = { themeColor: '#F4F4EF', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
