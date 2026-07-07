/**
 * Interfaz de almacenamiento de ficheros. `LocalStorageProvider` (disco local, para dev sin
 * Supabase configurado) y `SupabaseStorageProvider` (bucket privado + URL firmada) la
 * implementan; el resto del código (DocumentsService) solo conoce esta interfaz.
 */
export interface StorageProvider {
  /** Sube el buffer bajo `path` (ruta interna, no una URL). */
  upload(path: string, buffer: Buffer, mimeType: string): Promise<void>;
  /** URL de descarga temporal (firmada) o de streaming, válida un tiempo corto. */
  getDownloadUrl(path: string): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
