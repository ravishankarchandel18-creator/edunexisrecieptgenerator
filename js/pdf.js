/**
 * EDUNEXIS - PDF Generation Module
 * Uses html2canvas + jsPDF (loaded via CDN)
 */

async function generateReceiptPDF(receiptElementId, receiptNo) {
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        throw new Error('PDF libraries not loaded. Please check your internet connection.');
    }

    const element = document.getElementById(receiptElementId);
    if (!element) {
        throw new Error('Receipt element not found.');
    }

    // Temporarily show for capture if hidden
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.width = '800px';

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 10;

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 10;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const filename = `EDUNEXIS_Receipt_${receiptNo}.pdf`;
        pdf.save(filename);
        return true;
    } finally {
        element.style.display = originalDisplay;
        element.style.position = '';
        element.style.left = '';
        element.style.width = '';
    }
}

/**
 * Generate PDF from receipt object by building temporary HTML
 */
async function generatePDFFromData(receipt) {
    // Create temporary container
    let container = document.getElementById('pdf-temp-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pdf-temp-container';
        container.style.cssText = 'position:absolute;left:-9999px;width:800px;background:#fff;padding:20px;font-family:Arial,sans-serif;';
        document.body.appendChild(container);
    }

    container.innerHTML = buildReceiptHTML(receipt);

    try {
        await generateReceiptPDF('pdf-temp-container', receipt.receiptNo);
        const session = window.EDUNEXIS_AUTH.getSession();
        if (session) {
            await window.EDUNEXIS_AUTH.logAudit(session.userId, 'PDF_GENERATED', receipt.receiptNo, 'PDF downloaded');
        }
        return true;
    } finally {
        // keep container for reuse
    }
}

