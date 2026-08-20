/**
 * EDUNEXIS - Shared Application Utilities
 */

if (typeof window.showToast !== 'function') {
    window.showToast = function(msg, type = '') {
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    };
}

window.formatCurrency = function(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
};

window.escapeHtml = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

console.log('EDUNEXIS App utilities loaded');