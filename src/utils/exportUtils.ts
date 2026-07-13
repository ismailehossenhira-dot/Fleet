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
    alert("পপ-আপ উইন্ডোটি ব্লক করা হয়েছে। দয়া করে আপনার ব্রাউজারের পপ-আপ সেটিংস পারমিশন দিন এবং পুনরায় চেষ্টা করুন। (Popup was blocked. Please enable popups for this site.)");
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
