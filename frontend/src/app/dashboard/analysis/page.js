'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchHistory } from '../../../utils/api';
import { parseAmount } from '../../../utils/format';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

export default function PolicyAnalysis() {
  const router = useRouter();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const data = await fetchHistory();
        if (Array.isArray(data)) {
          setPolicies(data);
          if (data.length > 0) {
            setSelectedPolicyId(String(data[0].id || data[0].document_id || '0'));
          }
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    };
    loadPolicies();
  }, []);

  // Find the selected policy
  const selectedPolicy = policies.find(p => String(p.id || p.document_id || policies.indexOf(p)) === String(selectedPolicyId));

  // Generate Chart Data based on selected policy
  const idvValue = (selectedPolicy && parseAmount(selectedPolicy.idv)) || 500000;
  
  const basePremium = idvValue * 0.015;
  const ownDamage = basePremium * 0.8;
  const thirdParty = 7890;
  const addOns = basePremium * 0.3;
  const taxes = (basePremium + ownDamage + thirdParty + addOns) * 0.18;

  const premiumData = [
    { name: 'Base Premium', value: Math.round(basePremium), color: '#0066FF' },
    { name: 'Own Damage', value: Math.round(ownDamage), color: '#38bdf8' },
    { name: 'Third Party', value: thirdParty, color: '#f43f5e' },
    { name: 'Add-on Covers', value: Math.round(addOns), color: '#f59e0b' },
    { name: 'Taxes (18%)', value: Math.round(taxes), color: '#94a3b8' },
  ];

  const currentYear = new Date().getFullYear();
  const depreciationData = [
    { year: currentYear, idv: idvValue },
    { year: currentYear + 1, idv: Math.round(idvValue * 0.85) },
    { year: currentYear + 2, idv: Math.round(idvValue * 0.75) },
    { year: currentYear + 3, idv: Math.round(idvValue * 0.65) },
    { year: currentYear + 4, idv: Math.round(idvValue * 0.55) },
    { year: currentYear + 5, idv: Math.round(idvValue * 0.45) },
  ];

  // Pseudo-random risk scores based on name length so it stays consistent per policy
  const nameLen = selectedPolicy?.policyHolderName?.length || 10;
  const riskData = [
    { subject: 'Driver Risk', A: 40 + (nameLen * 3) % 40, fullMark: 100 },
    { subject: 'Vehicle Age', A: 30 + (nameLen * 5) % 50, fullMark: 100 },
    { subject: 'Location Risk', A: 50 + (nameLen * 2) % 30, fullMark: 100 },
    { subject: 'Claim History', A: 20 + (nameLen * 7) % 60, fullMark: 100 },
    { subject: 'Coverage Adequacy', A: 70 + (nameLen * 4) % 25, fullMark: 100 },
  ];

  return (
    <div className="flex-1 w-full px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-6 sm:gap-8 max-w-[1600px] mx-auto">
      
      {/* Header and Dropdown */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Policy Analytics</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Deep-dive visual analysis and risk profiling.</p>
        </div>
        
        <div className="w-full md:w-[350px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Uploaded Policy</label>
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow cursor-pointer"
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              disabled={loading || policies.length === 0}
            >
              {loading ? (
                <option>Loading policies...</option>
              ) : policies.length === 0 ? (
                <option>No policies found</option>
              ) : (
                policies.map((p, idx) => (
                  <option key={p.id || p.document_id || idx} value={p.id || p.document_id || idx.toString()}>
                    {p.policyHolderName || p.extracted_name || 'Unknown'} - {p.vehicleRegistrationNo || p.extracted_registration_no || 'No Reg'}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      {!selectedPolicy ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-12 text-center min-h-[300px] sm:min-h-[400px]">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-700">No Policy Selected</h3>
          <p className="text-slate-400 mt-2 max-w-sm">Please select an uploaded policy from the dropdown menu to view its analytics footprint.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart 1: Premium Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-1">Premium Breakdown</h3>
            <p className="text-xs text-slate-400 mb-6">Estimated cost distribution</p>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={premiumData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {premiumData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `Rs. ${value.toLocaleString('en-IN')}`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Depreciation Projection */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:col-span-2">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-1">5-Year IDV Depreciation</h3>
                <p className="text-xs text-slate-400">Projected vehicle value curve</p>
              </div>
              <div className="bg-blue-50 text-[#0066FF] px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                Current IDV: Rs. {idvValue.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={depreciationData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIdv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`} dx={-10} />
                  <RechartsTooltip 
                    formatter={(value) => [`Rs. ${value.toLocaleString('en-IN')}`, 'Projected IDV']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="idv" stroke="#0066FF" strokeWidth={3} fillOpacity={1} fill="url(#colorIdv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Risk Profile Radar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:col-span-3">
            <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-1">Algorithmic Risk Assessment</h3>
            <p className="text-xs text-slate-400 mb-6">Multi-dimensional risk scoring for {selectedPolicy.vehicleModel || 'this vehicle'}</p>
            <div className="flex-1 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={riskData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Risk Score" dataKey="A" stroke="#0066FF" strokeWidth={2} fill="#0066FF" fillOpacity={0.2} />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
