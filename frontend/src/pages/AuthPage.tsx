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
  ArrowRight,
  AlertCircle,
  CheckCircle,
  ShoppingBag,
  Phone,
  RefreshCw,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, register, isLoading, isFirebaseConnected } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [role, setRole] = useState<UserRole>('founder');
  const [normalPreference, setNormalPreference] = useState<'buy' | 'sell'>('buy');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── SIGN IN ──────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('No internet connection detected. Please check your network and try again.');
      return;
    }

    try {
      if (!password) throw new Error('Please enter your password.');

      if (loginMethod === 'phone') {
        if (!phoneNumber.trim()) throw new Error('Please enter your mobile phone number.');
        const phoneValidation = validatePhoneNumber(countryCode, phoneNumber);
        if (!phoneValidation.isValid) throw new Error(phoneValidation.errorMessage || 'Invalid phone number format.');
        await login({
          phone_number: phoneValidation.cleanDigits ?? phoneNumber.replace(/\D/g, ''),
          country_code: countryCode,
          password,
        });
      } else {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) throw new Error(emailValidation.errorMessage || 'Invalid email format.');
        await login({ email: emailValidation.cleanEmail ?? email.trim().toLowerCase(), password });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    }
  };

  // ── CREATE ACCOUNT (direct — no OTP) ─────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
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

      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) throw new Error(emailValidation.errorMessage);

      const phoneValidation = validatePhoneNumber(countryCode, phoneNumber);
      if (!phoneValidation.isValid) throw new Error(phoneValidation.errorMessage);

      if (role === 'normal') {
        localStorage.setItem('foundersgate_normal_pref', normalPreference);
      }

      await register({
        email: emailValidation.cleanEmail ?? email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role,
        country_code: countryCode,
        phone_number: phoneValidation.cleanDigits ?? phoneNumber.replace(/\D/g, ''),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    }
  };

  // Quick demo account pre-fill
  const handleDemoFill = (demoRole: UserRole) => {
    setActiveTab('login');
    setRole(demoRole);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (demoRole === 'founder') {
      setFullName('Alex Vance');
      setEmail('alex.founder@tech.io');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('4155552671');
    } else if (demoRole === 'investor') {
      setFullName('Sarah Jenkins');
      setEmail('sarah.investor@vcfund.com');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('6505553901');
    } else {
      setFullName('Maria Santos');
      setEmail('maria.shop@greenmarket.com');
      setPassword('Password123!');
      setCountryCode('+1');
      setPhoneNumber('3125558721');
    }
  };

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
              ? 'Enter your mobile number or email and password to access your dashboard.'
              : 'Choose your role and fill in your details to unlock your private dashboard.'}
          </p>
        </div>

        {/* Container */}
        <div className="neu-flat p-6 sm:p-8 space-y-5">

          {/* Tab switcher */}
          <div className="flex neu-pressed-pill p-1">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(null); setSuccessMessage(null); }}
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
              onClick={() => { setActiveTab('register'); setErrorMessage(null); setSuccessMessage(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${
                activeTab === 'register'
                  ? 'neu-flat bg-white text-blue-600 shadow-neu-flat-sm'
                  : 'text-neu-textMuted hover:text-neu-text'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Firebase status badge */}
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

          {/* ── SIGN IN TAB ─────────────────────────────────── */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-slate-300/40 pb-2">
                <span className="text-neu-textMuted font-semibold">Sign in using:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('phone')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      loginMethod === 'phone' ? 'neu-pressed text-blue-600' : 'text-neu-textMuted hover:text-neu-text'
                    }`}
                  >
                    <Phone className="w-3 h-3" /><span>Mobile Phone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      loginMethod === 'email' ? 'neu-pressed text-blue-600' : 'text-neu-textMuted hover:text-neu-text'
                    }`}
                  >
                    <Mail className="w-3 h-3" /><span>Email</span>
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
                  <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                    Password
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
                    <><RefreshCw className="w-4 h-4 animate-spin" /><span>Authenticating...</span></>
                  ) : (
                    <><span>Sign In to Dashboard</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── CREATE ACCOUNT TAB ───────────────────────────── */}
          {activeTab === 'register' && (
            <div className="space-y-4">
              <form onSubmit={handleRegisterSubmit} className="space-y-4">

                {/* Role picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neu-textMuted uppercase tracking-wider">
                    Select Your Account Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['founder', 'investor', 'normal'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`p-3 neu-btn flex flex-col items-center justify-center text-center gap-1.5 rounded-xl border transition-all ${
                          role === r
                            ? r === 'founder'
                              ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-bold shadow-neu-flat-sm'
                              : r === 'investor'
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold shadow-neu-flat-sm'
                              : 'border-purple-500 bg-purple-500/10 text-purple-600 font-bold shadow-neu-flat-sm'
                            : 'border-transparent text-neu-text'
                        }`}
                      >
                        {r === 'founder' && <Rocket className="w-5 h-5" />}
                        {r === 'investor' && <TrendingUp className="w-5 h-5" />}
                        {r === 'normal' && <Store className="w-5 h-5" />}
                        <span className="text-[11px] font-bold capitalize">{r === 'normal' ? 'Normal' : r.charAt(0).toUpperCase() + r.slice(1)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Buy/Sell sub-mode — Normal only */}
                  {role === 'normal' && (
                    <div className="p-3 rounded-xl neu-pressed-sm space-y-2 border border-purple-500/30 bg-purple-500/5">
                      <span className="text-[11px] font-bold text-purple-900 block">Choose Your Marketplace Mode:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNormalPreference('buy')}
                          className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            normalPreference === 'buy' ? 'neu-flat bg-white text-purple-700 shadow-neu-flat-sm' : 'neu-btn text-neu-textMuted'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" /><span>🛒 Buy / View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNormalPreference('sell')}
                          className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            normalPreference === 'sell' ? 'neu-flat bg-white text-purple-700 shadow-neu-flat-sm' : 'neu-btn text-neu-textMuted'
                          }`}
                        >
                          <Store className="w-3.5 h-3.5" /><span>🏪 Sell (Vendor)</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-purple-800">* Startup auctions do not apply to this marketplace.</p>
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

                {/* Email */}
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
                      placeholder="yourname@gmail.com"
                      className="w-full neu-input pl-10 pr-3.5 py-2.5 text-sm text-neu-text placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Phone */}
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

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <span className="font-bold block">Error:</span>
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full neu-btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /><span>Creating Account...</span></>
                  ) : (
                    <><span>Create Account & Enter Dashboard</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Demo accounts */}
          <div className="pt-4 border-t border-slate-300/40 text-center space-y-2">
            <span className="text-[11px] font-semibold text-neu-textMuted uppercase tracking-wider">Test Accounts</span>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button type="button" onClick={() => handleDemoFill('founder')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-blue-600 font-medium">
                Alex (Founder)
              </button>
              <button type="button" onClick={() => handleDemoFill('investor')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-emerald-600 font-medium">
                Sarah (Investor)
              </button>
              <button type="button" onClick={() => handleDemoFill('normal')}
                className="px-2.5 py-1 text-[11px] neu-btn rounded-lg text-purple-600 font-medium">
                Maria (Shop Vendor)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
