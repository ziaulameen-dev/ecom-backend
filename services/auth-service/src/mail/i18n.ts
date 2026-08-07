/**
 * Email localization. Each supported locale provides the per-purpose subject +
 * reason and the shared body labels. English is the fallback for any locale or
 * key that's missing. Add a language by adding one entry to TRANSLATIONS.
 */

/** Why an OTP is being sent — drives the subject and body copy. */
export type OtpPurpose =
  | 'login'
  | 'email-change-old'
  | 'email-change-new'
  | 'account-deletion';

export type Locale = 'en' | 'es' | 'fr' | 'ar';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'fr', 'ar'];

/** Locales written right-to-left (affects the HTML `dir` attribute). */
export const RTL_LOCALES: Locale[] = ['ar'];

interface PurposeCopy {
  subject: string;
  reason: string;
}

interface Labels {
  codeLabel: string;
  expires: (minutes: number) => string;
  sentTo: (email: string) => string;
  ignore: string;
}

interface Bundle {
  purposes: Record<OtpPurpose, PurposeCopy>;
  labels: Labels;
}

export const TRANSLATIONS: Record<Locale, Bundle> = {
  en: {
    purposes: {
      login: {
        subject: 'Your sign-in code',
        reason: 'Use this code to sign in to your account.',
      },
      'email-change-old': {
        subject: 'Confirm your email change',
        reason:
          'We received a request to change the email address on your account. ' +
          'Enter this code to confirm it’s really you.',
      },
      'email-change-new': {
        subject: 'Verify your new email',
        reason:
          'Confirm this address to finish changing the email on your account.',
      },
      'account-deletion': {
        subject: 'Confirm account deletion',
        reason:
          'Enter this code to permanently deactivate your account. ' +
          'This cannot be undone.',
      },
    },
    labels: {
      codeLabel: 'Code',
      expires: (m) => `This code expires in ${m} minutes.`,
      sentTo: (email) => `This message was sent to ${email}.`,
      ignore:
        'If you didn’t request it, you can safely ignore this email — no changes will be made.',
    },
  },

  es: {
    purposes: {
      login: {
        subject: 'Tu código de acceso',
        reason: 'Usa este código para iniciar sesión en tu cuenta.',
      },
      'email-change-old': {
        subject: 'Confirma el cambio de correo',
        reason:
          'Recibimos una solicitud para cambiar el correo de tu cuenta. ' +
          'Introduce este código para confirmar que eres tú.',
      },
      'email-change-new': {
        subject: 'Verifica tu nuevo correo',
        reason:
          'Confirma esta dirección para completar el cambio de correo de tu cuenta.',
      },
      'account-deletion': {
        subject: 'Confirma la eliminación de la cuenta',
        reason:
          'Introduce este código para desactivar tu cuenta de forma permanente. ' +
          'Esto no se puede deshacer.',
      },
    },
    labels: {
      codeLabel: 'Código',
      expires: (m) => `Este código caduca en ${m} minutos.`,
      sentTo: (email) => `Este mensaje se envió a ${email}.`,
      ignore:
        'Si no lo solicitaste, puedes ignorar este correo — no se hará ningún cambio.',
    },
  },

  fr: {
    purposes: {
      login: {
        subject: 'Votre code de connexion',
        reason: 'Utilisez ce code pour vous connecter à votre compte.',
      },
      'email-change-old': {
        subject: 'Confirmez le changement d’e-mail',
        reason:
          'Nous avons reçu une demande de changement de l’adresse e-mail de votre compte. ' +
          'Saisissez ce code pour confirmer que c’est bien vous.',
      },
      'email-change-new': {
        subject: 'Vérifiez votre nouvelle adresse e-mail',
        reason:
          'Confirmez cette adresse pour terminer le changement d’e-mail de votre compte.',
      },
      'account-deletion': {
        subject: 'Confirmez la suppression du compte',
        reason:
          'Saisissez ce code pour désactiver définitivement votre compte. ' +
          'Cette action est irréversible.',
      },
    },
    labels: {
      codeLabel: 'Code',
      expires: (m) => `Ce code expire dans ${m} minutes.`,
      sentTo: (email) => `Ce message a été envoyé à ${email}.`,
      ignore:
        'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail — aucune modification ne sera effectuée.',
    },
  },

  ar: {
    purposes: {
      login: {
        subject: 'رمز تسجيل الدخول',
        reason: 'استخدم هذا الرمز لتسجيل الدخول إلى حسابك.',
      },
      'email-change-old': {
        subject: 'تأكيد تغيير البريد الإلكتروني',
        reason:
          'تلقّينا طلبًا لتغيير البريد الإلكتروني لحسابك. ' +
          'أدخل هذا الرمز لتأكيد أنك أنت.',
      },
      'email-change-new': {
        subject: 'تحقّق من بريدك الإلكتروني الجديد',
        reason: 'أكّد هذا العنوان لإتمام تغيير البريد الإلكتروني لحسابك.',
      },
      'account-deletion': {
        subject: 'تأكيد حذف الحساب',
        reason:
          'أدخل هذا الرمز لإلغاء تنشيط حسابك نهائيًا. لا يمكن التراجع عن ذلك.',
      },
    },
    labels: {
      codeLabel: 'الرمز',
      expires: (m) => `تنتهي صلاحية هذا الرمز خلال ${m} دقائق.`,
      sentTo: (email) => `أُرسلت هذه الرسالة إلى ${email}.`,
      ignore:
        'إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد الإلكتروني بأمان — لن يتم إجراء أي تغيير.',
    },
  },
};

/**
 * Pick a supported locale: prefer the user's stored preference, else the first
 * supported language from an Accept-Language header, else English.
 */
export function resolveLocale(
  acceptLanguage?: string | null,
  userLocale?: string | null,
): Locale {
  if (userLocale && isSupported(userLocale)) return userLocale;

  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (isSupported(tag)) return tag;
  }
  return 'en';
}

function isSupported(tag: string): tag is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(tag);
}
