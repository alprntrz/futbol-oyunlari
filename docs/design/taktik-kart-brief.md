# Taktik kartları: görsel brief

Pitch Chess'te (Taktik Tahtası) 2., 3. ve 4. aşamanın başında üç taktik kartından
biri seçiliyor (`mobile/src/components/taktik/TacticsCard.tsx`). Kartın rengi,
çerçevesi, başlığı ve açıklaması kodla çiziliyor; üstteki kare alan şimdilik emoji
gösteriyor. Bu brief o alanın çizimleri içindir, ChatGPT görsel üretimi için.

Bitince dosyaları bir klasöre koy ve şunu çalıştır:

    python3 scripts/taktik-card-assets.py <klasör>

Betik kırpar, küçültür ve `mobile/assets/brand/taktik/aug/` içine yazar. Ardından
`TAKTIK.aug` (mobile/src/lib/brand.ts) dosyaları kullanmaya başlar, emoji kalkar.

## Ortak prompt başı (her görselin başına ekle)

> Mobile game card illustration, casual-game style, football themed. Soft glossy
> 3D, chunky rounded shapes, thick clean silhouette, warm top-left studio light,
> gentle rim light, rich saturated colours without neon. No text, no letters, no
> numbers, no logos, no real club crests, no real people or faces of real
> players (faceless or stylised cartoon figures only). Transparent background
> PNG, 1024×1024, the scene centred with ~8% empty margin, readable at 120 px.

Kartın arka planı kodla boyanıyor (mor = taktik, yeşil = kadro, turuncu = destek),
bu yüzden çizimin arka planı şeffaf olmalı. Ana renkler kartın rengiyle uyumlu
olsun.

## Kartlar

| Dosya | Kart | Tür | Prompt sonu |
|---|---|---|---|
| `aug-gegenpress.png` | Gegenpress | Taktik (mor) | Three small faceless cartoon players in purple kits sprinting together to swarm a football, motion lines, a lightning spark above the ball. |
| `aug-bus.png` | Otobüsü çek | Taktik (mor) | A chunky purple team bus parked sideways in front of a small football goal, the ball bouncing off its side. |
| `aug-longball.png` | Uzun top | Taktik (mor) | A football flying in a long high arc across a tiny pitch, a dotted trajectory line, a target ring where it lands. |
| `aug-wings.png` | Kanat oyunu | Taktik (mor) | A football with small feathered wings flying along the side line of a tiny pitch, a corner flag below. |
| `aug-academy.png` | Altyapı | Kadro (yeşil) | A small green sprout growing out of a football, two tiny youth-team shirts on a little stand beside it. |
| `aug-signing.png` | Yıldız transferi | Kadro (yeşil) | A fountain pen signing a contract paper with a gold star seal, a green football shirt on a hanger behind it. |
| `aug-legend.png` | Kulüp efsanesi | Kadro (yeşil) | A golden crown resting on a folded green football shirt, small sparkles. |
| `aug-intl.png` | Milli ara | Kadro (yeşil) | A small globe with a football orbiting it, three tiny blank pennant flags in different colours (no real flags). |
| `aug-cash.png` | Kasa dolu | Destek (turuncu) | An overflowing treasure chest of gold coins with a football on top, coins spilling out. |
| `aug-crowd.png` | Seyirci desteği | Destek (turuncu) | A tiny stadium stand full of cheering faceless fans waving orange scarves, a megaphone in front. |
