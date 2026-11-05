// Disposable & Temporary Email Domains Blacklist
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'mytemp.email',
  'inboxkitten.com',
  'temp-mail.org',
  'tempmailo.com',
  'crazymailing.com',
  'emailondeck.com',
  'burnermail.io',
  'mohmal.com',
  'nada.ltd',
  'fakemailgenerator.com',
  'generator.email',
]);

export interface EmailValidationResult {
  isValid: boolean;
  errorMessage?: string;
  cleanEmail?: string;
}

export function validateEmail(rawEmail: string): EmailValidationResult {
  if (!rawEmail || !rawEmail.trim()) {
    return {
      isValid: false,
      errorMessage: 'Email address is required.',
    };
  }

  const clean = rawEmail.trim().toLowerCase();

  // Strict RFC 5322 standard pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(clean)) {
    return {
      isValid: false,
      errorMessage: 'Please enter a valid email format (e.g., name@domain.com).',
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      errorMessage: 'Invalid email structure.',
    };
  }

  const [localPart, domain] = parts;

  // Local part checks
  if (localPart.length < 2) {
    return {
      isValid: false,
      errorMessage: 'Email username must be at least 2 characters.',
    };
  }

  // Domain checks
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (tld.length < 2) {
    return {
      isValid: false,
      errorMessage: 'Email must end with a valid domain extension (e.g. .com, .io, .org).',
    };
  }

  // Reject burner / disposable domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      errorMessage: 'Disposable and temporary email addresses are not permitted. Please use your permanent email.',
    };
  }

  // Reject repetitive character local parts like "aaaaa@domain.com"
  if (/^(.)\1{4,}$/.test(localPart)) {
    return {
      isValid: false,
      errorMessage: 'Email address contains an invalid repetitive pattern.',
    };
  }

  return {
    isValid: true,
    cleanEmail: clean,
  };
}

