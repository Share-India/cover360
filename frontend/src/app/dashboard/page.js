'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Dashboard.module.css';
import RecommendationCard from './RecommendationCard';
import { analyzePolicy, updatePolicy, fetchRecommendations, generateReport, chatInsure } from '../../utils/api';
import { generatePDFReport } from '../../utils/pdfGenerator';

export default function Dashboard() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [kycFile, setKycFile] = useState(null);
  const [sourceInfo, setSourceInfo] = useState({ sources: {}, kycStatus: 'not_provided', kycNameMismatch: false });
  const [ageAssumed, setAgeAssumed] = useState(false);
  const [incomeFocused, setIncomeFocused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [editData, setEditData] = useState({});
  const [editMode, setEditMode] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [expandedRecs, setExpandedRecs] = useState({});

  const toggleExpand = (recId) => {
    setExpandedRecs(prev => ({
      ...prev,
      [recId]: !prev[recId]
    }));
  };

  const handleKycChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setKycFile(e.target.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };


  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [recentPolicies, setRecentPolicies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u && (u.name || u.email)) {
        setUserName(u.name || u.email);
      }
    } catch (e) {}

    const loadHistory = async () => {
      try {
        const { fetchHistory } = await import('../../utils/api');
        const data = await fetchHistory();
        if (Array.isArray(data)) {
          setRecentPolicies(data.slice(0, 3)); // Get top 3
        }
      } catch(e) {
        console.error("Failed to load history", e);
      }
    };
    loadHistory();
  }, []);


  const loadRecommendations = async () => {
    try {
      const recs = await fetchRecommendations(); // logged-in user
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
    }
  };


  const handleViewPolicy = async (data) => {
    setIsProcessing(true);
    setResults(data);
    let dobDisplay = data.dob && data.dob !== 'Not Found' ? data.dob : (data.age ? String(data.age) : '');
    let mfgDisplay = data.manufacturerYear && data.manufacturerYear !== 'Not Found' ? data.manufacturerYear : (data.vehicleAge ? String(data.vehicleAge) : '');

    let computedIncome = data.income || '';

    setEditData({
      policyHolderName: data.policyHolderName || '',
      dob: dobDisplay,
      income: computedIncome || '',
      vehicleRegistrationNo: data.vehicleRegistrationNo || '',
      vehicleModel: data.vehicleModel || '',
      manufacturerYear: mfgDisplay,
      idv: data.idv || data.carCost || '',
      carCost: data.estimatedOriginalCost || '',
      email: data.email || '',
      mobile: data.mobile || '',
    });
    setSourceInfo({ sources: {}, kycStatus: 'not_provided', kycNameMismatch: false });
    setAgeAssumed(false);
    setEditMode({});
    
    // Check if there are recommendations for this policy
    try {
      const recs = await fetchRecommendations(data.user_id); // the policy owner's recommendations (admins can open any policy)
      setRecommendations(recs);
    } catch (e) {
      setRecommendations([]);
    }
    
    setIsProcessing(false);
  };

  const handleUpload = async () => {

    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 20) {
      setUploadProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setIsUploading(false);
    setIsProcessing(true);
    
    try {
      const data = await analyzePolicy(file, kycFile);
      setResults(data);
      setSourceInfo({
        sources: data.sources || {},
        kycStatus: data.kycStatus || 'not_provided',
        kycNameMismatch: !!data.kycNameMismatch,
      });
      setAgeAssumed(false);
      let dobDisplay = data.dob && data.dob !== 'Not Found' ? data.dob : (data.age ? String(data.age) : '');
      let mfgDisplay = data.manufacturerYear && data.manufacturerYear !== 'Not Found' ? data.manufacturerYear : (data.vehicleAge ? String(data.vehicleAge) : '');

      let computedIncome = data.income || '';

      setEditData({
        policyHolderName: data.policyHolderName || '',
        dob: dobDisplay,
        income: computedIncome || '',
        vehicleRegistrationNo: data.vehicleRegistrationNo || '',
        vehicleModel: data.vehicleModel || '',
        manufacturerYear: mfgDisplay,
        idv: data.idv || data.carCost || '',
        carCost: data.estimatedOriginalCost || '',
        email: data.email || '',
        mobile: data.mobile || '',
      });
      setEditMode({});
      setRecommendations([]);
      setFile(null);
      setKycFile(null);
    } catch (error) {
      console.error("Error analyzing policy:", error);
      alert(`Failed to extract data: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      const updatedPolicy = await updatePolicy(results.id, editData);
      setResults(updatedPolicy);
      
      let dobDisplay = updatedPolicy.dob && updatedPolicy.dob !== 'Not Found' ? updatedPolicy.dob : (updatedPolicy.age ? String(updatedPolicy.age) : '');
      let mfgDisplay = updatedPolicy.manufacturerYear && updatedPolicy.manufacturerYear !== 'Not Found' ? updatedPolicy.manufacturerYear : (updatedPolicy.vehicleAge ? String(updatedPolicy.vehicleAge) : '');

      setEditData({
        policyHolderName: updatedPolicy.policyHolderName || '',
        dob: dobDisplay,
        income: updatedPolicy.income || '',
        vehicleRegistrationNo: updatedPolicy.vehicleRegistrationNo || '',
        vehicleModel: updatedPolicy.vehicleModel || '',
        manufacturerYear: mfgDisplay,
        idv: updatedPolicy.idv || updatedPolicy.carCost || '',
        carCost: updatedPolicy.estimatedOriginalCost || '',
        email: updatedPolicy.email || '',
        mobile: updatedPolicy.mobile || '',
      });
      // Do not auto-generate/load AI recommendations when merely saving policy data.
      // User must explicitly click "Generate AI Report" button.
    } catch (error) {
      console.error(error);
      alert('Failed to update policy manually.');
    } finally {
      setIsSaving(false);
    }
  };



  const handleEditChange = (key, val) => {
    setEditData(prev => {
      const newData = { ...prev, [key]: val };
      
      // Real-time calculation of Car Cost when IDV is typed
      if (key === 'idv' || key === 'manufacturerYear' || key === 'vehiclesOwned') {
        const idvValToUse = key === 'idv' ? val : newData.idv;
        const idvStr = String(idvValToUse || '').replace(/[^\d.]/g, '');
        const idvVal = parseFloat(idvStr);
        
        let vehicleAge = results ? results.vehicleAge : null;
        if (newData.manufacturerYear) {
          const match = String(newData.manufacturerYear).match(/\b(19\d{2}|20\d{2})\b/);
          if (match) {
            vehicleAge = Math.max(0, new Date().getFullYear() - parseInt(match[1]));
          }
        }
        
        if (!isNaN(idvVal) && vehicleAge !== undefined && vehicleAge !== null) {
          const annualDepreciation = 0.10;
          const calculatedCost = idvVal / Math.pow(1 - annualDepreciation, vehicleAge);
          newData.carCost = Math.round(calculatedCost).toString();
          
          // Dynamically recalculate Income
          let vehiclesOwned = parseInt(newData.vehiclesOwned || '1', 10);
          if (vehiclesOwned === 1) {
              newData.income = Math.round(idvVal * 3).toString();
          } else if (vehiclesOwned === 2) {
              newData.income = Math.round(idvVal * 5).toString();
          } else {
              newData.income = Math.round(idvVal * 8).toString();
          }
        } else if (idvValToUse === '') {
          newData.carCost = '';
          newData.income = '';
        }
      }
      
      
      return newData;
    });
  };

  const handleGenerateReport = async () => {
    if (!results || !results.id) return;
    
    // Auto-save any manual edits before generating the report
    await handleSaveEdits();
    
    setIsGeneratingReport(true);
    try {
      const data = await generateReport(results.id);
      // Backend returns the array directly now, or we can fetch them
      await loadRecommendations(1); // load the newly saved ones
    } catch (error) {
      console.error("Error generating report:", error);
      alert(`Failed to generate report: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const renderDropCard = ({ id, title, subtitle, tag, tagClass, selected, onChange, onClear, accept }) => (
    <div className="bg-white rounded-xl border border-blue-100/50 shadow-sm p-8 flex flex-col items-center justify-center text-center relative border-dashed border-2 min-h-[260px] hover:border-blue-400 transition-colors w-full">
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        id={id}
        title=""
      />
      <div className="w-14 h-14 bg-[#e5f0ff] rounded-full flex items-center justify-center mb-4 text-[#0066FF] shadow-sm">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      </div>
      <span className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full mb-3 ${tagClass}`}>{tag}</span>
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 font-medium">{subtitle}</p>
      {selected && (
        <div className="mt-5 w-full max-w-xs z-20 relative flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-inner">
          <span className="truncate flex-1 text-left">{selected.name}</span>
          <button type="button" onClick={onClear} className="text-slate-400 hover:text-red-500 text-lg leading-none" aria-label="Remove file">&times;</button>
        </div>
      )}
    </div>
  );

  const renderFormInput = (label, key, placeholder, forceReadOnly = false) => {
    const val = editData[key] || '';
    const isMissing = !val || val === 'N/A' || val === 'Not Found';
    // If it's missing, always allow editing. Otherwise respect forceReadOnly.
    const readOnly = isMissing ? false : forceReadOnly;
    let displayVal = val === 'Not Found' || val === 'N/A' ? '' : val;
    if (key === 'income' && !incomeFocused) {
      const n = parseFloat(String(val).replace(/[^\d.]/g, ''));
      if (!isNaN(n) && n > 0) {
        // Rounded to clean figures: 10 lakh steps above 1 crore, 1 lakh steps above 10 lakh, else 10,000
        const step = n >= 10000000 ? 1000000 : n >= 1000000 ? 100000 : 10000;
        const fmt = (x) => 'Rs. ' + (Math.round(x / step) * step).toLocaleString('en-IN');
        displayVal = `${fmt(n * 0.9)} - ${fmt(n * 1.1)}`;
      }
    }
    return (
      <div className={styles.formGroup}>
        <div className={styles.labelWrapper}>
          <label className={styles.formLabel}>{label}</label>
          {isMissing && <span className={styles.missingBadge}>MISSING</span>}
          {!isMissing && sourceInfo.sources && sourceInfo.sources[key] && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: sourceInfo.sources[key] === 'KYC' ? '#059669' : '#64748b', background: sourceInfo.sources[key] === 'KYC' ? '#ecfdf5' : '#f1f5f9', padding: '2px 8px', borderRadius: '999px' }}>from {sourceInfo.sources[key]}</span>
          )}
        </div>
        <input
          type="text"
          value={displayVal}
          onChange={!readOnly ? ((e) => handleEditChange(key, e.target.value)) : undefined}
          onFocus={key === 'income' ? () => setIncomeFocused(true) : undefined}
          onBlur={key === 'income' ? () => setIncomeFocused(false) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`${styles.formInput} ${isMissing ? styles.formInputError : ''}`}
          style={readOnly ? { color: '#334155', cursor: 'default' } : {}}
        />
      </div>
    );
  };

  const hasMissingFields = (() => {
    const requiredKeys = [
      'policyHolderName', 'dob', 'income', 'vehicleRegistrationNo',
      'vehicleModel', 'manufacturerYear', 'idv', 'carCost'
    ];
    
    return requiredKeys.some(key => {
      const val = editData[key];
      return !val || val === 'N/A' || val === 'Not Found' || String(val).trim() === '';
    });
  })();

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAndFilteredPolicies = () => {
    let filtered = [...recentPolicies];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.policyHolderName || p.extracted_name || '').toLowerCase().includes(q) ||
        (p.vehicleRegistrationNo || p.extracted_registration_no || '').toLowerCase().includes(q)
      );
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key] || a[`extracted_${sortConfig.key === 'policyHolderName' ? 'name' : sortConfig.key === 'vehicleRegistrationNo' ? 'registration_no' : ''}`] || '';
        let bVal = b[sortConfig.key] || b[`extracted_${sortConfig.key === 'policyHolderName' ? 'name' : sortConfig.key === 'vehicleRegistrationNo' ? 'registration_no' : ''}`] || '';
        if (sortConfig.key === 'idv') {
           aVal = Number(String(aVal).replace(/[^0-9.-]+/g,"")) || 0;
           bVal = Number(String(bVal).replace(/[^0-9.-]+/g,"")) || 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  };

  return (
    <div className={styles.dashboard}>
      

      
{!results ? (
  <div className="flex-1 w-full px-4 sm:px-8 flex flex-col gap-6 py-4">
    

    
    {/* Upload Component: Motor Policy (required) + Motor KYC (optional) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {renderDropCard({
        id: 'file-upload',
        title: 'Motor Insurance Policy',
        subtitle: 'Drag and drop PDF or high-res image here',
        tag: 'REQUIRED',
        tagClass: 'bg-[#e5f0ff] text-[#0066FF]',
        selected: file,
        onChange: handleFileChange,
        onClear: () => setFile(null),
        accept: '.pdf,.docx,.txt',
      })}
      {renderDropCard({
        id: 'kyc-upload',
        title: 'Motor KYC Document',
        subtitle: 'Aadhaar, PAN or licence (PDF / image). Fills DOB, mobile and email',
        tag: 'OPTIONAL - RECOMMENDED',
        tagClass: 'bg-emerald-50 text-emerald-600',
        selected: kycFile,
        onChange: handleKycChange,
        onClear: () => setKycFile(null),
        accept: '.pdf,.jpg,.jpeg,.png,.webp',
      })}
    </div>

    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-xs font-bold text-[#0066FF] bg-[#e5f0ff] px-4 py-2 rounded-full">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 12 12 12 8"></polyline><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        AI-powered OCR and validation active
      </div>
      {file && (
        <button
          onClick={handleUpload}
          disabled={isProcessing || isUploading}
          className={`w-full max-w-md bg-[#0066FF] text-white py-3 rounded-lg font-bold shadow-md transition-all ${isProcessing || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]'}`}
        >
          {isUploading ? `Uploading... ${uploadProgress}%` : isProcessing ? 'Analyzing Documents...' : (kycFile ? 'Analyze Policy + KYC Now' : 'Analyze Document Now')}
        </button>
      )}
    </div>

    {/* Recent Extractions Table */}
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col w-full">
      <div className="p-4 sm:p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
         <h3 className="text-lg font-bold text-slate-800">Recent Extraction Results</h3>
         <div className="relative">
            <input 
              type="text" 
              placeholder="Search policies..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF] transition-all"
            />
            <svg className="absolute left-3 top-2.5 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
         </div>
      </div>
      <div className="overflow-x-auto">
         <table className="w-full min-w-[560px] text-left">
           <thead>
             <tr className="border-b border-gray-50">
               <th className="p-4 pl-6 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600" onClick={() => handleSort('policyHolderName')}>Policy Holder {sortConfig.key === 'policyHolderName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
               <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600" onClick={() => handleSort('vehicleRegistrationNo')}>Reg No. {sortConfig.key === 'vehicleRegistrationNo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
               <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600" onClick={() => handleSort('vehicleModel')}>Vehicle / Year {sortConfig.key === 'vehicleModel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
               <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600" onClick={() => handleSort('idv')}>IDV {sortConfig.key === 'idv' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
               <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
             </tr>
           </thead>
           <tbody>
              {getSortedAndFilteredPolicies().map((p, i) => (
                <tr key={i} className="border-b border-gray-50/50 hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handleViewPolicy(p)}>
                  <td className="p-4 pl-6">
                     <div className="font-bold text-slate-800 text-sm group-hover:text-[#0066FF] transition-colors">{p.policyHolderName || p.extracted_name || 'N/A'}</div>
                     <div className="text-xs text-slate-400 mt-0.5">DOB: {p.dob || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                     <div className="font-mono text-sm text-slate-600 font-medium">{p.vehicleRegistrationNo || p.extracted_registration_no || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                     <div className="text-sm font-bold text-slate-700">{p.vehicleModel || 'N/A'}</div>
                     <div className="text-xs text-slate-400 mt-0.5">{p.manufacturerYear || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                     <div className="text-sm font-bold text-slate-700">Rs. {Number(p.idv) ? Number(p.idv).toLocaleString('en-IN') : p.idv || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                     <button onClick={(e) => { e.stopPropagation(); handleViewPolicy(p); }} className="text-[#0066FF] hover:text-blue-800 font-bold text-xs flex items-center gap-1 transition-colors px-3 py-1.5 border border-blue-200 rounded-full hover:bg-blue-50">
                        View <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                     </button>
                  </td>
                </tr>
              ))}
              
              {/* Mock Pending Row */}
              <tr className="border-b border-gray-50/50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6">
                     <div className="font-bold text-slate-800 text-sm">Anita Sharma</div>
                     <div className="text-xs text-slate-400 mt-0.5">DOB: 24/11/1992</div>
                  </td>
                  <td className="p-4">
                     <div className="font-mono text-sm text-slate-600 font-medium">DL-03-XY-9876</div>
                  </td>
                  <td className="p-4">
                     <div className="text-sm font-bold text-slate-700">Maruti Swift</div>
                     <div className="text-xs text-slate-400 mt-0.5">2019</div>
                  </td>
                  <td className="p-4">
                     <div className="text-sm font-bold text-slate-700">Rs. 4,80,000</div>
                  </td>
                  <td className="p-4">
                     <button className="text-gray-400 opacity-50 cursor-not-allowed font-bold text-xs flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-full">
                        View <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                     </button>
                  </td>
              </tr>
           </tbody>
         </table>
      </div>
    </div>
    
  </div>
      ) : (
        <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
          <div className={`${styles.hideOnPrint} ${styles.resultsHeader}`} style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => { setResults(null); setFile(null); setEditData({}); setRecommendations([]); }} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </button>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Extracted Details</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, marginTop: '2px' }}>Review and complete the extracted policy information</p>
              </div>
            </div>
            {recommendations.length > 0 && (
              <div className={styles.successBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Analysis Complete
              </div>
            )}
          </div>
          
          <div className={`${styles.hideOnPrint} ${styles.policyBody}`}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.5rem' }}>Policy Information</h3>
            
            {hasMissingFields && (
              <div className={styles.alertBanner}>
                <div className={styles.alertIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div>Some details could not be extracted automatically from the document. Please manually input the missing information in the highlighted fields below.</div>
              </div>
            )}
            
            <div className={styles.formGrid}>
              {/* Extracted Details - Read Only Sequence */}
              {renderFormInput('Policy Holder Name', 'policyHolderName', 'N/A', true)}
              {renderFormInput('Vehicle Registration Number', 'vehicleRegistrationNo', 'N/A', true)}
              {renderFormInput('Vehicle Make & Model', 'vehicleModel', 'N/A', true)}
              
              <div className={styles.formGroup}>
                <div className={styles.labelWrapper}>
                  <label className={styles.formLabel}>Manufacture Year</label>
                </div>
                <input
                  type="text"
                  value={editData.manufacturerYear === 'Not Found' || editData.manufacturerYear === 'N/A' ? '' : editData.manufacturerYear}
                  readOnly
                  className={styles.formInput}
                  style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'default' }}
                />
                {editData.manufacturerYear && editData.manufacturerYear !== 'Not Found' && editData.manufacturerYear !== 'N/A' && (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', fontWeight: '500' }}>
                    Vehicle Age: {new Date().getFullYear() - parseInt(String(editData.manufacturerYear).match(/\b(19\d{2}|20\d{2})\b/)?.[1] || new Date().getFullYear())} Years
                  </div>
                )}
              </div>
              
              {renderFormInput('IDV (Insured Declared Value)', 'idv', 'N/A', true)}
              {renderFormInput('Estimate Vehicle Cost', 'carCost', 'N/A', true)}
            </div>
            

            <div className={styles.formGrid}>

              {/* Manual Input Section */}
              <div className={styles.formGroup}>
                <div className={styles.labelWrapper}>
                  <label className={styles.formLabel}>Total Vehicles Owned</label>
                </div>
                <select
                  value={editData.vehiclesOwned || '1'}
                  onChange={(e) => handleEditChange('vehiclesOwned', e.target.value)}
                  className={styles.formInput}
                >
                  <option value="1">1 (Primary Vehicle)</option>
                  <option value="2">2 (Secondary Vehicle)</option>
                  <option value="3">3+ Vehicles</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.labelWrapper}>
                  <label className={styles.formLabel}>Date of Birth (DOB)</label>
                  {sourceInfo.sources && sourceInfo.sources.dob && !ageAssumed && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: sourceInfo.sources.dob === 'KYC' ? '#059669' : '#64748b', background: sourceInfo.sources.dob === 'KYC' ? '#ecfdf5' : '#f1f5f9', padding: '2px 8px', borderRadius: '999px' }}>from {sourceInfo.sources.dob}</span>
                  )}
                  {(!editData.dob || editData.dob === 'Not Found' || editData.dob === 'N/A') && <span className={styles.missingBadge}>MISSING</span>}
                </div>
                <input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={editData.dob === 'Not Found' || editData.dob === 'N/A' ? '' : editData.dob}
                  onChange={(e) => {
                    const dobVal = e.target.value;
                    let ageVal = '';
                    if (dobVal) {
                      const dobDate = new Date(dobVal);
                      const today = new Date();
                      let age = today.getFullYear() - dobDate.getFullYear();
                      const m = today.getMonth() - dobDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                        age--;
                      }
                      ageVal = age;
                    }
                    setAgeAssumed(false);
                    setEditData(prev => ({ ...prev, dob: dobVal, age: ageVal }));
                  }}
                  className={`${styles.formInput} ${(!editData.dob || editData.dob === 'Not Found' || editData.dob === 'N/A') ? styles.formInputError : ''}`}
                />
                {(!editData.dob || editData.dob === 'Not Found' || editData.dob === 'N/A') && (
                  <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' }}>Please select Date of Birth.
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date().getFullYear() - 35;
                        setEditData(prev => ({ ...prev, dob: `${y}-07-01`, age: 35 }));
                        setAgeAssumed(true);
                      }}
                      style={{ marginLeft: '0.5rem', color: '#0066FF', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                    >Assume age 35</button>
                  </div>
                )}
                {editData.dob && editData.dob !== 'Not Found' && editData.dob !== 'N/A' && (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', fontWeight: '500' }}>
                    Age: {(() => {
                      const dobDate = new Date(editData.dob);
                      const today = new Date();
                      let age = today.getFullYear() - dobDate.getFullYear();
                      const m = today.getMonth() - dobDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                        age--;
                      }
                      return age;
                    })()} Years
                  </div>
                )}
                {ageAssumed && (
                  <div style={{ fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.4rem 0.6rem', marginTop: '0.4rem' }}>
                    Using an assumed age of 35. Enter the real date of birth above whenever you have it.
                  </div>
                )}
              </div>
              
              {renderFormInput('Income', 'income', 'Enter income manually')}
              {renderFormInput('Client Email', 'email', 'Needed to email the report')}
              {renderFormInput('Mobile Number', 'mobile', 'Optional')}
              {sourceInfo.kycStatus === 'unreadable' && (
                <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.6rem 0.9rem' }}>
                  The KYC document could not be read. Please enter the missing details manually.
                </div>
              )}
              {sourceInfo.kycNameMismatch && (
                <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.6rem 0.9rem' }}>
                  The name on the KYC does not match the policy holder name. Please check both documents before continuing.
                </div>
              )}

            </div>
            
            <div className={styles.formGrid} style={{ marginTop: '2rem' }}>
              {/* Removed vehicle questions */}
            </div>
            

            {/* Generate Report Button - show after saving (when recommendations would be available) or just always show if results are present */}
            {recommendations.length === 0 && (
              <div className={styles.hideOnPrint} style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button 
                  className={styles.generateBtn}
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport || isSaving}
                >
                  {isGeneratingReport ? 'Generating Report...' : 'Generate Report'}
                </button>
              </div>
            )}

          </div>
          
          {recommendations.length > 0 && (
            <div className={styles.recBody}>
              <div className={styles.hideOnPrint} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#9333ea', fontSize: '1.25rem', fontWeight: 800 }}>
                  Analysis Report
                </div>
              </div>
              {(() => {
                const vehicleProfileRec = recommendations.find(r => r.recommendation_type === 'Vehicle Profile');
                const otherRecs = recommendations.filter(r => r.recommendation_type !== 'Vehicle Profile');
                
                return (
                  <>
                    <div className={`${styles.aiCardsGrid} ${styles.hideOnPrint}`}>
                      {otherRecs.map((rec) => {
                        let data = {};
                        try {
                          data = typeof rec.description === 'string' ? JSON.parse(rec.description) : rec.description;
                        } catch (e) {
                          data = { recommended_sum: rec.description }; // fallback
                        }
                        
                        const stripCurrency = (val) => {
                          if (!val) return 'N/A';
                          return String(val).replace(/[\$]/g, '').trim();
                        };
                  
                  return (
                    <RecommendationCard 
                      key={rec.id} 
                      rec={rec} 
                      data={data} 
                      isExpanded={expandedRecs[rec.id]} 
                      toggleExpand={toggleExpand} 
                    />
                  );
                  })}
                    </div>
                    
                    {/* Print Only Report Format */}
                    <div className={styles.showOnPrint}>
                      <div style={{ marginBottom: '20px', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px' }}>
                        <h2 style={{ color: '#1e3a8a', margin: '0 0 10px 0', fontSize: '24px' }}>Insurance Advisory Report</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                          <div><strong>Policyholder:</strong> {editData.policyHolderName || 'N/A'}</div>
                          <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                        </div>
                      </div>
                      
                      <table className={styles.printTable}>
                        <thead>
                          <tr>
                            <th style={{ width: '15%' }}>Insurance Type</th>
                            <th style={{ width: '20%' }}>Recommended Cover</th>
                            <th style={{ width: '10%' }}>Term</th>
                            <th style={{ width: '15%' }}>Risk Level</th>
                            <th style={{ width: '40%' }}>Key Benefits</th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherRecs.map((rec) => {
                            let data = {};
                            try {
                              data = typeof rec.description === 'string' ? JSON.parse(rec.description) : rec.description;
                            } catch (e) {
                              data = { recommended_sum: rec.description };
                            }
                            
                            let cover = rec.recommendation_type === 'Personal Accident Cover Recommendation' 
                                ? data.recommended_pa_cover_display
                                : (rec.recommendation_type === 'Term Insurance' 
                                    ? (data.hlv_details?.recommended_term_cover || data.recommended_sum)
                                    : data.recommended_sum
                                  );
                            
                            let coverStr = 'N/A';
                            if (cover) {
                              let str = String(cover).replace(/[\$,]/g, '').trim();
                              let rawValue = 0;
                              const match = str.match(/([\d\.]+)\s*(Crore|Lakh|Cr|L|K|Thousand)?/i);
                              if (match) {
                                  let num = parseFloat(match[1]);
                                  let unit = (match[2] || '').toLowerCase();
                                  if (unit.includes('cr')) rawValue = num * 10000000;
                                  else if (unit.includes('l')) rawValue = num * 100000;
                                  else if (unit.includes('k') || unit.includes('thousand')) rawValue = num * 1000;
                                  else rawValue = num; 
                              } else {
                                  rawValue = parseFloat(str);
                              }
                              
                              if (!isNaN(rawValue)) {
                                  let upperRaw = rawValue;
                                  if (rec.recommendation_type === 'Health Insurance') upperRaw += 10000000;
                                  else if (rec.recommendation_type === 'Term Insurance') upperRaw += 10000000;
                                  else if (rec.recommendation_type === 'Personal Accident Cover Recommendation') upperRaw += 10000000;
                                  else if (rec.recommendation_type === 'Critical Illness') upperRaw += 1000000;
                                  else if (rec.recommendation_type === 'Cyber Insurance') upperRaw += 1500000;
                                  else upperRaw *= 1.25;
      
                                  const formatAmount = (amount) => {
                                      if (amount >= 10000000) return `${Math.round(amount / 10000000)} Crore`;
                                      else if (amount >= 100000) return `${Math.round(amount / 100000)} Lakh`;
                                      else return `${Math.round(amount)}`;
                                  };
                                  
                                  coverStr = `${formatAmount(rawValue)} to ${formatAmount(upperRaw)}`;
                              } else {
                                  coverStr = `${str}`;
                              }
                            }
                            
                            let risk = 'Standard Risk';
                            if (rec.recommendation_type === 'Critical Illness') {
                              risk = data.critical_illness_details?.risk_level || 'Standard Risk';
                            } else if (rec.recommendation_type === 'Cyber Insurance') {
                              risk = data.cyber_details?.risk_level || 'Standard Risk';
                            }
                            
                            let benefits = data.key_benefits || [];
                            if (rec.recommendation_type === 'Personal Accident Cover Recommendation') {
                              benefits = ['Lump-sum payout in case of accidental death', 'Financial protection against permanent total disability', 'Helps maintain family income after an accident', 'Covers accident-related financial liabilities', 'Provides additional security beyond health insurance'];
                            } else if (rec.recommendation_type === 'Term Insurance') {
                              benefits = ['Financial security for family members', 'Income replacement for dependents', 'Protection against outstanding loans', 'Provides long-term financial stability', 'Peace of mind for policyholder and nominee'];
                            }
                            
                            return (
                              <tr key={rec.id}>
                                <td><strong>{rec.recommendation_type === 'Personal Accident Cover Recommendation' ? 'Personal Accident' : rec.recommendation_type.replace(' Recommendation', '')}</strong></td>
                                <td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{coverStr}</td>
                                <td>{data.policy_term_or_coverage || '1 Year'}</td>
                                <td>{risk}</td>
                                <td>
                                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#475569' }}>
                                    {benefits.slice(0, 4).map((b, i) => <li key={i} style={{ marginBottom: '4px' }}>{b}</li>)}
                                  </ul>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
              
              {/* Bottom Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }} className={styles.hideOnPrint}>
                <button 
                  onClick={() => generatePDFReport(results, recommendations)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.9rem', transition: 'all 0.2s' }}
                  className="hover:bg-slate-50 active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Download report
                </button>
                <button 
                  onClick={() => router.push('/dashboard/ask-ai')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px rgba(15,23,42,0.2)', fontSize: '0.9rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
                  ASK AI
                </button>
              </div>

            </div>
          )}
        </div>
      )}
      

      
    </div>
  );
}
