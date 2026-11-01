import './globals.css';

export const metadata = {
  title: 'TA Dashboard',
  description: 'Talent Acquisition dashboard',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
