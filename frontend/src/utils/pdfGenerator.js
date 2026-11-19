import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDFReport = (results, recommendations) => {
  try {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(0, 102, 255); // Cover360 Blue
    doc.text('Cover360 Insurance Report', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 32, 196, 32);

    // Section 1: Basic Information
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Basic Information', 14, 42);

    const safeResults = results || {};

    const basicInfoData = [
      ['Policy Holder', safeResults.policyHolderName || safeResults.extracted_name || 'N/A'],
      ['Date of Birth', safeResults.dob || 'N/A'],
      ['Registration No.', safeResults.vehicleRegistrationNo || safeResults.extracted_registration_no || 'N/A'],
      ['Vehicle Model', safeResults.vehicleModel || 'N/A'],
      ['Manufacturer Year', safeResults.manufacturerYear || 'N/A'],
      ['IDV', safeResults.idv ? `Rs. ${Number(safeResults.idv).toLocaleString('en-IN')}` : 'N/A']
    ];

    autoTable(doc, {
      startY: 48,
      body: basicInfoData,
      theme: 'plain',
      styles: { fontSize: 11, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 50 },
        1: { textColor: [15, 23, 42] }
      }
    });

    // Section 2: Insurance Recommendations
    let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 100;
    
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Insurance Recommendations', 14, finalY + 15);
    
    finalY += 20;

    if (!recommendations || recommendations.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text('No recommendations available.', 14, finalY + 5);
    } else {
      recommendations.forEach((rec, index) => {
        let data = {};
        try {
          data = typeof rec.description === 'string' ? JSON.parse(rec.description) : (rec.description || {});
        } catch (e) {
          data = { recommended_sum: rec.description || '' };
        }

        const recType = rec.recommendation_type || 'Recommended Cover';
        const recTitle = recType === 'Personal Accident Cover Recommendation' 
          ? 'Personal Accident Insurance' 
          : recType.replace(' Recommendation', '');
          
        let cover = recType === 'Personal Accident Cover Recommendation' 
            ? data.recommended_pa_cover_display
            : (recType === 'Term Insurance' 
                ? (data.hlv_details?.recommended_term_cover || data.recommended_sum)
                : data.recommended_sum
              );
        
        let coverStr = 'N/A';
        if (cover) {
          let str = String(cover).replace(/[\$,]/g, '').trim();
          str = str.replace(/₹/g, '').trim();
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
              if (recType === 'Health Insurance') upperRaw += 10000000;
              else if (recType === 'Term Insurance') upperRaw += 10000000;
              else if (recType === 'Personal Accident Cover Recommendation') upperRaw += 10000000;
              else if (recType === 'Critical Illness') upperRaw += 1000000;
              else if (recType === 'Cyber Insurance') upperRaw += 1500000;
              else upperRaw *= 1.25;

              const formatAmount = (amount) => {
                  if (amount >= 10000000) return `${Math.round(amount / 10000000)} Crore`;
                  else if (amount >= 100000) return `${Math.round(amount / 100000)} Lakh`;
                  else return `${Math.round(amount)}`;
              };
              
              coverStr = `Rs. ${formatAmount(rawValue)} - ${formatAmount(upperRaw)}`;
          } else {
              coverStr = `${str}`;
          }
        }
        
        let risk = 'Standard Risk';
        if (recType === 'Critical Illness') risk = data.critical_illness_details?.risk_level || 'Standard Risk';
        else if (recType === 'Cyber Insurance') risk = data.cyber_details?.risk_level || 'Standard Risk';

        let term = data.policy_term_or_coverage || '1 Year';

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 255);
        
        if (finalY > 260) {
          doc.addPage();
          finalY = 20;
        }
        
        doc.text(`${index + 1}. ${recTitle}`, 14, finalY + 5);
        
        const recData = [
          ['Suggested Cover:', coverStr],
          ['Policy Term:', term],
          ['Risk Level:', risk]
        ];
        
        let benefits = data.key_benefits || [];
        if (recType === 'Personal Accident Cover Recommendation') {
          benefits = ['Lump-sum payout in case of accidental death', 'Financial protection against permanent total disability', 'Helps maintain family income after an accident', 'Covers accident-related financial liabilities', 'Provides additional security beyond health insurance'];
        } else if (recType === 'Term Insurance') {
          benefits = ['Financial security for family members', 'Income replacement for dependents', 'Protection against outstanding loans', 'Provides long-term financial stability', 'Peace of mind for policyholder and nominee'];
        }

        let benefitsStr = '';
        if (benefits && Array.isArray(benefits)) {
           benefitsStr = benefits.map(b => `• ${b}`).join('\n');
           recData.push(['Key Benefits:', benefitsStr]);
        }

        autoTable(doc, {
          startY: finalY + 8,
          body: recData,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 3, lineColor: [226, 232, 240] },
          columnStyles: {
            0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 40 },
            1: { textColor: [15, 23, 42] }
          }
        });
        
        finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : finalY + 40;
      });
    }

    const filename = safeResults.vehicleRegistrationNo 
      ? `Cover360_Report_${safeResults.vehicleRegistrationNo}.pdf` 
      : 'Cover360_Report.pdf';
      
    doc.save(filename);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    alert("Failed to generate PDF report: " + error.message);
  }
};
