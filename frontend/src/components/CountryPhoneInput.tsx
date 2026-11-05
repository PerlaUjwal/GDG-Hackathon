import React, { useState, useEffect } from 'react';
import { COUNTRIES, validatePhoneNumber, type CountryOption } from '../utils/phoneValidator';
import { ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CountryPhoneInputProps {
  countryCode: string;
  phoneNumber: string;
  onCountryChange: (dialCode: string) => void;
  onPhoneChange: (phone: string, isValid: boolean) => void;
  error?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  countryCode,
  phoneNumber,
  onCountryChange,
  onPhoneChange,
  error: externalError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const selectedCountry: CountryOption =
    COUNTRIES.find((c) => c.dialCode === countryCode) || COUNTRIES[0];

  useEffect(() => {
    if (touched || phoneNumber.length > 0) {
      const result = validatePhoneNumber(selectedCountry.dialCode, phoneNumber);
      setInternalError(result.isValid ? null : result.errorMessage || null);
      onPhoneChange(phoneNumber, result.isValid);
    }
  }, [selectedCountry.dialCode, phoneNumber, touched]);

  const handleCountrySelect = (c: CountryOption) => {
    onCountryChange(c.dialCode);
    setIsOpen(false);
    const result = validatePhoneNumber(c.dialCode, phoneNumber);
    setInternalError(result.isValid ? null : result.errorMessage || null);
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTouched(true);
    onPhoneChange(val, false);
  };

  const displayError = externalError || (touched ? internalError : null);
  const isValid = touched && !displayError && phoneNumber.length > 0;

  return (
    <div className="w-full space-y-1.5">
      <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
        Contact Number & Country Code
      </label>

      <div className="flex items-center gap-2">
        {/* Country Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="neu-btn px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-neu-text bg-neu-card border border-transparent focus:outline-none"
            aria-label="Select country code"
          >
            <span className="text-lg leading-none">{selectedCountry.flag}</span>
            <span>{selectedCountry.dialCode}</span>
            <ChevronDown className="w-4 h-4 text-neu-textMuted" />
          </button>

          {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 max-h-60 overflow-y-auto z-50 neu-flat p-2 bg-neu-card border border-slate-200/50 shadow-neu-flat-lg">
              <div className="text-xs font-semibold px-2 py-1 text-neu-textMuted uppercase border-b border-slate-300/40 mb-1">
                Select Country
              </div>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors ${
                    c.dialCode === selectedCountry.dialCode
                      ? 'bg-blue-500/10 text-blue-600 font-semibold'
                      : 'hover:bg-slate-200/60 text-neu-text'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{c.flag}</span>
                    <span>{c.name}</span>
                  </span>
                  <span className="text-neu-textMuted font-mono">{c.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phone Number Input */}
        <div className="relative flex-1">
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneInput}
            onBlur={() => setTouched(true)}
            placeholder={`e.g. ${selectedCountry.example}`}
            className={`w-full neu-input px-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400 ${
              displayError ? 'border-red-400 focus:border-red-500' : ''
            }`}
          />
          {isValid && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Error Message */}
      {displayError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1 pl-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Helper Format Hint */}
      {!displayError && (
        <p className="text-[11px] text-neu-textMuted pl-1">
          Format: {selectedCountry.name} ({selectedCountry.minLength}–{selectedCountry.maxLength} digits).
        </p>
      )}
    </div>
  );
};
