import { resolveLocale, TRANSLATIONS } from './i18n';

describe('resolveLocale', () => {
  it('prefers a supported user locale over the header', () => {
    expect(resolveLocale('fr-FR,fr;q=0.9', 'es')).toBe('es');
  });

  it('falls back to the first supported Accept-Language tag', () => {
    expect(resolveLocale('de-DE,fr;q=0.8,en;q=0.5', null)).toBe('fr');
  });

  it('defaults to English when nothing matches', () => {
    expect(resolveLocale('de-DE', null)).toBe('en');
    expect(resolveLocale(undefined, undefined)).toBe('en');
  });

  it('ignores an unsupported user locale and uses the header', () => {
    expect(resolveLocale('ar', 'de')).toBe('ar');
  });
});

describe('TRANSLATIONS', () => {
  it('has all four purposes for every locale', () => {
    const purposes = [
      'login',
      'email-change-old',
      'email-change-new',
      'account-deletion',
    ] as const;
    for (const bundle of Object.values(TRANSLATIONS)) {
      for (const p of purposes) {
        expect(bundle.purposes[p].subject).toBeTruthy();
        expect(bundle.purposes[p].reason).toBeTruthy();
      }
    }
  });
});
