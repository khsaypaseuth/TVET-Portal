/**
 * Utility functions for localStorage with error handling
 */

export const storage = {
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error: any) {
      if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
        console.warn(`LocalStorage quota exceeded for key: ${key}`);
        // Try to free up space
        this.clearNonEssential();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error('Failed to store after cleanup:', retryError);
          return false;
        }
      }
      console.error(`Error storing ${key}:`, error);
      return false;
    }
  },

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
    }
  },

  clearNonEssential(): void {
    // Keep essential keys
    const essentialKeys = ['theme', 'i18nextLng'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!essentialKeys.includes(key)) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error(`Error clearing ${key}:`, error);
        }
      }
    });
  },

  getStorageSize(): number {
    let total = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
    } catch (error) {
      console.error('Error calculating storage size:', error);
    }
    return total;
  },

  getStorageSizeMB(): number {
    return this.getStorageSize() / (1024 * 1024);
  },
};

