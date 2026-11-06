"use client";
import { useEffect, useState } from "react";

/** Cache de imagens do armazenamento privado (mesma origem → canvas exportável). */
const cache = new Map<string, Promise<HTMLImageElement>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

export function loadImage(fileId: string): Promise<HTMLImageElement> {
  let p = cache.get(fileId);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => { failed.add(fileId); listeners.forEach((l) => l()); reject(new Error("load")); };
      img.src = `/api/files/${fileId}`;
    });
    cache.set(fileId, p);
  }
  return p;
}

export function useImage(fileId: string | null | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    setImg(null);
    if (!fileId) return;
    loadImage(fileId).then((i) => alive && setImg(i)).catch(() => {});
    return () => { alive = false; };
  }, [fileId]);
  return img;
}

/** IDs de imagens que falharam ao carregar (usado na validação pré-exportação). */
export function useFailedImages() {
  const [list, setList] = useState<string[]>([...failed]);
  useEffect(() => {
    const l = () => setList([...failed]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return list;
}

/** Aguarda todas as imagens do documento (antes de exportar). */
export async function preloadAll(ids: string[]) {
  const results = await Promise.allSettled(ids.map(loadImage));
  return ids.filter((_, i) => results[i].status === "rejected");
}

/** Garante que as fontes usadas estão carregadas antes de desenhar no canvas. */
export async function ensureFonts(families: string[]) {
  if (typeof document === "undefined" || !document.fonts) return;
  const uniq = [...new Set(families)];
  await Promise.all(uniq.flatMap((f) => ["400", "700", "900"].map((w) => document.fonts.load(`${w} 32px "${f}"`).catch(() => null))));
}
