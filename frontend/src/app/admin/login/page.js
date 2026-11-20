"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminLoginUser } from '../../../utils/api';

export default function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await adminLoginUser(identifier, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
            <div className="flex gap-md">
              <span className="material-symbols-outlined text-primary">recommend</span>
              <div>
                <h3 className="font-semibold text-on-background">Insurance Recommendations</h3>
                <p className="text-body-sm text-on-surface-variant">Personalized policy suggestions based on comprehensive data intelligence.</p>
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
            <h2 className="text-headline-sm font-headline-sm text-on-background mb-xs">Admin sign in</h2>
            <p className="text-body-md text-on-surface-variant">Administrator accounts only.</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <form action="#" className="space-y-lg" method="POST" onSubmit={handleLogin}>
            <div className={`space-y-xs glass-panel transition-all duration-300 ${isFocused ? 'shadow-xl shadow-primary/10' : ''}`} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <label className="text-label-lg font-label-lg text-on-background flex items-center gap-xs" htmlFor="identifier">
                <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                Email or Mobile Number
              </label>
              <input 
                className="w-full px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none" 
                id="identifier" 
                name="identifier" 
                placeholder="Email or 10-digit mobile" 
                required 
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </div>
            <div className={`space-y-xs glass-panel transition-all duration-300 ${passwordFocused ? 'shadow-xl shadow-primary/10' : ''}`} style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="flex justify-between items-center">
                <label className="text-label-lg font-label-lg text-on-background flex items-center gap-xs" htmlFor="password">
                  <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
                  Password
                </label>
              </div>
              <div className="relative">
                <input 
                  className="w-full px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••" 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <button 
                  className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant flex items-center" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <button 
              disabled={loading}
              className="btn-hover-effect w-full bg-primary-container text-white font-label-lg py-md rounded-lg flex items-center justify-center gap-xs shadow-lg shadow-primary-container/20 hover:bg-primary-container/90 transition-all disabled:opacity-70" 
              type="submit"
            >
              {loading ? 'Signing In...' : 'Sign In'}
              {!loading && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
            </button>
          </form>
          <div className="mt-xl pt-lg border-t border-outline-variant/30 text-center">
            <p className="text-body-md text-on-surface-variant">
              Not an admin?
              <Link className="text-primary font-label-lg hover:underline ml-xs" href="/login">Agent sign in</Link>
            </p>
          </div>
          <footer className="mt-xl text-center">
            <p className="text-label-sm text-outline">
              © 2026 ShareIndia Cover360. All rights reserved.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
