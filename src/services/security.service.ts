
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private readonly STORAGE_KEY = 'TACTICAL_TUI_VAULT_V1';

  // Simple Base64 + XOR obfuscation to simulate encryption for the demo
  // In a real military app, this would be AES-256
  encrypt(data: string, key: string): string {
    const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
    const byteHex = (n: number) => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = (code: any) => textToChars(key).reduce((a, b) => a ^ b, code);

    return data
      .split('')
      .map(textToChars)
      .map(applySaltToChar)
      .map(byteHex)
      .join('');
  }

  decrypt(encoded: string, key: string): string {
    const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
    const applySaltToChar = (code: any) => textToChars(key).reduce((a, b) => a ^ b, code);

    return (encoded.match(/.{1,2}/g) || [])
      .map(hex => parseInt(hex, 16))
      .map(applySaltToChar)
      .map(charCode => String.fromCharCode(charCode))
      .join('');
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
    try {
      const decrypted = this.decrypt(encrypted, key);
      return JSON.parse(decrypted);
    } catch (e) {
      console.error('Decryption failed - Wrong Password?', e);
      return null;
    }
  }

  hasVault(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}
