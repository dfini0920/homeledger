// Platform layer. Uses Capacitor plugins on iOS/Android and falls back to browser APIs on the web.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();

/* ---------- app data ---------- */
const KEY = 'homeledger.v1';

export async function loadState() {
  if (isNative) {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (value) return JSON.parse(value);
    } catch (e) { /* fall through to localStorage */ }
  }
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveState(state) {
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
  if (isNative) Preferences.set({ key: KEY, value: json }).catch(() => {});
}

/* ---------- files (receipts, invoices) ---------- */
const blobToBase64 = blob =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const base64ToBlob = (b64, type) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

// Web fallback: IndexedDB.
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    try {
      const r = indexedDB.open('homeledger', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    } catch (e) { reject(e); }
  });
  return dbp;
}
const memBlobs = new Map();

export async function putFile(id, blob) {
  if (isNative) {
    await Filesystem.writeFile({ path: `docs/${id}`, data: await blobToBase64(blob), directory: Directory.Data, recursive: true });
    return;
  }
  memBlobs.set(id, blob);
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const t = db.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put(blob, id);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  } catch (e) { /* kept in memory for this session */ }
}

export async function getFile(id, mime) {
  if (isNative) {
    try {
      const { data } = await Filesystem.readFile({ path: `docs/${id}`, directory: Directory.Data });
      return typeof data === 'string' ? base64ToBlob(data, mime) : data;
    } catch (e) { return null; }
  }
  if (memBlobs.has(id)) return memBlobs.get(id);
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const q = db.transaction('blobs').objectStore('blobs').get(id);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => rej(q.error);
    });
  } catch (e) { return null; }
}

export async function delFile(id) {
  if (isNative) {
    try { await Filesystem.deleteFile({ path: `docs/${id}`, directory: Directory.Data }); } catch (e) { /* already gone */ }
    return;
  }
  memBlobs.delete(id);
  try {
    const db = await idb();
    await new Promise(res => {
      const t = db.transaction('blobs', 'readwrite');
      t.objectStore('blobs').delete(id);
      t.oncomplete = res;
      t.onerror = res;
    });
  } catch (e) { /* ignore */ }
}

// Hand a file to the system: share sheet on phones (Open in..., Save to Files), new tab on the web.
export async function openFile(blob, name) {
  if (isNative) {
    const safe = name.replace(/[^\w.\- ]+/g, '_');
    const path = `share/${Date.now()}-${safe}`;
    await Filesystem.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title: name, url: uri, dialogTitle: name });
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Save a text file (the JSON backup).
export async function saveText(filename, text) {
  if (isNative) {
    const path = `share/${filename}`;
    await Filesystem.writeFile({ path, data: text, directory: Directory.Cache, encoding: 'utf8', recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Save HomeLedger backup' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function takePhoto() {
  const p = await Camera.getPhoto({
    quality: 80,
    width: 2000,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    saveToGallery: false
  });
  const type = 'image/' + (p.format === 'jpg' ? 'jpeg' : p.format);
  return new File([base64ToBlob(p.base64String, type)], `photo-${Date.now()}.${p.format}`, { type });
}

/* ---------- reminders ---------- */
export async function notifStatus() {
  if (!isNative) return 'unsupported';
  try { return (await LocalNotifications.checkPermissions()).display; } catch (e) { return 'unsupported'; }
}

export async function requestNotif() {
  if (!isNative) return 'unsupported';
  try { return (await LocalNotifications.requestPermissions()).display; } catch (e) { return 'denied'; }
}

let chain = Promise.resolve();
// Replace every pending reminder with the new plan. Calls run one at a time so they cannot interleave.
export function applyPlan(plan) {
  if (!isNative) return Promise.resolve();
  chain = chain.then(async () => {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      if (!plan.length) return;
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({ id: 'reminders', name: 'Maintenance and warranty reminders', importance: 4, visibility: 1 });
      }
      await LocalNotifications.schedule({
        notifications: plan.map(p => ({
          id: p.id,
          title: p.title,
          body: p.body,
          channelId: 'reminders',
          schedule: { at: p.at, allowWhileIdle: true },
          extra: { route: p.route }
        }))
      });
    } catch (e) {
      console.warn('Could not schedule reminders', e);
    }
  });
  return chain;
}

export async function testNotification() {
  if (!isNative) return;
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({ id: 'reminders', name: 'Maintenance and warranty reminders', importance: 4, visibility: 1 });
  }
  await LocalNotifications.schedule({
    notifications: [{ id: 1, title: 'HomeLedger test reminder', body: 'Reminders are working on this device.', channelId: 'reminders', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { route: '#reminders' } }]
  });
}

export function onNotificationTap(fn) {
  if (!isNative) return;
  LocalNotifications.addListener('localNotificationActionPerformed', e => fn(e.notification && e.notification.extra && e.notification.extra.route));
}

export function onResume(fn) {
  if (!isNative) return;
  App.addListener('appStateChange', s => { if (s.isActive) fn(); });
}
