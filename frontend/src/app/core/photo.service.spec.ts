import { TestBed } from '@angular/core/testing';
import {
  DecodedImage,
  ImageCodec,
  PHOTO_MAX_SIDE,
  PHOTO_TARGET_BYTES,
  PHOTO_TOO_LARGE,
  PhotoService,
  reducePhoto,
} from './photo.service';

/** Fichier de la taille voulue, sans contenu réel (jsdom ne sait pas dessiner). */
function fileOf(bytes: number, name = 'IMG_2041.JPG', type = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/**
 * Faux navigateur : l'image décodée a les dimensions données, et la taille d'un JPEG
 * dépend du nombre de pixels et de la qualité, comme pour une vraie photo.
 */
function fakeCodec(width: number, height: number, bitsPerPixel: number) {
  const encoded: { width: number; height: number; quality: number; size: number }[] = [];
  const close = vi.fn();
  const codec: ImageCodec = {
    decode: async () => ({ width, height, source: {} as CanvasImageSource, close }),
    encode: async (_image: DecodedImage, w: number, h: number, quality: number) => {
      const size = Math.round((w * h * bitsPerPixel * quality) / 8);
      encoded.push({ width: w, height: h, quality, size });
      return new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
    },
  };
  return { codec, encoded, close };
}

describe('Réduction des photos avant envoi', () => {
  it('réduit une photo de téléphone sous la limite', async () => {
    // Photo de 12 mégapixels prise en portrait : environ 4,6 Mo.
    const photo = fileOf(4_600_000);
    const { codec, encoded } = fakeCodec(3024, 4032, 3.5);
    const reduced = await reducePhoto(photo, codec);
    expect(reduced.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES);
    expect(reduced.type).toBe('image/jpeg');
    expect(reduced.name).toBe('IMG_2041.jpg');
    // Le sens et les proportions sont gardés, le plus grand côté ramené à 800 pixels.
    expect(encoded.at(-1)).toMatchObject({ width: 600, height: PHOTO_MAX_SIDE });
  });

  it('baisse la qualité puis les dimensions tant que la photo reste trop lourde', async () => {
    // Image très peu compressible : même en qualité basse, 800 pixels dépassent 500 Ko.
    const { codec, encoded } = fakeCodec(4000, 3000, 20);
    const reduced = await reducePhoto(fileOf(8_000_000), codec);
    expect(reduced.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES);
    expect(encoded.map((e) => e.quality).slice(0, 3)).toEqual([0.85, 0.7, 0.55]);
    expect(encoded[0]).toMatchObject({ width: 800, height: 600 });
    expect(encoded.at(-1)!.width).toBeLessThan(800);
  });

  it('laisse telle quelle une photo déjà légère', async () => {
    const photo = fileOf(300_000, 'portrait.png', 'image/png');
    const decode = vi.fn();
    expect(await reducePhoto(photo, { decode, encode: vi.fn() })).toBe(photo);
    expect(decode).not.toHaveBeenCalled();
  });

  it('laisse au serveur une image que le navigateur ne sait pas lire', async () => {
    const photo = fileOf(2_000_000, 'scan.heic', 'image/heic');
    const codec: ImageCodec = {
      decode: () => Promise.reject(new Error('illisible')),
      encode: vi.fn(),
    };
    expect(await reducePhoto(photo, codec)).toBe(photo);
  });

  it('libère l’image décodée', async () => {
    const { codec, close } = fakeCodec(4032, 3024, 3.5);
    await reducePhoto(fileOf(4_600_000), codec);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('refuse avant l’envoi une photo qui reste au-dessus de 5 Mo', async () => {
    const service = TestBed.inject(PhotoService);
    // jsdom ne sait pas lire l'image : elle reste à sa taille d'origine.
    await expect(service.prepare(fileOf(6 * 1024 * 1024))).rejects.toThrow(PHOTO_TOO_LARGE);
    const small = fileOf(200_000);
    expect(await service.prepare(small)).toBe(small);
  });
});
