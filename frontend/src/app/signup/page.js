"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendSignupOtp, signupUser } from '../../utils/api';

const INPUT = "w-full px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none";
const LABEL = "text-label-lg font-label-lg text-on-background flex items-center gap-xs";

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const router = useRouter();

  // Count down the "resend OTP" timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const mobileValid = /^[6-9]\d{9}$/.test(mobile);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const handleSendOtp = async () => {
    setError('');
    setInfo('');
    if (!mobileValid) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!emailValid) {
      setError('Enter your email address first.');
      return;
    }
    setSendingOtp(true);
    try {
      await sendSignupOtp(mobile, email);
      setOtpSent(true);
      setOtp('');
      setCooldown(30);
      setInfo(`OTP sent to +91 ${mobile}. It is valid for 10 minutes.`);
    } catch (err) {
      if (err.retryAfter) setCooldown(err.retryAfter);
      setError(err.message || 'Could not send the OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!name.trim()) return setError('Enter your full name.');
    if (!emailValid) return setError('Enter a valid email address.');
    if (!mobileValid) return setError('Enter a valid 10-digit mobile number.');
    if (!otpSent) return setError('Click "Send OTP" to verify your mobile number.');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('Password must be at least 8 characters with a letter and a number.');
    }
    if (password !== confirmPassword) return setError('Password and confirm password do not match.');

    setLoading(true);
    try {
      await signupUser({ fullName: name.trim(), email, mobile, otp, password, confirmPassword });
      router.push('/login?registered=1');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const eyeButton = (shown, toggle) => (
    <button
      className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant flex items-center"
      type="button"
      aria-label={shown ? 'Hide password' : 'Show password'}
      onClick={toggle}
    >
      <span className="material-symbols-outlined text-[20px]">{shown ? 'visibility_off' : 'visibility'}</span>
    </button>
  );

  return (
    <main className="flex flex-col md:flex-row w-full min-h-dvh">
      {/* Left Side: Project Info */}
      <section className="hidden md:flex md:w-1/2 bg-gradient-to-br from-surface-container-low to-surface-container-high items-center justify-center p-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]"></div>
        </div>
        <div className="relative z-10 max-w-md">
          <div className="mb-lg">
            <img src="/cover360-logo.svg" alt="Cover360" className="w-20 h-20 mb-md drop-shadow-lg" />
            <h1 className="text-headline-lg font-headline-lg text-on-background mb-xs">Cover360</h1>
            <p className="text-primary font-bold uppercase tracking-[0.2em] text-label-md">Enterprise Intelligence</p>
          </div>
          <div className="space-y-lg">
            <div className="flex gap-md">
              <span className="material-symbols-outlined text-primary">description</span>
              <div>
                <h3 className="font-semibold text-on-background">Document Extraction</h3>
                <p className="text-body-sm text-on-surface-variant">Automated processing of complex insurance documents with high accuracy.</p>
              </div>
            </div>
            <div className="flex gap-md">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <div>
                <h3 className="font-semibold text-on-background">Risk Assessment</h3>
                <p className="text-body-sm text-on-surface-variant">Advanced AI models for real-time risk profiling and analysis.</p>
              </div>
            </div>
          </div>
          <div className="mt-xl pt-xl border-t border-outline-variant/30">
            <p className="text-label-md text-outline mb-sm">Powered by</p>
            <img src="/shareindia-logo.png" alt="Share India - You generate, we multiply" className="h-12 w-auto" />
          </div>
        </div>
      </section>
      
      {/* Right Side: Auth */}
      <section className="w-full md:w-1/2 flex flex-col items-center justify-center p-md md:p-xl bg-surface-container-lowest">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="md:hidden flex flex-col items-center mb-lg">
            <img src="/cover360-logo.svg" alt="Cover360" className="w-12 h-12 mb-sm drop-shadow-md" />
            <h2 className="text-headline-sm font-headline-sm">Cover360</h2>
          </div>
          <div className="mb-lg">
            <h2 className="text-headline-sm font-headline-sm text-on-background mb-xs">Create an Account</h2>
            <p className="text-body-md text-on-surface-variant">Please fill in your details to sign up.</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm border border-green-200">
              {info}
            </div>
          )}

          <form className="space-y-md" onSubmit={handleSignup} noValidate>
            <div className="space-y-xs">
              <label className={LABEL} htmlFor="name">
                <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                Full Name
              </label>
              <input className={INPUT} id="name" name="name" placeholder="John Doe" autoComplete="name" type="text"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-xs">
              <label className={LABEL} htmlFor="email">
                <span className="material-symbols-outlined text-[18px] text-primary">mail</span>
                Email Address
              </label>
              <input className={INPUT} id="email" name="email" placeholder="name@company.com" autoComplete="email" type="email"
                value={email} onChange={(e) => setEmail(e.target.value.trim())} />
            </div>

            <div className="space-y-xs">
              <label className={LABEL} htmlFor="mobile">
                <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                Mobile Number
              </label>
              <div className="flex gap-sm">
                <div className="relative flex-1">
                  <span className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant text-body-md">+91</span>
                  <input className={`${INPUT} pl-[3.25rem]`} id="mobile" name="mobile" placeholder="10-digit number"
                    inputMode="numeric" autoComplete="tel-national" maxLength={10} type="tel"
                    value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || cooldown > 0}
                  className="px-md py-sm rounded-lg border border-primary text-primary font-label-lg whitespace-nowrap hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingOtp ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                </button>
              </div>
            </div>

            <div className="space-y-xs">
              <label className={LABEL} htmlFor="otp">
                <span className="material-symbols-outlined text-[18px] text-primary">pin</span>
                OTP
              </label>
              <input className={`${INPUT} tracking-[0.4em] disabled:opacity-60`} id="otp" name="otp"
                placeholder={otpSent ? '6-digit OTP' : 'Send OTP to enter it here'}
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} type="text" disabled={!otpSent}
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>

            <div className="space-y-xs">
              <label className={LABEL} htmlFor="password">
                <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
                Password
              </label>
              <div className="relative">
                <input className={INPUT} id="password" name="password" placeholder="At least 8 characters"
                  autoComplete="new-password" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                {eyeButton(showPassword, () => setShowPassword(!showPassword))}
              </div>
              <p className="text-label-sm text-outline">Use 8+ characters with at least one letter and one number.</p>
            </div>

            <div className="space-y-xs">
              <label className={LABEL} htmlFor="confirmPassword">
                <span className="material-symbols-outlined text-[18px] text-primary">lock_reset</span>
                Confirm Password
              </label>
              <div className="relative">
                <input className={INPUT} id="confirmPassword" name="confirmPassword" placeholder="Re-enter your password"
                  autoComplete="new-password" type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {eyeButton(showConfirm, () => setShowConfirm(!showConfirm))}
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-label-sm text-red-600">Passwords do not match.</p>
              )}
            </div>

            <button
              disabled={loading}
              className="btn-hover-effect w-full bg-primary-container text-white font-label-lg py-md rounded-lg flex items-center justify-center gap-xs shadow-lg shadow-primary-container/20 hover:bg-primary-container/90 transition-all disabled:opacity-70"
              type="submit"
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
            </button>
          </form>
          <div className="mt-xl pt-lg border-t border-outline-variant/30 text-center">
            <p className="text-body-md text-on-surface-variant">
              Already have an account? 
              <Link className="text-primary font-label-lg hover:underline ml-xs" href="/login">Sign In</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
