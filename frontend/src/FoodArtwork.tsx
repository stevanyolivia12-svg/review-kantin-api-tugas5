import { useState } from 'react';

const foodPhotos = [
  'photo-1504674900247-0877df9cc836',
  'photo-1546069901-ba9599a7e63c',
  'photo-1569718212165-3a8278d5f624',
  'photo-1555939594-58d7cb561ad1',
  'photo-1555507036-ab1f4038808a',
  'photo-1600271886742-f049cd451bba',
  'photo-1578985545062-69928b1d9587',
  'photo-1573080496219-bb080dd4f877',
];

const foodEmojis = ['🍜', '🍛', '🍲', '🍗', '🥐', '🥤', '🍰', '🍟'];

function stableIndex(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % foodPhotos.length;
}

function photoFor(name: string, category?: string | null): number {
  const description = `${name} ${category ?? ''}`.toLowerCase();
  if (/jus|minuman|milk tea|es teh|kopi/.test(description)) return 5;
  if (/kue|cake|dessert|roti|pastry/.test(description)) return 6;
  if (/kentang|fries/.test(description)) return 7;
  if (/kwetiau|mie|mi |ramen|soto|bakso/.test(description)) return 2;
  if (/sate|steak|ayam|geprek|katsu/.test(description)) return 3;
  if (/salad|sayur/.test(description)) return 1;
  return 0;
}

export function FoodArtwork({
  name,
  category,
  id,
  className = '',
}: {
  name: string;
  category?: string | null;
  id?: number;
  className?: string;
}) {
  const index = photoFor(name, category);
  const fallbackIndex = stableIndex(`${id ?? ''}:${name}:${category ?? ''}`);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`food-artwork food-artwork-${fallbackIndex % 4} ${className}`} role="img" aria-label={`Gambar ${name}`}>
      {!failed ? (
        <img
          src={`https://images.unsplash.com/${foodPhotos[index]}?auto=format&fit=crop&w=800&q=80`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-artwork-fallback" aria-hidden="true">{foodEmojis[fallbackIndex]}</span>
      )}
      <span className="food-artwork-label">{name}</span>
    </div>
  );
}
