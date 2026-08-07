import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ecom — demo storefront',
  description: 'Demo storefront for the ecom-backend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Nav />
          <main className="container py-8">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
