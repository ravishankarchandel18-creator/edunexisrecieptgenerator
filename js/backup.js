/**
 * EDUNEXIS - Backup & Restore Module
 */

async function createBackup() {
    const data = await window.EDUNEXIS_DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `EDUNEXIS_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const session = window.EDUNEXIS_AUTH.getSession();
    if (session) {
        await window.EDUNEXIS_AUTH.logAudit(session.userId, 'BACKUP_CREATED', null, `Backup file created: EDUNEXIS_Backup_${dateStr}.json`);
    }

    // Store meta
    try {
        await window.EDUNEXIS_DB.add(window.EDUNEXIS_DB.STORES.BACKUP_META, {
            createdAt: new Date().toISOString(),
            filename: `EDUNEXIS_Backup_${dateStr}.json`,
            recordCounts: {
                users: data.users.length,
                receipts: data.receipts.length,
                audit: data.audit_logs.length
            }
        });
    } catch (e) { /* ignore */ }

    return true;
}

async function restoreBackup(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.version || !data.exportedAt) {
                    reject(new Error('Invalid backup file format.'));
                    return;
                }

                await window.EDUNEXIS_DB.importAll(data, true);

                const session = window.EDUNEXIS_AUTH.getSession();
                if (session) {
                    await window.EDUNEXIS_AUTH.logAudit(session.userId, 'BACKUP_RESTORED', null, `Restored from backup dated ${data.exportedAt}`);
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read backup file.'));
        reader.readAsText(file);
    });
}

window.EDUNEXIS_BACKUP = {
    create: createBackup,
    restore: restoreBackup
};