'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import logoImage from './logo-removebg-preview.png';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Account menu: tap to toggle (hover does not exist on phones); close on outside tap or navigation
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');

    if (!token) {
      router.push(pathname.startsWith('/dashboard/admin') ? '/admin/login' : '/login');
    } else {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Failed to parse user data');
      }
      setLoading(false);
    }
  }, [router]);

  // Bottom tab bar shown on phones / tablets, where the sidebar and top links are hidden
  const mobileTabs = [
    { href: '/dashboard', label: 'Dashboard', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg> },
    { href: '/dashboard/analysis', label: 'Analysis', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg> },
    { href: '/dashboard/history', label: 'Claims', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
    { href: '/dashboard/ask-ai', label: 'Ask AI', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
  ];

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    router.push(user?.role === 'admin' ? '/admin/login' : '/login');
  };

  if (loading) {
    return <div className="h-dvh flex items-center justify-center bg-[#f8fafc]">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-dvh w-full bg-[#f8fafc] font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-20" style={{ height: 'calc(4rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-4 sm:gap-10">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/cover360-logo.svg" alt="" className="w-8 h-8" />
            <span className="text-2xl font-black text-[#0066FF] tracking-tight">Cover360</span>
          </Link>
          
          {/* Top Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className={`text-sm font-semibold border-b-2 py-5 transition-colors ${pathname === '/dashboard' ? 'text-[#0066FF] border-[#0066FF]' : 'text-gray-500 border-transparent hover:text-gray-900'}`}>
              Dashboard
            </Link>
            <Link href="/dashboard/history" className={`text-sm font-semibold border-b-2 py-5 transition-colors ${pathname === '/dashboard/history' ? 'text-[#0066FF] border-[#0066FF]' : 'text-gray-500 border-transparent hover:text-gray-900'}`}>
              {user?.role === 'admin' ? 'All Policies' : 'Policies'}
            </Link>
            {user?.role === 'admin' && (
              <Link href="/dashboard/admin/users" className={`text-sm font-semibold border-b-2 py-5 transition-colors ${pathname === '/dashboard/admin/users' ? 'text-[#0066FF] border-[#0066FF]' : 'text-gray-500 border-transparent hover:text-gray-900'}`}>
                Users
              </Link>
            )}

          </nav>
        </div>
        
        {/* Right Actions */}
        <div className="relative flex items-center gap-5" ref={menuRef}>
          <img src="/shareindia-logo.png" alt="Share India" className="hidden sm:block h-9 w-auto" />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-sm transition-colors hover:bg-blue-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || 'user@example.com'}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#0066FF] mt-1">{user?.role === 'admin' ? 'Admin' : 'Agent'}</p>
              </div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-[260px] bg-white border-r border-gray-200 hidden lg:flex flex-col z-10">
          <div className="p-5 border-b border-gray-100 mb-2">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-[#0066FF]">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 tracking-wider">ENTERPRISE ANALYSIS</h3>
                  <p className="text-[10px] text-gray-500">v2.4.0 High-Trust Core</p>
                </div>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${pathname === '/dashboard' ? 'bg-[#e5f0ff] text-[#0066FF]' : 'text-gray-600 hover:bg-gray-50'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
              Dashboard
              {pathname === '/dashboard' && <div className="absolute left-0 w-1 h-8 bg-[#0066FF] rounded-r-md"></div>}
            </Link>
            
            <Link href="/dashboard/analysis" className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${pathname === '/dashboard/analysis' ? 'bg-[#e5f0ff] text-[#0066FF]' : 'text-gray-600 hover:bg-gray-50'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
              Policy Analysis
              {pathname === '/dashboard/analysis' && <div className="absolute left-0 w-1 h-8 bg-[#0066FF] rounded-r-md"></div>}
            </Link>
            

            
            <Link href="/dashboard/history" className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${pathname === '/dashboard/history' ? 'bg-[#e5f0ff] text-[#0066FF]' : 'text-gray-600 hover:bg-gray-50'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              {user?.role === 'admin' ? 'All Claims Data' : 'Claims Data'}
              {pathname === '/dashboard/history' && <div className="absolute left-0 w-1 h-8 bg-[#0066FF] rounded-r-md"></div>}
            </Link>

            {user?.role === 'admin' && (
              <Link href="/dashboard/admin/users" className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${pathname === '/dashboard/admin/users' ? 'bg-[#e5f0ff] text-[#0066FF]' : 'text-gray-600 hover:bg-gray-50'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Manage Users
              </Link>
            )}
          </div>
          
          <div className="p-4 mt-auto">
             <button onClick={() => window.location.href = '/dashboard'} className="w-full bg-[#0066FF] text-white rounded-lg py-3 flex items-center justify-center gap-2 text-sm font-bold shadow hover:bg-[#0052cc] transition-colors">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
               Analyze New Policy
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-transparent relative flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
          
          {/* Footer inside main content scroll area */}
          <footer className="py-6 px-4 sm:px-10 text-xs text-gray-400 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center border-t border-gray-200/60 mt-auto">
            <div><strong className="text-gray-700">Cover360</strong> © 2026 ShareIndia Cover360. All rights reserved.</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <a href="#" className="hover:text-gray-600">Privacy Policy</a>
              <a href="#" className="hover:text-gray-600">Terms of Service</a>
              <a href="#" className="hover:text-gray-600">Security Compliance</a>
            </div>
          </footer>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Primary"
        >
          {mobileTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] font-semibold transition-colors ${active ? 'text-[#0066FF]' : 'text-gray-500'}`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
        
      </div>
    </div>
  );
}
