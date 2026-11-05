export interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  minLength: number;
  maxLength: number;
  example: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', minLength: 10, maxLength: 10, example: '4155552671' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', minLength: 10, maxLength: 10, example: '4165550198' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', minLength: 10, maxLength: 10, example: '9876543210' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', minLength: 10, maxLength: 11, example: '7911123456' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', minLength: 10, maxLength: 11, example: '15123456789' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', minLength: 9, maxLength: 9, example: '612345678' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', minLength: 10, maxLength: 11, example: '9012345678' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', minLength: 9, maxLength: 9, example: '412345678' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', minLength: 8, maxLength: 8, example: '81234567' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', minLength: 9, maxLength: 9, example: '501234567' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', minLength: 10, maxLength: 11, example: '11987654321' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', minLength: 10, maxLength: 10, example: '8023456789' },
];

export interface PhoneValidationResult {
  isValid: boolean;
  errorMessage?: string;
  cleanDigits?: string;
}

export function validatePhoneNumber(countryDialCode: string, rawPhone: string): PhoneValidationResult {
  if (!countryDialCode) {
    return {
      isValid: false,
      errorMessage: 'Please select a valid country code from the list.',
    };
  }

  const country = COUNTRIES.find(c => c.dialCode === countryDialCode);
  const cleanDigits = rawPhone.replace(/\D/g, '');

  if (!cleanDigits) {
    return {
      isValid: false,
      errorMessage: 'Contact phone number is required.',
    };
  }

  if (/[^0-9\s-]/.test(rawPhone)) {
    return {
      isValid: false,
      errorMessage: 'Phone number can only contain numeric digits (0-9).',
    };
  }

  // 1. Length validation
  if (!country) {
    if (cleanDigits.length < 7) {
      return { isValid: false, errorMessage: 'Phone number is too short (minimum 7 digits required).' };
    }
    if (cleanDigits.length > 15) {
      return { isValid: false, errorMessage: 'Phone number is too long (maximum 15 digits).' };
    }
  } else {
    if (cleanDigits.length < country.minLength) {
      return {
        isValid: false,
        errorMessage: `Not enough digits: ${country.name} phone numbers require at least ${country.minLength} digits (entered ${cleanDigits.length}).`,
      };
    }
    if (cleanDigits.length > country.maxLength) {
      return {
        isValid: false,
        errorMessage: `Too many digits: ${country.name} phone numbers cannot exceed ${country.maxLength} digits (entered ${cleanDigits.length}).`,
      };
    }
  }

  // 2. Anti-Vulnerability Check: Reject identical repeated digits (e.g. "1111111111", "0000000000")
  if (/^(\d)\1+$/.test(cleanDigits)) {
    return {
      isValid: false,
      errorMessage: 'Fake phone number detected: repetitive identical digits are not allowed.',
    };
  }

  // Check if any single digit accounts for >= 70% of the entire number (e.g. "9999999912")
  const digitCounts: Record<string, number> = {};
  for (const d of cleanDigits) {
    digitCounts[d] = (digitCounts[d] || 0) + 1;
    if (digitCounts[d] / cleanDigits.length >= 0.7) {
      return {
        isValid: false,
        errorMessage: 'Invalid phone number pattern: suspicious repetitive digits detected.',
      };
    }
  }

  // 3. Anti-Vulnerability Check: Reject trivial sequential numbers
  const sequentialPatterns = [
    '0123456789',
    '1234567890',
    '9876543210',
    '8765432109',
    '12345678',
    '87654321',
  ];
  for (const seq of sequentialPatterns) {
    if (cleanDigits.includes(seq)) {
      return {
        isValid: false,
        errorMessage: 'Suspicious sequential numbers detected. Please provide a real mobile phone number.',
      };
    }
  }

  // 4. Country specific validity rules:
  // US / CA cannot start with 0 or 1
  if ((countryDialCode === '+1') && (cleanDigits.startsWith('0') || cleanDigits.startsWith('1'))) {
    return {
      isValid: false,
      errorMessage: 'US/Canada phone numbers cannot begin with 0 or 1 area code.',
    };
  }

  // India (+91) standard mobile numbers must begin with 6, 7, 8, or 9
  if (countryDialCode === '+91' && !/^[6-9]/.test(cleanDigits)) {
    return {
      isValid: false,
      errorMessage: 'Indian mobile numbers must start with 6, 7, 8, or 9.',
    };
  }

  // UK (+44) mobile numbers start with 7
  if (countryDialCode === '+44' && !cleanDigits.startsWith('7') && !cleanDigits.startsWith('1') && !cleanDigits.startsWith('2')) {
    return {
      isValid: false,
      errorMessage: 'Invalid UK phone number prefix.',
    };
  }

  return { isValid: true, cleanDigits };
}
