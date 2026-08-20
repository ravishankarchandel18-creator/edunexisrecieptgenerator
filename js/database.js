/**
 * EDUNEXIS - IndexedDB Database Module
 * Primary client-side storage for Users, Receipts, Audit Logs, Settings, Deleted Records
 */

const DB_NAME = 'EDUNEXIS_DB';
const DB_VERSION = 1;

let db = null;

const STORES = {
    USERS: 'users',
    RECEIPTS: 'receipts',
    AUDIT: 'audit_logs',
    SETTINGS: 'settings',
    DELETED: 'deleted_records',
    BACKUP_META: 'backup_meta'
};

/**
 * Initialize / open the IndexedDB database
 */
function initDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(new Error('Unable to access local database. Please try again.'));
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('EDUNEXIS Database connected');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Users store
            if (!database.objectStoreNames.contains(STORES.USERS)) {
                const userStore = database.createObjectStore(STORES.USERS, { keyPath: 'userId' });
                userStore.createIndex('email', 'email', { unique: true });
                userStore.createIndex('mobile', 'mobile', { unique: false });
            }

            // Receipts store
            if (!database.objectStoreNames.contains(STORES.RECEIPTS)) {
                const receiptStore = database.createObjectStore(STORES.RECEIPTS, { keyPath: 'receiptNo' });
                receiptStore.createIndex('date', 'date', { unique: false });
                receiptStore.createIndex('studentName', 'studentName', { unique: false });
                receiptStore.createIndex('enrollmentNo', 'enrollmentNo', { unique: false });
                receiptStore.createIndex('admissionNo', 'admissionNo', { unique: false });
                receiptStore.createIndex('mobile', 'mobile', { unique: false });
                receiptStore.createIndex('course', 'course', { unique: false });
                receiptStore.createIndex('status', 'status', { unique: false });
                receiptStore.createIndex('generatedBy', 'generatedBy', { unique: false });
                receiptStore.createIndex('userId', 'userId', { unique: false });
            }

            // Audit logs
            if (!database.objectStoreNames.contains(STORES.AUDIT)) {
                const auditStore = database.createObjectStore(STORES.AUDIT, { keyPath: 'id', autoIncrement: true });
                auditStore.createIndex('timestamp', 'timestamp', { unique: false });
                auditStore.createIndex('userId', 'userId', { unique: false });
                auditStore.createIndex('action', 'action', { unique: false });
            }

            // Settings
            if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }

            // Deleted records (audit trail for deletions)
            if (!database.objectStoreNames.contains(STORES.DELETED)) {
                const deletedStore = database.createObjectStore(STORES.DELETED, { keyPath: 'id', autoIncrement: true });
                deletedStore.createIndex('receiptNo', 'receiptNo', { unique: false });
                deletedStore.createIndex('deletedAt', 'deletedAt', { unique: false });
            }

            // Backup metadata
            if (!database.objectStoreNames.contains(STORES.BACKUP_META)) {
                database.createObjectStore(STORES.BACKUP_META, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/**
 * Generic helper to perform a transaction
 */
function performTransaction(storeName, mode, operation) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db) await initDatabase();
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = operation(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);

            tx.oncomplete = () => {};
            tx.onerror = () => reject(tx.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Add a record
 */
async function addRecord(storeName, data) {
    return performTransaction(storeName, 'readwrite', (store) => store.add(data));
}

/**
 * Put (add or update) a record
 */
async function putRecord(storeName, data) {
    return performTransaction(storeName, 'readwrite', (store) => store.put(data));
}

/**
 * Get a record by key
 */
async function getRecord(storeName, key) {
    return performTransaction(storeName, 'readonly', (store) => store.get(key));
}

/**
 * Get all records from a store
 */
async function getAllRecords(storeName) {
    return performTransaction(storeName, 'readonly', (store) => store.getAll());
}

/**
 * Delete a record by key
 */
async function deleteRecord(storeName, key) {
    return performTransaction(storeName, 'readwrite', (store) => store.delete(key));
}

/**
 * Clear an entire store
 */
async function clearStore(storeName) {
    return performTransaction(storeName, 'readwrite', (store) => store.clear());
}

/**
 * Query by index
 */
async function getByIndex(storeName, indexName, value) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db) await initDatabase();
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Count records in a store (optionally filtered by index)
 */
async function countRecords(storeName, indexName = null, value = null) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db) await initDatabase();
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let request;
            if (indexName && value !== null) {
                const index = store.index(indexName);
                request = index.count(value);
            } else {
                request = store.count();
            }
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Get database status for UI indicator
 */
async function getDatabaseStatus() {
    try {
        await initDatabase();
        return { online: true, message: 'LOCAL DATABASE ONLINE' };
    } catch (e) {
        return { online: false, message: 'DATABASE OFFLINE' };
    }
}

/**
 * Export entire database as JSON (for backup)
 */
async function exportAllData() {
    const data = {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        users: await getAllRecords(STORES.USERS),
        receipts: await getAllRecords(STORES.RECEIPTS),
        audit_logs: await getAllRecords(STORES.AUDIT),
        settings: await getAllRecords(STORES.SETTINGS),
        deleted_records: await getAllRecords(STORES.DELETED)
    };
    return data;
}

/**
 * Import / restore data from backup JSON
 */
async function importAllData(data, replace = true) {
    if (!data || !data.version) {
        throw new Error('Invalid backup file format.');
    }

    if (replace) {
        await clearStore(STORES.USERS);
        await clearStore(STORES.RECEIPTS);
        await clearStore(STORES.AUDIT);
        await clearStore(STORES.SETTINGS);
        await clearStore(STORES.DELETED);
    }

    if (data.users) {
        for (const u of data.users) await putRecord(STORES.USERS, u);
    }
    if (data.receipts) {
        for (const r of data.receipts) await putRecord(STORES.RECEIPTS, r);
    }
    if (data.audit_logs) {
        for (const a of data.audit_logs) await putRecord(STORES.AUDIT, a);
    }
    if (data.settings) {
        for (const s of data.settings) await putRecord(STORES.SETTINGS, s);
    }
    if (data.deleted_records) {
        for (const d of data.deleted_records) await putRecord(STORES.DELETED, d);
    }

    return true;
}

// Expose globally
window.EDUNEXIS_DB = {
    init: initDatabase,
    STORES,
    add: addRecord,
    put: putRecord,
    get: getRecord,
    getAll: getAllRecords,
    delete: deleteRecord,
    clear: clearStore,
    getByIndex,
    count: countRecords,
    status: getDatabaseStatus,
    exportAll: exportAllData,
    importAll: importAllData
};