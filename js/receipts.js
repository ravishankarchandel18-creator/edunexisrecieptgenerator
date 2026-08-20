/**
 * EDUNEXIS - Receipt Management Module
 * Handles creation, uniqueness, finalization (read-only), cancellation
 */

/**
 * Generate unique receipt number
 * Format: EDX-YYYY-XXXXXX
 */
async function generateReceiptNumber(prefix = 'EDX') {
    const year = new Date().getFullYear();
    const allReceipts = await window.EDUNEXIS_DB.getAll(window.EDUNEXIS_DB.STORES.RECEIPTS);
    
    // Find highest number for this year and prefix
    let maxNum = 0;
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    
    allReceipts.forEach(r => {
        const match = (r.receiptNo || '').match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });

    const next = maxNum + 1;
    const padded = String(next).padStart(6, '0');
    return `${prefix}-${year}-${padded}`;
}

/**
 * Convert number to words (Indian Rupees style)
 */
function numberToWords(num) {
    if (num === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertLessThanThousand(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
    }

    let result = '';
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = Math.floor(num % 1000);
    const paise = Math.round((num % 1) * 100);

    if (crore) result += convertLessThanThousand(crore) + ' Crore ';
    if (lakh) result += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand) result += convertLessThanThousand(thousand) + ' Thousand ';
    if (remainder) result += convertLessThanThousand(remainder);

    result = result.trim() + ' Rupees';
    if (paise > 0) {
        result += ' and ' + convertLessThanThousand(paise) + ' Paise';
    }
    return result + ' Only';
}

/**
 * Create and finalize a receipt (becomes READ-ONLY)
 */
async function createReceipt(receiptData, session) {
    // Ensure unique receipt number
    let receiptNo = receiptData.receiptNo;
    if (!receiptNo) {
        const user = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.USERS, session.userId);
        const prefix = (user && user.settings && user.settings.receiptPrefix) || 'EDX';
        receiptNo = await generateReceiptNumber(prefix);
    }

    // Double-check uniqueness
    const existing = await window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.RECEIPTS, receiptNo);
    if (existing) {
        throw new Error('This receipt number already exists.');
    }

    const now = new Date();
    const receipt = {
        receiptNo,
        userId: session.userId,
        instituteName: session.instituteName, // Locked at creation time
        date: now.toLocaleDateString('en-IN'),
        time: now.toLocaleTimeString('en-IN'),
        isoDate: now.toISOString(),
        generatedBy: session.fullName,
        generatedById: session.userId,

        // Student details
        studentName: (receiptData.studentName || '').trim(),
        fatherName: (receiptData.fatherName || '').trim(),
        motherName: (receiptData.motherName || '').trim(),
        enrollmentNo: (receiptData.enrollmentNo || '').trim(),
        admissionNo: (receiptData.admissionNo || '').trim(),
        rollNo: (receiptData.rollNo || '').trim(),
        course: (receiptData.course || '').trim(),
        yearSemester: (receiptData.yearSemester || '').trim(),
        session: (receiptData.session || '').trim(),
        mobile: (receiptData.mobile || '').trim(),
        email: (receiptData.email || '').trim(),
        address: (receiptData.address || '').trim(),

        // Fee details
        feeHeads: receiptData.feeHeads || [],
        subtotal: Number(receiptData.subtotal) || 0,
        discount: Number(receiptData.discount) || 0,
        lateFee: Number(receiptData.lateFee) || 0,
        otherCharges: Number(receiptData.otherCharges) || 0,
        grandTotal: Number(receiptData.grandTotal) || 0,
        amountPaid: Number(receiptData.amountPaid) || 0,
        balance: Number(receiptData.balance) || 0,
        amountInWords: numberToWords(Number(receiptData.grandTotal) || 0),

        // Payment
        paymentMode: receiptData.paymentMode || 'Cash',
        transactionId: (receiptData.transactionId || '').trim(),
        bankChequeNo: (receiptData.bankChequeNo || '').trim(),
        paymentDate: receiptData.paymentDate || now.toLocaleDateString('en-IN'),
        paymentStatus: receiptData.paymentStatus || 'Paid',

        // Status - FINALIZED & READ-ONLY
        status: 'FINALIZED',
        locked: true,
        createdAt: now.toISOString(),
        notes: (receiptData.notes || '').trim()
    };

    // Basic validation
    if (!receipt.studentName) {
        throw new Error('Please enter Student Name.');
    }
    if (receipt.grandTotal <= 0) {
        throw new Error('Grand Total must be greater than zero.');
    }

    await window.EDUNEXIS_DB.add(window.EDUNEXIS_DB.STORES.RECEIPTS, receipt);
    await window.EDUNEXIS_AUTH.logAudit(session.userId, 'RECEIPT_CREATED', receiptNo, `Receipt ${receiptNo} created for ${receipt.studentName}`);

    return receipt;
}

/**
 * Get a single receipt
 */
async function getReceipt(receiptNo) {
    return window.EDUNEXIS_DB.get(window.EDUNEXIS_DB.STORES.RECEIPTS, receiptNo);
}

/**
 * Get all receipts for current user (or all if admin - here per user)
 */
async function getUserReceipts(userId) {
    const all = await window.EDUNEXIS_DB.getAll(window.EDUNEXIS_DB.STORES.RECEIPTS);
    return all.filter(r => r.userId === userId).sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));
}

/**
 * Cancel a receipt (does NOT edit original data - marks as CANCELLED)
 */
