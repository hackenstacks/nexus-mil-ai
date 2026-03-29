
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private readonly STORAGE_KEY = 'TACTICAL_TUI_VAULT_V1';

  private readonly MAGIC_HEADER = 'TACTICAL_V2:';

  // Improved XOR obfuscation with magic header and per-character key rotation
  encrypt(data: string, key: string): string {
    const payload = this.MAGIC_HEADER + data;
    return payload
      .split('')
      .map((c, i) => {
        const k = key.charCodeAt(i % key.length) || 0;
        const code = c.charCodeAt(0) ^ k;
        // Use 4 hex chars to support full Unicode range safely
        return code.toString(16).padStart(4, '0');
      })
      .join('');
  }

  // Decrypt using V2 logic (with magic header check)
  private decryptV2(encoded: string, key: string): string | null {
    if (!encoded || !key) return null;
    try {
      const matches = encoded.match(/.{1,4}/g) || [];
      const decrypted = matches
        .map((hex, i) => {
          const k = key.charCodeAt(i % key.length) || 0;
          const code = parseInt(hex, 16) ^ k;
          return String.fromCharCode(code);
        })
        .join('');
      
      if (decrypted.startsWith(this.MAGIC_HEADER)) {
        return decrypted.substring(this.MAGIC_HEADER.length);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Legacy V1 decryption (simple XOR sum with 2-char hex support)
  private decryptV1(encoded: string, key: string): string | null {
    if (!encoded || !key) return null;
    
    const keySum = key.split('').reduce((acc, char) => acc ^ char.charCodeAt(0), 0);
    
    // Try 2-char hex first (original legacy format)
    const tryDecrypt = (chunkSize: number) => {
      try {
        const regex = new RegExp(`.{1,${chunkSize}}`, 'g');
        const matches = encoded.match(regex) || [];
        return matches
          .map(hex => {
            const code = parseInt(hex, 16) ^ keySum;
            return String.fromCharCode(code);
          })
          .join('');
      } catch {
        return null;
      }
    };

    // Try 2-char (Legacy V0) then 4-char (Legacy V1-beta)
    const v0 = tryDecrypt(2);
    if (v0 && (v0.startsWith('{') || v0.startsWith('['))) return v0;
    
    const v1 = tryDecrypt(4);
    if (v1 && (v1.startsWith('{') || v1.startsWith('['))) return v1;

    return null;
  }

  saveToVault(key: string, data: any): boolean {
    try {
      const json = JSON.stringify(data);
      const encrypted = this.encrypt(json, key);
      localStorage.setItem(this.STORAGE_KEY, encrypted);
      return true;
    } catch (e) {
      console.error('Encryption failed', e);
      return false;
    }
  }

  loadFromVault(key: string): any {
    const encrypted = localStorage.getItem(this.STORAGE_KEY);
    if (!encrypted) return null;

    // 1. Try V2 decryption (Robust with Magic Header)
    const decryptedV2 = this.decryptV2(encrypted, key);
    if (decryptedV2 && decryptedV2.trim()) {
      try {
        return JSON.parse(decryptedV2);
      } catch (e) {
        // If it starts with MAGIC_HEADER but fails parse, it's corrupted data
        console.warn('Vault data corrupted (V2)', e);
        return null;
      }
    }

    // 2. Fallback to V1 decryption (Legacy formats)
    const decryptedV1 = this.decryptV1(encrypted, key);
    if (decryptedV1 && decryptedV1.trim()) {
      try {
        return JSON.parse(decryptedV1);
      } catch (e) {
        // Silent fail for legacy - likely just wrong password
        return null;
      }
    }

    return null;
  }

  hasVault(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}
