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
    this._lastMtime = 0;
    this._loadedOnce = false;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const stat = fs.statSync(this.filePath);
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        if (!raw.trim() && this._loadedOnce) {
          return this.data;
        }
        const parsed = JSON.parse(raw);
        this._lastMtime = stat.mtimeMs;
        this.data = { ...structuredClone(this.defaultData), ...parsed };
        this._loadedOnce = true;
      }
    } catch (err) {
      console.warn(`⚠️ [JsonStore] Could not read ${this.filePath}:`, err.message);
      if (!this._loadedOnce) {
        this.data = structuredClone(this.defaultData);
      }
    }
    return this.data;
  }

  get() {
    try {
      if (fs.existsSync(this.filePath)) {
        const stat = fs.statSync(this.filePath);
        if (stat.mtimeMs > (this._lastMtime || 0)) {
          this.load();
        }
      }
    } catch (_) {}
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
      const serialized = JSON.stringify(this.data, null, 2);
      const tmpPath = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, serialized, 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
      this._loadedOnce = true;
      try {
        this._lastMtime = fs.statSync(this.filePath).mtimeMs;
      } catch (_) {}
    } catch (err) {
      console.error(`⚠️ [JsonStore] Failed to save ${this.filePath}:`, err.message);
    }
  }
}

