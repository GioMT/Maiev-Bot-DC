import fs from 'node:fs';

/**
 * Reusable JSON file persistence store with in-memory caching and optional debounced writes.
 */
export class JsonStore {
  /**
   * @param {string} filePath - Absolute path to the JSON file
   * @param {Object} defaultData - Default data structure if file doesn't exist
   * @param {Object} [options]
   * @param {number} [options.debounceMs=0] - Debounce delay in ms (0 = synchronous write)
   */
  constructor(filePath, defaultData = {}, options = {}) {
    this.filePath = filePath;
    this.defaultData = defaultData;
    this.debounceMs = options.debounceMs || 0;
    this.data = structuredClone(defaultData);
    this._timeout = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { ...structuredClone(this.defaultData), ...parsed };
      }
    } catch (err) {
      console.warn(`⚠️ [JsonStore] Could not read ${this.filePath}, using defaults:`, err.message);
      this.data = structuredClone(this.defaultData);
    }
    return this.data;
  }

  get() {
    return this.data;
  }

  set(newData) {
    this.data = newData;
    this.persist();
    return this.data;
  }

  update(partial) {
    this.data = { ...this.data, ...partial };
    this.persist();
    return this.data;
  }

  persist() {
    if (this.debounceMs > 0) {
      if (this._timeout) clearTimeout(this._timeout);
      this._timeout = setTimeout(() => {
        this._writeSync();
      }, this.debounceMs);
    } else {
      this._writeSync();
    }
  }

  _writeSync() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`⚠️ [JsonStore] Failed to save ${this.filePath}:`, err.message);
    }
  }
}

