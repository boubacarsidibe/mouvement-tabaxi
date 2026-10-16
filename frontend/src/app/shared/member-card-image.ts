/** Informations affichées sur la carte de membre. */
export interface MemberCardData {
  name: string;
  number: string;
  locality: string;
  date: string;
  photo: string | null;
}

/**
 * Zones du modèle de carte (1080 x 720 pixels).
 * Elles correspondent aux pourcentages utilisés par la carte affichée à l'écran.
 */
const TEMPLATE = 'modele-carte.webp';
const WIDTH = 1080;
const HEIGHT = 720;
const PHOTO = { x: 50, y: 213, width: 298, height: 325, radius: 22 };
const FIELDS = [
  { y: 366, width: 561 },
  { y: 446, width: 561 },
  { y: 528, width: 561 },
  { y: 610, width: 482 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    image.src = src;
  });
}

/** Dessine la carte complète (modèle, photo, informations) et la renvoie en image PNG. */
export async function drawMemberCard(member: MemberCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Le dessin de la carte est indisponible sur cet appareil.');

  context.drawImage(await loadImage(TEMPLATE), 0, 0, WIDTH, HEIGHT);

  if (member.photo) {
    const photo = await loadImage(member.photo);
    context.save();
    context.beginPath();
    context.roundRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height, PHOTO.radius);
    context.clip();
    const scale = Math.max(PHOTO.width / photo.width, PHOTO.height / photo.height);
    const width = photo.width * scale;
    const height = photo.height * scale;
    context.drawImage(
      photo,
      PHOTO.x + (PHOTO.width - width) / 2,
      PHOTO.y + (PHOTO.height - height) / 2,
      width,
      height,
    );
    context.restore();
  }

  const values = [member.name, member.number, member.locality, member.date];
  context.fillStyle = '#fff';
  for (const field of FIELDS) {
    context.beginPath();
    context.roundRect(473, field.y, field.width, 34, 7);
    context.fill();
  }
  context.fillStyle = '#293d30';
  context.font = '500 26px "Segoe UI", Arial, sans-serif';
  context.textBaseline = 'middle';
  values.forEach((value, index) =>
    context.fillText(value, 482, FIELDS[index].y + 17, FIELDS[index].width - 20),
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Création de l’image impossible.'))),
      'image/png',
    ),
  );
}
