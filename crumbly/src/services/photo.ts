// Een foto kiezen of maken (web), verkleind tot hoogstens 480 px en als JPEG bewaard.
// Zo blijft hij klein (meestal 25 tot 45 KB) en kan hij gewoon mee in de gegevens van
// de bak, zonder aparte opslag. Een brood per week geeft ongeveer 2 MB per jaar.
import { Platform } from 'react-native';

const MAX = 480;
const QUALITY = 0.6;

export function canPickPhoto(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!canPickPhoto()) return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); return resolve(null); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    };
    input.click();
  });
}
