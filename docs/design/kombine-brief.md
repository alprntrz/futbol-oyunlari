# Kombine: taş görselleri brief'i

Kombine'deki taşlar şimdilik SF Symbols ikonlu renkli karelerden oluşuyor
(`mobile/src/lib/kombine/look.ts`). Oyun hissini asıl taşıyacak olan bu taşların
özel çizimi. Bu brief ChatGPT görsel üretimi içindir; stil kuralları
`ikon-brief.md` §2 ile aynıdır (soft 3D, yazı/logo yok, şeffaf PNG).

## Neden önemli

Match-3'te oyuncu ekrana en çok taşlara bakar. Taşların:
- **renkten bağımsız da ayırt edilmesi** (renk körlüğü): her biri farklı silüet,
- **küçükken okunması** (ekranda ~44 pt): tek nesne, kalın hatlar,
- **aynı ışık ve kamerayla** çizilmesi (hepsi aynı setten görünmeli) gerekir.

## Ortak prompt başı (her taşın başına ekle)

> Soft 3D game tile icon for a football (soccer) match-three mobile game. Single
> object, centred, front view with a slight top-down tilt, soft studio light from
> the top left, gentle matte material, rounded chunky shapes, subtle inner
> highlight, no text, no letters, no numbers, no logos, no real club crests,
> transparent background, 1024×1024, ~12% empty margin on every side.
> Same lighting and camera as the rest of the set.

## Taşlar (6)

| Dosya | Nesne | Ana renk | Prompt sonu |
|---|---|---|---|
| `tile-shirt.png` | forma | kırmızı `#E5484D` | A plain short-sleeve football shirt, red body, slightly darker red collar and cuffs. |
| `tile-glove.png` | kaleci eldiveni | mavi `#2563EB` | One goalkeeper glove, fingers spread, blue with a lighter blue palm. |
| `tile-flag.png` | köşe bayrağı | yeşil `#16A34A` | A corner flag on a short white pole, green flag gently waving. |
| `tile-trophy.png` | kupa | altın `#F5B500` | A small two-handled cup trophy on a round base, warm gold. |
| `tile-boot.png` | krampon | mor `#7C3AED` | One football boot seen from the side, purple with white studs. |
| `tile-whistle.png` | düdük / kronometre | turuncu `#F97316` | A referee stopwatch, orange body, white face without numbers. |

## Özel taşlar (aynı stil, ayrı dosya)

| Dosya | Anlamı | Prompt sonu |
|---|---|---|
| `tile-ball.png` | gol topu | A classic white football with dark pentagons, slightly glossy. |
| `tile-freekick.png` | Frikik (5'li) | A football with a swirling rainbow motion trail curling around it. |
| `fx-shot.png` | Şut (4'lü) çizgisi | A horizontal white speed streak with a soft glow, for overlaying on a tile. |
| `fx-header.png` | Kafa (L/T) halkası | A soft white circular shockwave ring, thin, for overlaying on a tile. |
| `tile-mud.png` | çamur | A square patch of wet brown mud with a few grass blades at the edges, top view, seamless edges. |

## Teslim

Çıktıları `~/Downloads/futbol-oyunlari-brand/kombine/` klasörüne koy; işleme
betiği (`scripts/brand-assets.py`) diğer varlıklarda olduğu gibi kırpıp
boyutlandırır. Ardından `look.ts` ikonların yerine görselleri kullanacak şekilde
güncellenir.
