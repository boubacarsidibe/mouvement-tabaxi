import { Injectable } from '@angular/core';

/** Taille visée pour une photo envoyée : environ 500 Ko, légère sur une connexion mobile. */
export const PHOTO_TARGET_BYTES = 500 * 1024;
/** Le serveur garde 800 pixels au plus : inutile d'envoyer davantage. */
export const PHOTO_MAX_SIDE = 800;
/** Limite du serveur, au-delà de laquelle la photo est refusée. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TOO_LARGE = 'La photo dépasse 5 Mo. Choisissez une image plus légère.';

/** Qualités JPEG essayées l'une après l'autre, avant de réduire encore les dimensions. */
const QUALITIES = [0.85, 0.7, 0.55];
const SHRINK = 0.75;
const MAX_SHRINKS = 5;

/** Image décodée, prête à être redessinée. */
export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close?(): void;
}

/** Ce que la réduction demande au navigateur : lire une image et l'enregistrer en JPEG. */
export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob>;
}

export const browserCodec: ImageCodec = {
  async decode(file) {
    // « from-image » remet à l'endroit les photos de téléphone, dont le sens est dans les données EXIF.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  },
  encode(image, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('Dessin indisponible sur cet appareil.'));
    // Fond blanc : les zones transparentes d'un PNG ne deviennent pas noires en JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Photo impossible à enregistrer.'))),
        'image/jpeg',
        quality,
      ),
    );
  },
};

function jpegName(name: string): string {
  return `${name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`;
}

/**
 * Réduit une photo trop lourde : 800 pixels au plus de côté, en JPEG, sous 500 Ko.
 *
 * Une photo déjà assez légère est envoyée telle quelle. Une image que le navigateur ne
 * sait pas lire est aussi laissée telle quelle : le serveur expliquera ce qui ne va pas.
 * Le serveur réenregistre de toute façon chaque photo et en retire les métadonnées.
 */
export async function reducePhoto(file: File, codec: ImageCodec = browserCodec): Promise<File> {
  if (file.size <= PHOTO_TARGET_BYTES) return file;
  let image: DecodedImage;
  try {
    image = await codec.decode(file);
  } catch {
    return file;
  }
  try {
    let scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.width, image.height));
    let smallest: Blob | null = null;
    for (let shrink = 0; shrink <= MAX_SHRINKS; shrink++) {
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      for (const quality of QUALITIES) {
        const blob = await codec.encode(image, width, height, quality);
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= PHOTO_TARGET_BYTES)
          return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
      }
      scale *= SHRINK;
    }
    return smallest && smallest.size < file.size
      ? new File([smallest], jpegName(file.name), { type: 'image/jpeg' })
      : file;
  } catch {
    return file;
  } finally {
    image.close?.();
  }
}

/** Prépare la photo choisie par la personne avant son envoi au serveur. */
@Injectable({ providedIn: 'root' })
export class PhotoService {
  protected readonly codec: ImageCodec = browserCodec;

  /** Photo réduite, ou erreur `PHOTO_TOO_LARGE` si elle reste au-dessus de la limite du serveur. */
  async prepare(file: File): Promise<File> {
    const photo = await reducePhoto(file, this.codec);
    if (photo.size > PHOTO_MAX_BYTES) throw new Error(PHOTO_TOO_LARGE);
    return photo;
  }
}
