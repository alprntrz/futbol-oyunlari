# Rondo: görsel brief (ChatGPT)

Oyun: bir kulüp çıkar, iki oyuncu sırayla o kulüpte oynamış birini söyler (`src/lib/rondo.ts`).
Adı antrenmandaki pas oyunundan geliyor: ortadaki oyuncu topu kapmaya çalışır, çemberdekiler
pas verir. Görseller bu "çember + sırayla pas" fikrini anlatır.

Şimdilik oyun Pitch Chess'in top ikonunu kullanıyor (`RONDO` in `mobile/src/lib/brand.ts`).
Bu brief'teki 3 görsel gelince onların yerine geçecek.

## Teslimat

- Dosyalar: `docs/design/rondo-art/originals/<dosya>.png`, 1024×1024, **şeffaf** arka plan.
- Klasörü bana söyle; kırpıp küçültüp `mobile/assets/brand/rondo/` altına koyarım ve bağlarım.

## Ortak prompt başı (her görselin başına ekle)

```
Same style as the other icons of this app (Tic-Tac-Toe board, Quiz bubble, Bingo card,
Possession hexes): soft 3D, rounded friendly shapes, matte finish, subtle soft shadow,
gentle highlights, light from the top left. Clean simple silhouette that stays readable
at 44px. Centred, transparent background, 1024x1024, about 12% empty margin on every side.
Palette: indigo #3730A3, light indigo #E0E7FF, grass green #16A34A, coral #F43F5E,
amber #F59E0B, ink #0B1220, white.
No text, no letters, no numbers, no logos, no club crests, no real people or faces.
```

## Görseller

| Dosya | Nerede | Prompt (ortak başın ardından) |
|---|---|---|
| `rondo-icon.png` | Oyunlar sekmesi kartı, oyun girişi, Ayarlar > Nasıl oynanır (~52–96 pt) | `A football in the middle of a ring of four small rounded arrows chasing each other clockwise, like a passing circle seen from above. Arrows alternate grass green and coral (the two players taking turns). Football white with ink patches. A soft light-indigo round base under it.` |
| `rondo-hero.png` | Oyun girişinin büyük görseli (ileride) | `Top-down toy pitch circle (light indigo ground with a thin white ring line), five chunky faceless toy footballers standing around the ring in plain white kits with green or coral trim, one in the middle in an indigo bib reaching for the ball; dotted pass lines between the outer players. Playful, uncluttered.` |
| `rondo-turn.png` | Sıra değişince küçük ikon (ileride, ~28 pt) | `Two small speech-bubble shapes overlapping, one grass green and one coral, with a tiny football between them, suggesting "your turn / my turn". Very simple.` |

## Kontrol listesi

- Yazı, numara, logo, arma, gerçek yüz yok.
- 44 px'te tanınır: ince çizgi ve küçük detay yok.
- Arka plan gerçekten şeffaf (dama deseni çizilmiş sahte şeffaflık değil).
- Uygulamanın diğer ikonlarıyla aynı ışık ve aynı malzeme.
