import type { Catalog } from "./engine/model";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("shape-puzzle-studio-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function loadWorkspace(): Promise<
  { catalog: Catalog; masks: unknown } | undefined
> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("workspace");
    const r = tx.objectStore("workspace").get("current");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => d.close();
  });
}
export async function saveWorkspace(catalog: Catalog, masks: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put({ catalog, masks }, "current");
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