function buildReceiptHTML(r) {
    const feeRows = (r.feeHeads || []).map(f => `
        <tr>
            <td style="border:1px solid #333;padding:6px;">${f.head || ''}</td>
            <td style="border:1px solid #333;padding:6px;text-align:right;">₹${Number(f.amount || 0).toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    return `
        <div class="edunexis-receipt-sheet" style="border:2px solid #0a0a2e;padding:20px;color:#111111;background:#ffffff;font-family:Segoe UI,Arial,sans-serif;line-height:1.45;">
            <div style="text-align:center;border-bottom:2px solid #0a0a2e;padding-bottom:12px;margin-bottom:16px;">
                <h1 style="margin:0;font-size:22px;letter-spacing:1px;color:#0a1628 !important;">${r.instituteName || 'INSTITUTE NAME'}</h1>
                <h2 style="margin:6px 0 0;font-size:16px;color:#333333 !important;">DIGITAL FEE RECEIPT</h2>
            </div>
            <table style="width:100%;margin-bottom:16px;font-size:13px;">
                <tr>
                    <td><strong>Receipt No:</strong> ${r.receiptNo}</td>
                    <td style="text-align:right;"><strong>Date:</strong> ${r.date} &nbsp; <strong>Time:</strong> ${r.time}</td>
                </tr>
            </table>
            <h3 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;color:#0a1628 !important;margin:12px 0 8px;">Student Details</h3>
            <table style="width:100%;font-size:12px;margin-bottom:16px;color:#111;">
                <tr><td width="50%" style="color:#111;"><strong>Student Name:</strong> ${r.studentName || '—'}</td>
                    <td style="color:#111;"><strong>Father's Name:</strong> ${r.fatherName || '—'}</td></tr>
                <tr><td style="color:#111;"><strong>Enrollment No:</strong> ${r.enrollmentNo || '—'}</td>
                    <td style="color:#111;"><strong>Admission No:</strong> ${r.admissionNo || '—'}</td></tr>
                <tr><td style="color:#111;"><strong>Course:</strong> ${r.course || '—'}</td>
                    <td style="color:#111;"><strong>Year/Semester:</strong> ${r.yearSemester || '—'}</td></tr>
                <tr><td style="color:#111;"><strong>Session:</strong> ${r.session || '—'}</td>
                    <td style="color:#111;"><strong>Mobile:</strong> ${r.mobile || '—'}</td></tr>
            </table>
            <h3 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;color:#0a1628 !important;margin:12px 0 8px;">Fee Details</h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
                <thead>
                    <tr style="background:#f0f0f0;">
                        <th style="border:1px solid #333;padding:6px;text-align:left;">Fee Head</th>
                        <th style="border:1px solid #333;padding:6px;text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${feeRows}
                    <tr><td style="border:1px solid #333;padding:6px;"><strong>Subtotal</strong></td>
                        <td style="border:1px solid #333;padding:6px;text-align:right;">₹${Number(r.subtotal||0).toLocaleString('en-IN')}</td></tr>
                    <tr><td style="border:1px solid #333;padding:6px;">Discount</td>
                        <td style="border:1px solid #333;padding:6px;text-align:right;">₹${Number(r.discount||0).toLocaleString('en-IN')}</td></tr>
                    <tr><td style="border:1px solid #333;padding:6px;">Late Fee</td>
                        <td style="border:1px solid #333;padding:6px;text-align:right;">₹${Number(r.lateFee||0).toLocaleString('en-IN')}</td></tr>
                    <tr><td style="border:1px solid #333;padding:6px;">Other Charges</td>
                        <td style="border:1px solid #333;padding:6px;text-align:right;">₹${Number(r.otherCharges||0).toLocaleString('en-IN')}</td></tr>
                    <tr style="background:#e8f4ff;">
                        <td style="border:1px solid #333;padding:8px;"><strong>GRAND TOTAL</strong></td>
                        <td style="border:1px solid #333;padding:8px;text-align:right;"><strong>₹${Number(r.grandTotal||0).toLocaleString('en-IN')}</strong></td>
                    </tr>
                </tbody>
            </table>
            <p style="font-size:12px;margin:8px 0;color:#111;"><strong>Amount in Words:</strong> ${r.amountInWords || ''}</p>
            <h3 style="font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;color:#0a1628 !important;margin:12px 0 8px;">Payment Details</h3>
            <table style="width:100%;font-size:12px;margin-bottom:20px;color:#111;">
                <tr><td style="color:#111;"><strong>Mode:</strong> ${r.paymentMode || '—'}</td>
                    <td style="color:#111;"><strong>Status:</strong> ${r.paymentStatus || '—'}</td></tr>
                <tr><td style="color:#111;"><strong>Transaction ID:</strong> ${r.transactionId || '—'}</td>
                    <td style="color:#111;"><strong>Bank/Cheque No:</strong> ${r.bankChequeNo || '—'}</td></tr>
                <tr><td style="color:#111;"><strong>Amount Paid:</strong> ₹${Number(r.amountPaid||0).toLocaleString('en-IN')}</td>
                    <td style="color:#111;"><strong>Balance Due:</strong> ₹${Number(r.balance||0).toLocaleString('en-IN')}</td></tr>
            </table>
            <div style="margin-top:40px;display:flex;justify-content:space-between;">
                <div style="text-align:center;">
                    <div style="border-top:1px solid #333;width:180px;padding-top:6px;font-size:12px;">Authorized Signature</div>
                </div>
                <div style="text-align:right;font-size:11px;color:#555;">
                    <div>Generated By: ${r.generatedBy || '—'}</div>
                    <div>Status: ${r.status || 'FINALIZED'}</div>
                    <div style="margin-top:8px;">This is a computer-generated receipt.</div>
                    <div>Ref: ${r.receiptNo}</div>
                </div>
            </div>
        </div>
    `;
}

window.EDUNEXIS_PDF = {
    generate: generateReceiptPDF,
    fromData: generatePDFFromData,
    buildHTML: buildReceiptHTML
};