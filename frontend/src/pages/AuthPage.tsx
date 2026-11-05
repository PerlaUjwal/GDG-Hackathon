import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { CountryPhoneInput } from '../components/CountryPhoneInput';
import { validatePhoneNumber } from '../utils/phoneValidator';
import { validateEmail } from '../utils/emailValidator';
import {
  Rocket,
  TrendingUp,
  Store,
  Lock,
  Mail,
  User as UserIcon,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  ShoppingBag,
  Phone,
  RefreshCw,
  KeyRound,
  ShieldBan,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, register, sendOtp, verifyOtp, resetPasswordWithToken, isLoading, isFirebaseConnected } = useAuth();

  // Top Tab Mode: ONLY TWO TABS (Sign In & Create Account)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [role, setRole] = useState<UserRole>('founder');

  // Normal role sub-preference (Only for Normal)
  const [normalPreference, setNormalPreference] = useState<'buy' | 'sell'>('buy');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  // OTP Verification state for Account Creation
  const [otpChannel, setOtpChannel] = useState<'email' | 'mobile'>('email');
  const [otpStep, setOtpStep] = useState<'form' | 'verifying'>('form');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [activeIdentifier, setActiveIdentifier] = useState('');
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState(false);

  // Inline Password Reset state (integrated inside Sign In, NOT a separate top tab)
  const [showInlineReset, setShowInlineReset] = useState(false);
  const [resetChannel, setResetChannel] = useState<'email' | 'mobile'>('email');
  const [resetStep, setResetStep] = useState<'request' | 'enter_code'>('request');
  const [resetOtp, setResetOtp] = useState('');
  const [otpPreviewUrl, setOtpPreviewUrl] = useState<string | null>(null);
  const [resetPreviewUrl, setResetPreviewUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Status & Error Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // SIGN IN SUBMISSION
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('No internet connection detected. Please check your network and try again.');
      return;
    }

    try {
      if (!password) {
        throw new Error('Please enter your password.');
      }

      if (loginMethod === 'phone') {
        if (!phoneNumber.trim()) {
          throw new Error('Please enter your mobile phone number.');
        }
        const phoneValidation = validatePhoneNumber(countryCode, phoneNumber);
        if (!phoneValidation.isValid) {
          throw new Error(phoneValidation.errorMessage || 'Invalid phone number format.');
        }
        await login({
          phone_number: phoneValidation.cleanDigits,
          country_code: countryCode,
          password,
        });
      } else {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
          throw new Error(emailValidation.errorMessage || 'Invalid email format.');
        }
        await login({ email: emailValidation.cleanEmail, password });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    }
  };

  // CREATE ACCOUNT STEP 1: Anti-Vulnerability checks & Dispatch OTP
  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('No internet connection. Please reconnect to continue.');
      return;
    }

    try {
      if (!fullName.trim()) throw new Error('Please enter your full name or business name.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long.');

      // Strict Anti-Vulnerability Email Check
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.errorMessage);
      }

      // Strict Anti-Vulnerability Phone Check
      const phoneValidation = validatePhoneNumber(countryCode, phoneNumber);
      if (!phoneValidation.isValid) {
        throw new Error(phoneValidation.errorMessage);
      }

      // Store normal mode preference
      if (role === 'normal') {
        localStorage.setItem('foundersgate_normal_pref', normalPreference);
      }

      // Dispatch OTP to chosen channel (Code is NEVER exposed in client response)
      const res = await sendOtp({
        email: emailValidation.cleanEmail,
        phone_number: phoneValidation.cleanDigits,
        country_code: countryCode,
        channel: otpChannel,
        purpose: 'register',
      });

      setActiveIdentifier(res.identifier);
      setOtpPreviewUrl(res.previewUrl || null);
      setOtpStep('verifying');
      setSuccessMessage(res.message);
    } catch (err: any) {
      if (err.message && err.message.includes('permanently blocked')) {
        setIsPermanentlyBlocked(true);
      }
      setErrorMessage(err.message || 'Registration failed.');
    }
  };

  // CREATE ACCOUNT STEP 2: Verify OTP & Complete Registration
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!enteredOtp || enteredOtp.trim().length !== 6) {
      setErrorMessage('Please enter the exact 6-digit verification code.');
      return;
    }

    try {
      // Verify OTP (Permanent blacklist if 3 failed attempts)
      await verifyOtp({
        identifier: activeIdentifier,
        code: enteredOtp.trim(),
      });

      // Verification passed -> register user and unlock strict role page
      await register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role,
        country_code: countryCode,
        phone_number: phoneNumber.replace(/\D/g, '') || phoneNumber,
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('permanently blocked') || err.message.includes('BLOCKED'))) {
        setIsPermanentlyBlocked(true);
      }
      setErrorMessage(err.message || 'Verification failed.');
    }
  };

  // INLINE PASSWORD RESET VIA VERIFICATION CODE (No separate top button)
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (resetChannel === 'email') {
        const val = validateEmail(email);
        if (!val.isValid) throw new Error(val.errorMessage);
      } else {
        const val = validatePhoneNumber(countryCode, phoneNumber);
        if (!val.isValid) throw new Error(val.errorMessage);
      }

      const res = await sendOtp({
        email: resetChannel === 'email' ? email : undefined,
        phone_number: resetChannel === 'mobile' ? phoneNumber : undefined,
        country_code: countryCode,
        channel: resetChannel,
        purpose: 'reset',
      });

      setActiveIdentifier(res.identifier);
      setResetPreviewUrl(res.previewUrl || null);
      setResetStep('enter_code');
      setSuccessMessage(res.message || 'Verification code sent. Valid strictly for 30 minutes.');
    } catch (err: any) {
      if (err.message && err.message.includes('permanently blocked')) {
        setIsPermanentlyBlocked(true);
      }
      setErrorMessage(err.message || 'Failed to dispatch reset code.');
    }
  };

  const handleVerifyResetAndChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!resetOtp || resetOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    try {
      const result = await verifyOtp({
        identifier: activeIdentifier,
        code: resetOtp.trim(),
      });

      const res = await resetPasswordWithToken(result.otpToken || resetOtp, newPassword);
      if (res.success) {
        setResetSuccess('Password successfully reset! You can now sign in.');
        setTimeout(() => {
          setShowInlineReset(false);
          setResetStep('request');
          setResetSuccess(null);
        }, 2500);
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('permanently blocked')) {
        setIsPermanentlyBlocked(true);
      }
      setErrorMessage(err.message || 'Reset failed.');
    }
  };

  // Quick Demo Accounts Fill
  const handleDemoFill = (demoRole: UserRole) => {
    setRole(demoRole);
    if (demoRole === 'founder') {
      setEmail('alex.founder@tech.io');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('4155552671');
    } else if (demoRole === 'investor') {
      setEmail('sarah.investor@vcfund.com');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('6505553901');
    } else {
      setEmail('maria.shop@greenmarket.com');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('3125558721');
    }
  };

  // PERMANENT LOCKOUT SCREEN IF 3 FAILED ATTEMPTS OCCUR
  if (isPermanentlyBlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="neu-flat p-8 max-w-md w-full text-center space-y-4 bg-red-500/10 border-2 border-red-500/40">
          <div className="w-16 h-16 mx-auto rounded-2xl neu-pressed flex items-center justify-center text-red-600">
            <ShieldBan className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-extrabold text-red-700">Account Permanently Blocked</h3>
            <p className="text-xs text-neu-text leading-relaxed">
              Security lockout triggered: Verification failed more than 3 times for this mobile number and email.
              This identifier has been permanently blacklisted from ever registering or logging in.
            </p>
          </div>
          <button
            onClick={() => {
              setIsPermanentlyBlocked(false);
              setOtpStep('form');
              setErrorMessage(null);
              setEmail('');
              setPhoneNumber('');
            }}
            className="neu-btn px-5 py-2 text-xs font-bold text-neu-text mt-2"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto neu-flat rounded-2xl flex items-center justify-center text-blue-600 shadow-neu-flat">
            <Rocket className="w-8 h-8 transform -rotate-45" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neu-text tracking-tight">
            {activeTab === 'login' ? 'Sign in to Your Account' : 'Create Your Account'}
          </h2>
          <p className="text-xs text-neu-textMuted max-w-xs mx-auto">
            {activeTab === 'login'
              ? 'Enter your mobile number and password to access your dedicated dashboard.'
              : 'Choose your role, verify with a real OTP code, and unlock your private dashboard.'}
          </p>
        </div>

        {/* Neumorphic Container */}
        <div className="neu-flat p-6 sm:p-8 space-y-5">
          {/* ONLY TWO TABS AS REQUESTED: SIGN IN & CREATE ACCOUNT */}
          <div className="flex neu-pressed-pill p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setShowInlineReset(false);
                setOtpStep('form');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${
                activeTab === 'login'
                  ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                  : 'text-neu-textMuted hover:text-neu-text'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setShowInlineReset(false);
                setOtpStep('form');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${
                activeTab === 'register'
                  ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                  : 'text-neu-textMuted hover:text-neu-text'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Connection Mode Status */}
          <div className="flex justify-center -mt-1">
            {isFirebaseConnected ? (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
                🔥 Firebase Studio & Cloud Firestore Active
              </span>
            ) : (
              <span className="text-[11px] font-medium text-neu-textMuted bg-slate-200/50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                🛡️ Local Engine (Firebase Studio ready in frontend/.env)
              </span>
            )}
          </div>

          {/* TAB 1: SIGN IN */}
          {activeTab === 'login' && !showInlineReset && (
            <div className="space-y-4">
              {/* Method Switcher */}
              <div className="flex items-center justify-between text-xs border-b border-slate-300/40 pb-2">
                <span className="text-neu-textMuted font-semibold">Sign in using:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('phone')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      loginMethod === 'phone'
                        ? 'neu-pressed text-blue-600'
                        : 'text-neu-textMuted hover:text-neu-text'
                    }`}
                  >
                    <Phone className="w-3 h-3" />
                    <span>Mobile Phone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      loginMethod === 'email'
                        ? 'neu-pressed text-blue-600'
                        : 'text-neu-textMuted hover:text-neu-text'
                    }`}
                  >
                    <Mail className="w-3 h-3" />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginMethod === 'phone' ? (
                  <CountryPhoneInput
                    countryCode={countryCode}
                    phoneNumber={phoneNumber}
                    onCountryChange={(code) => setCountryCode(code)}
                    onPhoneChange={(phone) => setPhoneNumber(phone)}
                  />
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neu-textMuted absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@domain.com"
                        className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Password
                    </label>
                    {/* INLINE RESET VIA VERIFICATION CODE (AS REQUESTED) */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineReset(true);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neu-textMuted absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full neu-btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* INLINE PASSWORD RESET PANEL (WHEN "FORGOT PASSWORD" CLICKED) */}
          {activeTab === 'login' && showInlineReset && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-300/40 pb-2">
                <span className="text-xs font-bold text-neu-text flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Reset Password via Verification Code</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowInlineReset(false)}
                  className="text-xs text-neu-textMuted hover:text-neu-text"
                >
                  Cancel
                </button>
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={handleSendResetCode} className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResetChannel('email')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
                        resetChannel === 'email' ? 'neu-pressed text-blue-600' : 'neu-btn text-neu-textMuted'
                      }`}
                    >
                      Send to Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetChannel('mobile')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
                        resetChannel === 'mobile' ? 'neu-pressed text-blue-600' : 'neu-btn text-neu-textMuted'
                      }`}
                    >
                      Send to Mobile
                    </button>
                  </div>

                  {resetChannel === 'email' ? (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@domain.com"
                        className="w-full neu-input px-3.5 py-2 text-xs text-neu-text"
                      />
                    </div>
                  ) : (
                    <CountryPhoneInput
                      countryCode={countryCode}
                      phoneNumber={phoneNumber}
                      onCountryChange={(code) => setCountryCode(code)}
                      onPhoneChange={(phone) => setPhoneNumber(phone)}
                    />
                  )}

                  <p className="text-[11px] text-amber-700 bg-amber-500/10 p-2.5 rounded-lg">
                    🔒 Verification code expires in 30 minutes. Max 3 failed attempts before permanent lockout.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full neu-btn-primary py-2.5 text-xs font-bold"
                  >
                    Send Verification Code
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyResetAndChangePassword} className="space-y-3">
                  {resetPreviewUrl && (
                    <div className="p-2.5 rounded-lg neu-pressed-sm border border-blue-400/40 text-blue-900 text-xs flex items-center justify-between gap-2">
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold block">📬 Dispatched Message:</span>
                        <span className="text-blue-700">Real message sent across network.</span>
                      </div>
                      <a
                        href={resetPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neu-btn px-2.5 py-1 text-[11px] font-bold text-blue-600 shrink-0 hover:text-blue-800"
                      >
                        View Email ↗
                      </a>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      placeholder="Enter 6-digit code"
                      className="w-full neu-input px-3.5 py-2 text-sm font-mono text-center tracking-widest text-neu-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                      New Password (min 6 chars)
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new secure password"
                      className="w-full neu-input px-3.5 py-2 text-xs text-neu-text"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full neu-btn-primary py-2.5 text-xs font-bold"
                  >
                    Confirm & Update Password
                  </button>
                </form>
              )}

              {resetSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs">
                  {resetSuccess}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE ACCOUNT WITH OTP AUTHENTICATION */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              {otpStep === 'form' ? (
                <form onSubmit={handleStartRegistration} className="space-y-4">
                  {/* Role Picker */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Select Your Account Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('founder')}
                        className={`p-3 neu-btn flex flex-col items-center justify-center text-center gap-1.5 rounded-xl border transition-all ${
                          role === 'founder'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-bold shadow-neu-flat-sm'
                            : 'border-transparent text-neu-text hover:text-blue-600'
                        }`}
                      >
                        <Rocket className="w-5 h-5" />
                        <span className="text-[11px] font-bold">Founder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('investor')}
                        className={`p-3 neu-btn flex flex-col items-center justify-center text-center gap-1.5 rounded-xl border transition-all ${
                          role === 'investor'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold shadow-neu-flat-sm'
                            : 'border-transparent text-neu-text hover:text-emerald-600'
                        }`}
                      >
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-[11px] font-bold">Investor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('normal')}
                        className={`p-3 neu-btn flex flex-col items-center justify-center text-center gap-1.5 rounded-xl border transition-all ${
                          role === 'normal'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-600 font-bold shadow-neu-flat-sm'
                            : 'border-transparent text-neu-text hover:text-purple-600'
                        }`}
                      >
                        <Store className="w-5 h-5" />
                        <span className="text-[11px] font-bold">Normal</span>
                      </button>
                    </div>

                    {/* SPECIFIC REQUIREMENT: BUY/VIEW AND SELL BUTTONS ONLY FOR NORMAL */}
                    {role === 'normal' && (
                      <div className="p-3 rounded-xl neu-pressed-sm space-y-2 border border-purple-500/30 bg-purple-500/5 animate-fade-in">
                        <span className="text-[11px] font-bold text-purple-900 block">
                          Choose Your Marketplace Mode:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNormalPreference('buy')}
                            className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                              normalPreference === 'buy'
                                ? 'neu-flat bg-white text-purple-700 shadow-neu-flat-sm'
                                : 'neu-btn text-neu-textMuted'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>🛒 Buy / View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNormalPreference('sell')}
                            className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                              normalPreference === 'sell'
                                ? 'neu-flat bg-white text-purple-700 shadow-neu-flat-sm'
                                : 'neu-btn text-neu-textMuted'
                            }`}
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>🏪 Sell (Vendor)</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-purple-800">
                          * Small vendors & direct commerce. Startup auctions do not apply to this mode.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Full Name / Shop Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-neu-textMuted absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Elena Rostova"
                        className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Real Email with Anti-Burner Verification */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Permanent Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neu-textMuted absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@gmail.com (no burner domains)"
                        className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Mobile Phone with Anti-Vulnerability Validation */}
                  <CountryPhoneInput
                    countryCode={countryCode}
                    phoneNumber={phoneNumber}
                    onCountryChange={(code) => setCountryCode(code)}
                    onPhoneChange={(phone) => setPhoneNumber(phone)}
                  />

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                      Create Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neu-textMuted absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* OTP CHANNEL SELECTION AS REQUESTED */}
                  <div className="p-3 rounded-xl neu-pressed-sm space-y-2">
                    <span className="text-xs font-bold text-neu-text block">
                      Choose Where to Receive Your Verification OTP:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`p-2.5 rounded-lg cursor-pointer flex items-center gap-2 text-xs font-bold transition-all ${
                          otpChannel === 'email'
                            ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                            : 'neu-btn text-neu-textMuted'
                        }`}
                      >
                        <input
                          type="radio"
                          name="otpChannel"
                          value="email"
                          checked={otpChannel === 'email'}
                          onChange={() => setOtpChannel('email')}
                          className="sr-only"
                        />
                        <Mail className="w-3.5 h-3.5" />
                        <span>Real Email OTP</span>
                      </label>
                      <label
                        className={`p-2.5 rounded-lg cursor-pointer flex items-center gap-2 text-xs font-bold transition-all ${
                          otpChannel === 'mobile'
                            ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                            : 'neu-btn text-neu-textMuted'
                        }`}
                      >
                        <input
                          type="radio"
                          name="otpChannel"
                          value="mobile"
                          checked={otpChannel === 'mobile'}
                          onChange={() => setOtpChannel('mobile')}
                          className="sr-only"
                        />
                        <Phone className="w-3.5 h-3.5" />
                        <span>Mobile SMS OTP</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-neu-textMuted">
                      * OTP code is securely dispatched server-side and never exposed to client code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full neu-btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* STEP 2: ENTER OTP CODE (MAX 3 ATTEMPTS) */
                <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4 animate-fade-in">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-xl neu-pressed flex items-center justify-center text-blue-600 mx-auto">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-neu-text">Enter Verification Code</h3>
                    <p className="text-xs text-neu-textMuted">
                      A 6-digit code was dispatched to your <strong>{otpChannel}</strong> ({activeIdentifier}).
                    </p>
                  </div>

                  {otpPreviewUrl && (
                    <div className="p-3 rounded-xl neu-pressed-sm border border-blue-400/40 text-blue-900 text-xs flex items-center justify-between gap-2">
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold block text-blue-950">📬 Verification Message Ready:</span>
                        <span className="text-blue-700">Real message sent across network. Click to view delivered message:</span>
                      </div>
                      <a
                        href={otpPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neu-btn px-3 py-1.5 text-xs font-bold text-blue-600 shrink-0 hover:text-blue-800"
                      >
                        View Email ↗
                      </a>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neu-textMuted uppercase text-center">
                      6-Digit Security Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full neu-input py-3 text-center text-lg font-mono tracking-widest text-neu-text"
                    />
                  </div>

                  <div className="p-3 rounded-lg neu-pressed-sm text-[11px] text-amber-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Security Notice: 3 Attempts Maximum</span>
                    </div>
                    <p className="text-[10px] text-amber-700 leading-tight">
                      Failing verification 3 times will permanently blacklist this mobile number and email from ever creating an account.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpStep('form')}
                      className="flex-1 neu-btn py-2.5 text-xs font-semibold text-neu-text"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-2 neu-btn-primary py-2.5 text-xs font-bold"
                    >
                      {isLoading ? 'Verifying...' : 'Verify & Enter Dashboard'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ERROR ALERT BOX */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="space-y-0.5">
                <span className="font-bold block">Error Occurred:</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* SUCCESS ALERT BOX */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* QUICK DEMO ACCOUNTS PRE-FILL */}
          <div className="pt-4 border-t border-slate-300/40 text-center space-y-2">
            <span className="text-[11px] font-semibold text-neu-textMuted uppercase tracking-wider">
              Test Accounts
            </span>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleDemoFill('founder')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-blue-600 font-medium"
              >
                Alex (Founder)
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('investor')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-emerald-600 font-medium"
              >
                Sarah (Investor)
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('normal')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-purple-600 font-medium"
              >
                Maria (Shop Vendor)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
