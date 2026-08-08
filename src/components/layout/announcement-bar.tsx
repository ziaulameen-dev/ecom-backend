/** Thin promo strip above the header (matches the reference theme). */
export function AnnouncementBar() {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 px-4 py-2 text-xs">
        <span>Free shipping across India on orders over ₹4,999</span>
        <span className="hidden sm:inline text-brand">● Limited-time festive sale</span>
      </div>
    </div>
  );
}
