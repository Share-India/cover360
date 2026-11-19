'use client';

import { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';

const formatAmount = (amount) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1).replace('.0', '')} Crore`;
  else if (amount >= 100000) return `${(amount / 100000).toFixed(1).replace('.0', '')} Lakh`;
  else return `${Math.round(amount)}`;
};

const formatRange = (min, max) => {
  if (min >= 10000000 && max >= 10000000) {
    return `(${(min / 10000000).toFixed(1).replace('.0', '')} - ${(max / 10000000).toFixed(1).replace('.0', '')}) Crore`;
  } else if (min >= 100000 && max >= 100000) {
    return `(${(min / 100000).toFixed(1).replace('.0', '')} - ${(max / 100000).toFixed(1).replace('.0', '')}) Lakh`;
  } else {
    return `(${formatAmount(min)} - ${formatAmount(max)})`;
  }
};

export default function RecommendationCard({ rec, data, isExpanded, toggleExpand }) {
  // Determine Base Cover
  let baseCover = rec.recommendation_type === 'Personal Accident Cover Recommendation' 
    ? data.recommended_pa_cover_display
    : (rec.recommendation_type === 'Term Insurance' 
        ? (data.hlv_details?.recommended_term_cover || data.recommended_sum)
        : data.recommended_sum
      );
      
  let rawValue = 0;
  if (baseCover) {
      let str = String(baseCover).replace(/[\$,]/g, '').trim();
      const match = str.match(/([\d\.]+)\s*(Crore|Lakh|Cr|L|K|Thousand)?/i);
      if (match) {
          let num = parseFloat(match[1]);
          let unit = (match[2] || '').toLowerCase();
          if (unit.includes('cr')) rawValue = num * 10000000;
          else if (unit.includes('l')) rawValue = num * 100000;
          else if (unit.includes('k') || unit.includes('thousand')) rawValue = num * 1000;
          else rawValue = num; 
      } else {
          rawValue = parseFloat(str) || 0;
      }
  }

  // Determine Upper Bound
  let upperRaw = rawValue;
  if (rawValue > 0) {
      if (rec.recommendation_type === 'Health Insurance') upperRaw += 10000000;
      else if (rec.recommendation_type === 'Term Insurance') upperRaw += 10000000;
      else if (rec.recommendation_type === 'Personal Accident Cover Recommendation') upperRaw += 10000000;
      else if (rec.recommendation_type === 'Critical Illness') upperRaw += 1000000;
      else if (rec.recommendation_type === 'Cyber Insurance') upperRaw += 1500000;
      else upperRaw *= 1.25;
  }

  // State for slider
  const [sliderValue, setSliderValue] = useState(rawValue);
  const [multiplier, setMultiplier] = useState(1.0);
  
  useEffect(() => {
    setSliderValue(rawValue);
  }, [rawValue]);

  const handleSliderChange = (e) => {
    setSliderValue(Number(e.target.value));
  };

  // Risk Level
  let risk = 'Standard Risk';
  if (rec.recommendation_type === 'Critical Illness') {
    risk = data.critical_illness_details?.risk_level || 'Standard Risk';
  } else if (rec.recommendation_type === 'Cyber Insurance') {
    risk = data.cyber_details?.risk_level || 'Standard Risk';
  }
  
  let riskClass = styles.riskStandardRisk || 'text-yellow-600 bg-yellow-50';
  let RiskIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
  
  if (risk.toLowerCase().includes('low')) {
      riskClass = styles.riskLow || 'text-green-600 bg-green-50';
      RiskIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>;
  } else if (risk.toLowerCase().includes('high')) {
      riskClass = styles.riskHigh || 'text-red-600 bg-red-50';
      RiskIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
  }

  // Premium Calculation (Mock)
  let baseRate = 0.005; 
  if (rec.recommendation_type === 'Health Insurance') baseRate = 0.012;
  if (rec.recommendation_type === 'Term Insurance') baseRate = 0.002;
  if (rec.recommendation_type === 'Personal Accident Cover Recommendation') baseRate = 0.0015;
  
  let riskMultiplier = 1.0;
  if (risk.toLowerCase().includes('low')) riskMultiplier = 0.8;
  if (risk.toLowerCase().includes('high')) riskMultiplier = 1.5;

  const estimatedPremiumAnnual = sliderValue * baseRate * riskMultiplier * multiplier;
  const estimatedPremiumMonthly = estimatedPremiumAnnual / 12;

  // Benefits
  let benefits = data.key_benefits || [];
  
  const visibleBenefits = isExpanded ? benefits : benefits.slice(0, 3);
  const hasMore = benefits.length > 3;

  const title = rec.recommendation_type === 'Personal Accident Cover Recommendation' 
    ? 'Personal Accident Insurance' 
    : rec.recommendation_type.replace(' Recommendation', '');

  return (
    <div className={styles.premiumCard}>
      <div className={styles.premiumCardHeader}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div>
                <h4 className={styles.premiumCardTitle}>{title}</h4>
                <div className={styles.aiReasoningBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 16 12 12 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    <span><strong>AI Reasoning:</strong> Recommended based on risk profile and coverage gap analysis.</span>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Premium Multiplier</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                    <span style={{ padding: '4px 8px', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, background: '#e2e8f0' }}>x</span>
                    <input 
                        type="number" 
                        step="0.1" 
                        min="0.1" 
                        max="10" 
                        value={multiplier} 
                        onChange={(e) => setMultiplier(parseFloat(e.target.value) || 0)} 
                        style={{ width: '60px', padding: '4px 8px', border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}
                    />
                </div>
            </div>
        </div>
      </div>
      
      <div className={styles.premiumCoverSection}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div>
                <span className={styles.premiumCoverLabel}>Recommended Range</span>
                <div className={styles.premiumCoverAmount}>
                {rawValue > 0 ? formatRange(rawValue, upperRaw) : (baseCover || 'N/A')}
                </div>
            </div>
            {rawValue > 0 && (
                <div className={styles.premiumEstimate} style={{ textAlign: 'center' }}>
                    <span className={styles.premiumEstimateLabel}>Selected Cover</span>
                    <span className={styles.premiumEstimateValue} style={{ color: '#0066FF' }}>₹ {formatAmount(sliderValue)}</span>
                </div>
            )}
            {rawValue > 0 && (
                <div className={styles.premiumEstimate}>
                    <span className={styles.premiumEstimateLabel}>Est. Premium</span>
                    <span className={styles.premiumEstimateValue}>₹ {Math.round(estimatedPremiumMonthly).toLocaleString('en-IN')}<small style={{fontSize: '0.6em', color: '#94a3b8'}}>/mo</small></span>
                </div>
            )}
        </div>
        
        {rawValue > 0 && upperRaw > rawValue && (
            <div className={styles.sliderContainer}>
                <input 
                    type="range" 
                    min={rawValue} 
                    max={upperRaw} 
                    step={100000}
                    value={sliderValue} 
                    onChange={handleSliderChange}
                    className={styles.coverSlider}
                />
                <div className={styles.sliderLabels}>
                    <span>{formatAmount(rawValue)}</span>
                    <span>{formatAmount(upperRaw)}</span>
                </div>
            </div>
        )}
      </div>

      <div className={styles.premiumBadgesRow}>
        <div className={styles.premiumBadgeItem}>
          <span className={styles.premiumBadgeLabel}>Policy Term</span>
          <span className={styles.premiumBadgeValue}>
            {data.policy_term_or_coverage || '1 Year'}
          </span>
        </div>
        
        <div className={styles.premiumBadgeItem}>
          <span className={styles.premiumBadgeLabel}>Risk Level</span>
          <span className={`${styles.premiumBadgeValue} ${riskClass}`} style={{display: 'flex', alignItems: 'center'}}>
            <RiskIcon />
            {risk}
          </span>
        </div>
      </div>

      <div className={styles.premiumBenefitsSection}>
        <div className={styles.premiumBenefitsLabel}>Key Benefits</div>
        <ul className={styles.premiumBenefitsList}>
            {visibleBenefits.map((benefit, i) => (
                <li key={i} className={styles.premiumBenefitItem}>
                <span style={{color: '#0066ff', marginRight: '8px', fontSize: '1.2em'}}>•</span>
                <span>{benefit}</span>
                </li>
            ))}
            {hasMore && (
                <li className={styles.viewMoreItem} onClick={() => toggleExpand(rec.id)} style={{cursor: 'pointer', color: '#0066ff', fontSize: '0.875rem', fontWeight: 'bold', marginTop: '8px'}}>
                {isExpanded ? 'View Less' : `+ ${benefits.length - 3} More Benefits`}
                </li>
            )}
        </ul>
      </div>
    </div>
  );
}
