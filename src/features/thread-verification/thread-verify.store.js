import path from 'node:path';
import { ROOT_DIR } from '../../core/storage/config-store.js';
import { JsonStore } from '../../core/storage/json-store.js';

const THREADS_FILE = path.join(ROOT_DIR, 'verify-threads.json');

const store = new JsonStore(THREADS_FILE, {
  lastCaseNumber: 0,
  threads: {}
});

export function formatCaseCode(num) {
  const n = Math.max(1, parseInt(num, 10) || 1);
  return String(n).padStart(4, '0');
}

export const threadVerifyStore = {
  getAll() {
    return store.get().threads || {};
  },

  allocateNextCaseNumber() {
    const current = store.get();
    const prev = parseInt(current.lastCaseNumber, 10) || 0;
    const caseNumber = prev + 1;
    store.update({ lastCaseNumber: caseNumber });
    return {
      caseNumber,
      caseCode: formatCaseCode(caseNumber)
    };
  },

  getThread(threadId) {
    const threads = this.getAll();
    return threads[threadId] || null;
  },

  resolveCaseCode(threadChannel) {
    if (!threadChannel) return '0001';
    const rec = this.getThread(threadChannel.id);
    if (rec?.caseCode) return rec.caseCode;
    if (rec?.caseNumber) return formatCaseCode(rec.caseNumber);

    const match = String(threadChannel.name || '').match(/^verify-(\d{1,6})(?:-|$)/i);
    if (match) return match[1].padStart(4, '0');
    return '0001';
  },

  saveThread(threadId, record) {
    const current = store.get();
    const threads = { ...(current.threads || {}) };
    threads[threadId] = {
      ...(threads[threadId] || {}),
      ...record,
      updatedAt: new Date().toISOString()
    };
    store.update({ threads });
    return threads[threadId];
  },

  findActiveThreadsForUser(userId, parentChannelId = null) {
    const threads = this.getAll();
    return Object.entries(threads)
      .filter(([, rec]) => {
        if (!rec || rec.userId !== userId) return false;
        if (parentChannelId && rec.channelId && rec.channelId !== parentChannelId) return false;
        return rec.status === 'pending' || rec.status === 'reupload_requested';
      })
      .map(([threadId, rec]) => ({ threadId, ...rec }));
  }
};
