// Screenshot files are stored in the app's private storage via the official Filesystem plugin.
import { addShotRow, deleteShotRow } from './data.js';

const FS = () => {
  const p = window.Capacitor?.Plugins?.Filesystem;
  if (!p) throw new Error('Filesystem plugin not found');
  return p;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

/** Downscale big phone screenshots to keep storage small; falls back to the original file. */
async function toBase64(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
    if (blob) return await blobToBase64(blob);
  } catch (e) { console.warn('resize skipped', e); }
  return blobToBase64(file);
}

export async function saveScreenshot(tradeId, tf, file) {
  const path = `screenshots/${tradeId}_${tf}_${Date.now()}.jpg`;
  await FS().writeFile({ path, data: await toBase64(file), directory: 'DATA', recursive: true });
  await addShotRow(tradeId, tf, path);
}

export async function shotSrc(path) {
  const { uri } = await FS().getUri({ path, directory: 'DATA' });
  return window.Capacitor.convertFileSrc(uri);
}

export async function removeShot(row) {
  try { await FS().deleteFile({ path: row.file_path, directory: 'DATA' }); } catch (e) { console.warn(e); }
  await deleteShotRow(row.id);
}

/** Remove a stored file by path (used when a whole journal is deleted). */
export async function removeShotFile(path) {
  await FS().deleteFile({ path, directory: 'DATA' });
}
