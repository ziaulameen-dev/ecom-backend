import Link from 'next/link';
import { STORE_NAME } from '@/lib/config';

const COLUMNS = [
  { title: 'Shop', links: [['All products', '/shop'], ['Watches', '/shop?category=watches'], ['Perfumes', '/shop?category=perfumes']] },
  { title: 'Help', links: [['Track order', '/account?tab=orders'], ['Returns', '/account?tab=orders'], ['Contact', '/']] },
  { title: 'Company', links: [['About', '/'], ['Privacy', '/'], ['Terms', '/']] },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold">{STORE_NAME}</div>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Curated watches, perfumes & more. Shipped across India.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-sm font-semibold">{col.title}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-foreground">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {STORE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
