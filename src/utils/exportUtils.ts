/**
 * Export Utilities for Fleet Management System
 * Handles CSV generation with UTF-8 BOM (for Bengali Unicode support)
 * and PDF generation using high-quality print-ready HTML popups.
 */

/**
 * Downloads data as a CSV file.
 * Automatically inserts UTF-8 BOM (\uFEFF) so Excel opens Bengali characters correctly.
 */
export const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Excel needs the UTF-8 BOM to correctly render Bengali unicode
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Renders a highly polished print-ready page in a new window and triggers window.print().
 * This bypasses iframe print limitations and allows native Save to PDF with Bengali script rendering.
 */
export const exportPDFWindow = (title: string, subtitle: string, metadata: { label: string; value: string }[], headers: string[], rows: string[][], footerNotes?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("পপ-আপ উইন্ডোটি ব্লক করা হয়েছে। দয়া করে আপনার ব্রাউজারের পপ-আপ সেটিংস পারমিশন দিন এবং পুনরায় চেষ্টা করুন।");
    return;
  }

  const metadataHtml = metadata
    .map(meta => `
      <div class="meta-item">
        <span class="meta-label">${meta.label}:</span>
        <span class="meta-value">${meta.value}</span>
      </div>
    `)
    .join('');

  const headersHtml = headers.map(h => `<th>${h}</th>`).join('');
  
  const rowsHtml = rows
    .map(row => `
      <tr>
        ${row.map(cell => `<td>${cell || '-'}</td>`).join('')}
      </tr>
    `)
    .join('');

  const todayStr = new Date().toLocaleString('bn-BD');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 40px;
          line-height: 1.5;
          font-size: 12px;
        }
        
        .header {
          border-bottom: 2px solid #0284c7;
          padding-bottom: 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        
        .title-area h1 {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        
        .title-area p {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }
        
        .date-badge {
          font-size: 10px;
          color: #64748b;
          text-align: right;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        
        .meta-item {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 4px;
        }
        
        .meta-label {
          font-weight: 600;
          color: #475569;
        }
        
        .meta-value {
          font-weight: 700;
          color: #0f172a;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          page-break-inside: auto;
        }
        
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 600;
          text-align: left;
          padding: 10px 12px;
          border: 1px solid #1e293b;
          font-size: 11px;
          text-transform: uppercase;
        }
        
        td {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          vertical-align: top;
          font-size: 11px;
        }
        
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 9px;
          text-transform: uppercase;
        }
        
        .badge-completed {
          background-color: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        
        .badge-running {
          background-color: #dbeafe;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        
        .badge-suspended {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        
        .badge-active {
          background-color: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .footer {
          margin-top: 50px;
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
          page-break-inside: avoid;
        }
        
        @media print {
          body {
            padding: 20px;
            font-size: 11px;
          }
          .no-print {
            display: none;
          }
          table {
            border: 1px solid #cbd5e1;
          }
          th {
            background-color: #1e293b !important;
            color: #000000 !important; /* better for printer contrast sometimes, or keep dark text if colored */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .meta-grid {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title-area">
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="date-badge">
          <strong>রিপোর্ট প্রকাশের তারিখ:</strong><br/>
          ${todayStr}
        </div>
      </div>
      
      <div class="meta-grid">
        ${metadataHtml}
      </div>
      
      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      
      ${footerNotes ? `
        <div style="margin-top: 20px; padding: 12px; background-color: #fef08a; border: 1px solid #fef08a; border-radius: 6px; font-size: 10px; color: #713f12;">
          ${footerNotes}
        </div>
      ` : ''}
      
      <div class="footer">
        © ${new Date().getFullYear()} Fleet Logistics Smart Management System. All Rights Reserved. This is an official system generated report.
      </div>
      
      <script>
        // Auto trigger browser print dialog once components are drawn
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Generates an official, print-ready Staff Biodata & Performance Sheet.
 * Bypasses iframe restrictions and renders Bengali script flawlessly with professional styling.
 */
export const exportStaffProfilePrint = (
  staff: any, 
  performance: {
    rating: number;
    grade: string;
    totalTrips: number;
    monthlyTrips: number;
    dutyHoursFormatted?: string;
    activeTrip?: any;
    statusText: string;
    notesCount?: number;
  }, 
  recentTrips: any[],
  staffNotes?: any[]
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("পপ-আপ উইন্ডোটি ব্লক করা হয়েছে। দয়া করে আপনার ব্রাউজারের পপ-আপ সেটিংস পারমিশন দিন এবং পুনরায় চেষ্টা করুন।");
    return;
  }

  const roleLabel = staff.role === 'Helper' ? 'হেলপার' : 'ড্রাইভার';
  const joinDate = staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString('bn-BD') : (staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('bn-BD') : 'N/A');
  const printDate = new Date().toLocaleString('bn-BD');

  // Relation translation helper
  const getRelationLabel = (rel?: string) => {
    switch (rel) {
      case 'Father': return 'বাবা';
      case 'Mother': return 'মা';
      case 'Wife': return 'স্ত্রী';
      case 'Husband': return 'স্বামী';
      case 'Brother': return 'ভাই';
      case 'Sister': return 'বোন';
      case 'Son': return 'ছেলে';
      case 'Daughter': return 'মেয়ে';
      case 'Guardian': return 'অভিভাবক';
      case 'Uncle': return 'চাচা/মামা';
      case 'Relative': return 'আত্মীয়/স্বজন';
      case 'Other': return 'অন্যান্য';
      default: return rel || 'উল্লেখ নেই';
    }
  };

  const tripsHtml = recentTrips && recentTrips.length > 0
    ? recentTrips.slice(0, 8).map((trip, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${trip.vehiclePlate || 'গাড়ির নম্বর নেই'}</strong></td>
        <td>${trip.location || 'গন্তব্য উল্লেখ নেই'}</td>
        <td>${trip.createdAt?.toDate ? trip.createdAt.toDate().toLocaleDateString('bn-BD') : (trip.createdAt ? new Date(trip.createdAt).toLocaleDateString('bn-BD') : '-')}</td>
        <td><span class="badge ${trip.status === 'Completed' ? 'badge-completed' : (trip.status === 'Running' ? 'badge-running' : 'badge-suspended')}">${trip.status}</span></td>
      </tr>
    `).join('')
    : `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">কোনো পূর্ববর্তী ট্রিপ রেকর্ড পাওয়া যায়নি।</td></tr>`;

  const notesHtml = staffNotes && staffNotes.length > 0
    ? staffNotes.slice(0, 5).map((n) => `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; margin-bottom:6px; font-size:10.5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span style="font-weight:700; color:#0f172a;">${n.authorName || 'এডমিন/ম্যানেজার'} (${n.authorRole || 'Admin'})</span>
          <span style="color:#d97706; font-weight:800;">${'★'.repeat(Math.round(n.rating || 5))} ${Number(n.rating || 5).toFixed(1)}</span>
        </div>
        <div style="color:#334155; font-size:11px; margin-bottom:2px;">"${n.noteText || ''}"</div>
        <div style="font-size:9.5px; color:#64748b; display:flex; justify-content:space-between;">
          <span>📅 ${n.dateString || ''} (${n.dayOfWeek || ''}) ${n.timeString || ''}</span>
          <span>🚗 গাড়ি: ${n.vehiclePlate || 'N/A'}</span>
        </div>
      </div>
    `).join('')
    : '<div style="color:#94a3b8; font-size:11px; padding:6px; text-align:center;">কোনো অফিসিয়াল নোট বা মন্তব্য লিপিবদ্ধ করা হয়নি।</div>';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>স্টাফ প্রোফাইল ও বায়োডাটা - ${staff.name} (${staff.driverId})</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 32px 40px;
          line-height: 1.5;
          font-size: 12px;
          background: #ffffff;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .header-title h1 {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .header-title p {
          font-size: 11px;
          color: #475569;
          margin: 3px 0 0 0;
        }
        .doc-badge {
          text-align: right;
          font-size: 10px;
          color: #64748b;
        }
        .doc-badge strong {
          color: #0f172a;
          font-size: 11px;
        }

        /* Profile Banner */
        .profile-hero {
          display: flex;
          gap: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
          align-items: center;
        }
        .avatar-box {
          width: 72px;
          height: 72px;
          border-radius: 12px;
          background: #0284c7;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: bold;
          border: 2px solid #38bdf8;
        }
        .hero-info h2 {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 4px 0;
          color: #0f172a;
        }
        .hero-tags {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .pill {
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .pill-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
        .pill-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .pill-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

        /* Grid sections */
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
          background: #ffffff;
        }
        .card-header {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 8px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px dashed #f1f5f9;
          font-size: 11px;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-val { color: #0f172a; font-weight: 700; text-align: right; }

        /* Performance Scorecard */
        .perf-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .perf-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }
        .perf-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .perf-val { font-size: 18px; font-weight: 800; color: #0f172a; margin: 4px 0; }
        .perf-sub { font-size: 9px; color: #0284c7; font-weight: 600; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          padding: 8px 10px;
          font-weight: 600;
          text-align: left;
          border: 1px solid #1e293b;
        }
        td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tr:nth-child(even) { background: #f8fafc; }

        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 9px;
            @media print {
          body { padding: 20px; }
          .no-print { display: none; }
          th { background: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .profile-hero, .perf-card { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-title">
          <h1>Fleet Logistics & Transport Management</h1>
          <p>অফিসিয়াল স্টাফ বায়োডাটা, পরিচিতি ও পারফরম্যান্স প্রোফাইল</p>
        </div>
        <div class="doc-badge">
          প্রিন্ট তারিখ: <strong>${printDate}</strong><br/>
          স্টাফ আইডি: <strong>${staff.driverId}</strong>
        </div>
      </div>

      <!-- Hero Banner -->
      <div class="profile-hero">
        <div class="avatar-box">
          ${staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
        </div>
        <div class="hero-info">
          <h2>${staff.name}</h2>
          <div class="hero-tags">
            <span class="pill pill-blue">${roleLabel}</span>
            <span class="pill ${staff.isSuspended ? 'pill-red' : 'pill-green'}">
              ${staff.isSuspended ? `সাসপেন্ডেড (${staff.suspensionDays || 0} দিন)` : performance.statusText}
            </span>
            <span class="pill pill-blue">আইডি: ${staff.driverId}</span>
          </div>
        </div>
      </div>

      <!-- Performance Scorecard -->
      <div class="perf-grid">
        <div class="perf-card">
          <div class="perf-title">পারফরম্যান্স রেটিং</div>
          <div class="perf-val">${performance.rating.toFixed(1)} / 5.0</div>
          <div class="perf-sub">গ্রেড: ${performance.grade}</div>
        </div>
        <div class="perf-card">
          <div class="perf-title">চলতি মাসের ট্রিপ</div>
          <div class="perf-val">${performance.monthlyTrips} টি</div>
          <div class="perf-sub">বর্তমান মাস</div>
        </div>
        <div class="perf-card">
          <div class="perf-title">সর্বমোট সম্পন্ন ট্রিপ</div>
          <div class="perf-val">${performance.totalTrips} টি</div>
          <div class="perf-sub">লাইফটাইম রেকর্ড</div>
        </div>
        <div class="perf-card">
          <div class="perf-title">মোট ডিউটি সময়</div>
          <div class="perf-val" style="font-size: 13px; margin-top:6px;">${performance.dutyHoursFormatted || 'N/A'}</div>
          <div class="perf-sub">${performance.statusText}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Personal & License Info -->
        <div class="card">
          <div class="card-header">ব্যক্তিগত ও লাইসেন্স বিবরণ</div>
          <div class="info-row">
            <span class="info-label">পূর্ণ নাম:</span>
            <span class="info-val">${staff.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">স্টাফ পদবি:</span>
            <span class="info-val">${roleLabel}</span>
          </div>
          <div class="info-row">
            <span class="info-label">এমপ্লয়ী আইডি:</span>
            <span class="info-val">${staff.driverId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">মোবাইল নম্বর:</span>
            <span class="info-val">${staff.phoneNumber || 'দেওয়া হয়নি'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">ড্রাইভিং লাইসেন্স:</span>
            <span class="info-val">${staff.licenseNo || 'প্রযোজ্য নয় / দেওয়া হয়নি'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">যোগদানের তারিখ:</span>
            <span class="info-val">${joinDate}</span>
          </div>
        </div>

        <!-- Emergency & Family Contact -->
        <div class="card">
          <div class="card-header">পারিবারিক ও জরুরী যোগাযোগ</div>
          <div class="info-row">
            <span class="info-label">পারিবারিক ফোন:</span>
            <span class="info-val">${staff.familyPhone || 'দেওয়া হয়নি'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">সম্পর্ক:</span>
            <span class="info-val" style="color:#0284c7;">${getRelationLabel(staff.familyPhoneRelation)}</span>
          </div>
          <div class="info-row" style="flex-direction:column; gap:4px; border-bottom:none;">
            <span class="info-label">বর্তমান ও স্থায়ী ঠিকানা:</span>
            <span class="info-val" style="text-align:left; font-weight:500; font-size:11px; background:#f8fafc; padding:8px; border-radius:6px; border:1px solid #f1f5f9; margin-top:2px;">
              ${staff.address || 'কোনো ঠিকানা এন্ট্রি করা হয়নি।'}
            </span>
          </div>
        </div>
      </div>

      <!-- Rating History & Notes -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header" style="display:flex; justify-content:space-between;">
          <span>রেটিং হিস্ট্রি ও এডমিন/ম্যানেজার মন্তব্য (Rating History & Permanent Notes)</span>
          <span style="font-weight:normal; color:#64748b;">সর্বমোট: ${performance.notesCount || (staffNotes ? staffNotes.length : 0)} টি</span>
        </div>
        <div>
          ${notesHtml}
        </div>
      </div>

      <!-- Recent Trips History -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header" style="display:flex; justify-content:space-between;">
          <span>সাম্প্রতিক ট্রিপ রেকর্ডসমূহ</span>
          <span style="font-weight:normal; color:#64748b;">সর্বমোট: ${performance.totalTrips} টি</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th>গাড়ির নম্বর</th>
              <th>গন্তব্য / রুট</th>
              <th>তারিখ</th>
              <th>স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            ${tripsHtml}
          </tbody>
        </table>
      </div>

      <!-- Signatures -->
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-line">স্টাফের স্বাক্ষর ও তারিখ<br/>(${staff.name})</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">লাইন সুপারভাইজার / চেকার<br/>ফ্লিট অপারেশনস</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">অনুমোদিত স্বাক্ষর ও অফিসিয়াল সিল<br/>ট্রান্সপোর্ট ম্যানেজার</div>
        </div>
      </div>

      <div class="footer">
        © ${new Date().getFullYear()} Fleet Logistics Smart Management System • This is a verified electronic biodata profile.
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Downloads a structured Staff Biodata File (Text / HTML document).
 */
export const downloadStaffBiodataFile = (
  staff: any,
  performance: {
    rating: number;
    grade: string;
    totalTrips: number;
    monthlyTrips: number;
    statusText: string;
  },
  recentTrips: any[]
) => {
  const getRelationLabel = (rel?: string) => {
    switch (rel) {
      case 'Father': return 'বাবা';
      case 'Mother': return 'মা';
      case 'Wife': return 'স্ত্রী';
      case 'Husband': return 'স্বামী';
      case 'Brother': return 'ভাই';
      case 'Sister': return 'বোন';
      case 'Son': return 'ছেলে';
      case 'Daughter': return 'মেয়ে';
      case 'Guardian': return 'অভিভাবক';
      case 'Uncle': return 'চাচা/মামা';
      case 'Relative': return 'আত্মীয়/স্বজন';
      case 'Other': return 'অন্যান্য';
      default: return rel || 'উল্লেখ নেই';
    }
  };

  const content = `=====================================================
FLEET LOGISTICS & TRANSPORT MANAGEMENT SYSTEM
অফিসিয়াল স্টাফ বায়োডাটা ও পারফরম্যান্স প্রোফাইল
=====================================================

১. ব্যক্তিগত ও পরিচিতি তথ্য:
-----------------------------------------------------
এমপ্লয়ী আইডি         : ${staff.driverId}
পূর্ণ নাম             : ${staff.name}
পদবি                : ${staff.role === 'Helper' ? 'হেলপার' : 'ড্রাইভার'}
মোবাইল নম্বর         : ${staff.phoneNumber || 'উল্লেখ নেই'}
লাইসেন্স নম্বর        : ${staff.licenseNo || 'দেওয়া হয়নি'}
যোগদানের তারিখ         : ${staff.createdAt?.toDate ? staff.createdAt.toDate().toLocaleDateString('bn-BD') : (staff.createdAt || 'N/A')}
বর্তমান স্ট্যাটাস      : ${staff.isSuspended ? `সাসপেন্ডেড (${staff.suspensionDays || 0} দিন)` : performance.statusText}

২. পারিবারিক ও জরুরী যোগাযোগ:
-----------------------------------------------------
পারিবারিক নম্বর      : ${staff.familyPhone || 'দেওয়া হয়নি'}
সম্পর্ক              : ${getRelationLabel(staff.familyPhoneRelation)}
ঠিকানা               : ${staff.address || 'কোনো ঠিকানা এন্ট্রি করা হয়নি'}

৩. পারফরম্যান্স স্কোরকার্ড ও ট্রিপ পরিসংখ্যান:
-----------------------------------------------------
পারফরম্যান্স রেটিং     : ${performance.rating.toFixed(1)} / 5.0 (গ্রেড: ${performance.grade})
চলতি মাসের ট্রিপ        : ${performance.monthlyTrips} টি
সর্বমোট সম্পন্ন ট্রিপ  : ${performance.totalTrips} টি

৪. সাম্প্রতিক ট্রিপ রেকর্ডসমূহ:
-----------------------------------------------------
${recentTrips && recentTrips.length > 0 
  ? recentTrips.slice(0, 10).map((t, i) => `${i + 1}. গাড়ি: ${t.vehiclePlate || 'N/A'} | গন্তব্য: ${t.location || 'N/A'} | স্ট্যাটাস: ${t.status}`).join('\n')
  : 'কোনো ট্রিপ রেকর্ড পাওয়া যায়নি।'}

=====================================================
ডকুমেন্ট তৈরির তারিখ: ${new Date().toLocaleString('bn-BD')}
=====================================================`;

  const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Staff_Profile_${staff.driverId}_${staff.name.replace(/\s+/g, '_')}.txt`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