async function cancelReceipt(receiptNo, session, reason = '') {
    const receipt = await getReceipt(receiptNo);
    if (!receipt) throw new Error('Receipt not found.');
    if (receipt.userId !== session.userId) throw new Error('Unauthorized.');
    if (receipt.status === 'CANCELLED') throw new Error('Receipt is already cancelled.');

    receipt.status = 'CANCELLED';
    receipt.cancelledAt = new Date().toISOString();
    receipt.cancelReason = reason;
    receipt.cancelledBy = session.fullName;

    await window.EDUNEXIS_DB.put(window.EDUNEXIS_DB.STORES.RECEIPTS, receipt);
    await window.EDUNEXIS_AUTH.logAudit(session.userId, 'RECEIPT_CANCELLED', receiptNo, reason || 'Receipt cancelled');
    return receipt;
}

/**
 * Delete receipt - REQUIRES Master Password + confirmation
 */
async function deleteReceipt(receiptNo, session, masterPassword, reason = '') {
    const verified = await window.EDUNEXIS_AUTH.verifyMaster(session.userId, masterPassword);
    if (!verified) {
        throw new Error('Incorrect Master Password. Receipt was not deleted.');
    }

    const receipt = await getReceipt(receiptNo);
    if (!receipt) throw new Error('Receipt not found.');
    if (receipt.userId !== session.userId) throw new Error('Unauthorized.');

    // Log to deleted_records before removing
    const deletionRecord = {
        receiptNo: receipt.receiptNo,
        originalData: receipt,
        deletedAt: new Date().toISOString(),
        deletedBy: session.fullName,
        deletedById: session.userId,
        reason: reason || 'No reason provided'
    };
    await window.EDUNEXIS_DB.add(window.EDUNEXIS_DB.STORES.DELETED, deletionRecord);

    await window.EDUNEXIS_DB.delete(window.EDUNEXIS_DB.STORES.RECEIPTS, receiptNo);
    await window.EDUNEXIS_AUTH.logAudit(session.userId, 'RECEIPT_DELETED', receiptNo, `Deleted. Reason: ${reason}`);

    return true;
}

/**
 * Search receipts
 */
async function searchReceipts(userId, query) {
    const all = await getUserReceipts(userId);
    if (!query || !query.trim()) return all;

    const q = query.toLowerCase().trim();
    return all.filter(r => {
        return (
            (r.receiptNo && r.receiptNo.toLowerCase().includes(q)) ||
            (r.studentName && r.studentName.toLowerCase().includes(q)) ||
            (r.enrollmentNo && r.enrollmentNo.toLowerCase().includes(q)) ||
            (r.admissionNo && r.admissionNo.toLowerCase().includes(q)) ||
            (r.mobile && r.mobile.includes(q)) ||
            (r.transactionId && r.transactionId.toLowerCase().includes(q)) ||
            (r.course && r.course.toLowerCase().includes(q)) ||
            (r.date && r.date.includes(q))
        );
    });
}

/**
 * Filter receipts
 */
async function filterReceipts(userId, filters = {}) {
    let results = await getUserReceipts(userId);

    if (filters.status) {
        results = results.filter(r => r.status === filters.status);
    }
    if (filters.course) {
        results = results.filter(r => r.course && r.course.toLowerCase().includes(filters.course.toLowerCase()));
    }
    if (filters.paymentMode) {
        results = results.filter(r => r.paymentMode === filters.paymentMode);
    }
    if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        results = results.filter(r => new Date(r.isoDate) >= from);
    }
    if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        results = results.filter(r => new Date(r.isoDate) <= to);
    }
    if (filters.minAmount != null) {
        results = results.filter(r => r.grandTotal >= filters.minAmount);
    }
    if (filters.maxAmount != null) {
        results = results.filter(r => r.grandTotal <= filters.maxAmount);
    }

    return results;
}

/**
 * Dashboard statistics
 */
async function getDashboardStats(userId) {
    const receipts = await getUserReceipts(userId);
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-IN');
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalCollection = 0;
    let todayCollection = 0;
    let monthCollection = 0;
    let todayCount = 0;
    let monthCount = 0;
    const students = new Set();
    let lastReceiptNo = '—';

    receipts.forEach(r => {
        if (r.status === 'CANCELLED') return;

        totalCollection += r.grandTotal || 0;
        students.add(r.studentName + '|' + (r.enrollmentNo || r.admissionNo || ''));

        if (r.date === todayStr) {
            todayCollection += r.grandTotal || 0;
            todayCount++;
        }

        const d = new Date(r.isoDate);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            monthCollection += r.grandTotal || 0;
            monthCount++;
        }
    });

    if (receipts.length > 0) {
        lastReceiptNo = receipts[0].receiptNo;
    }

    return {
        totalReceipts: receipts.filter(r => r.status !== 'CANCELLED').length,
        todayReceipts: todayCount,
        monthReceipts: monthCount,
        totalCollection,
        todayCollection,
        monthCollection,
        lastReceiptNo,
        uniqueStudents: students.size,
        cancelledCount: receipts.filter(r => r.status === 'CANCELLED').length
    };
}

// Expose
window.EDUNEXIS_RECEIPTS = {
    generateNumber: generateReceiptNumber,
    numberToWords,
    create: createReceipt,
    get: getReceipt,
    getUserReceipts,
    cancel: cancelReceipt,
    delete: deleteReceipt,
    search: searchReceipts,
    filter: filterReceipts,
    getStats: getDashboardStats
};