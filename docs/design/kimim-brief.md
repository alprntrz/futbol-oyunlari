# Ben Kimim? (Who Am I?): görsel brief (ChatGPT)

Oyun: iki oyuncuya aynı gizli futbolcu verilir; sırayla evet/hayır sorusu sorar ya da isim
tahmin ederler (`src/lib/whoami.ts`). Tek kişilik Gizli Oyuncu'dan (siyah silüet + soru işareti)
ayrı görünmeli: burada **iki kişi aynı gizemi çözmeye yarışıyor**.

Şimdilik oyun Gizli Oyuncu'nun ikonunu kullanıyor (`BRAND.icon.mystery`), Oyunlar sekmesinde iki
kart aynı görünüyor. Bu brief'teki 3 görsel gelince onların yerine geçecek.

## Teslimat

- Dosyalar: `docs/design/kimim-art/originals/<dosya>.png`, 1024×1024, **şeffaf** arka plan.
- Klasörü bana söyle; kırpıp küçültüp `mobile/assets/brand/kimim/` altına koyarım ve bağlarım.

## Ortak prompt başı (her görselin başına ekle)

```
Same style as the other icons of this app (Tic-Tac-Toe board, Quiz bubble, Bingo card,
Rondo ring of arrows): soft 3D, rounded friendly shapes, matte finish, subtle soft shadow,
gentle highlights, light from the top left. Clean simple silhouette that stays readable
at 44px. Centred, transparent background, 1024x1024, about 12% empty margin on every side.
Palette: magenta #86198F, light pink-violet #FAE8FF, grass green #16A34A, coral #F43F5E,
amber #F59E0B, ink #0B1220, white.
No text, no letters, no numbers, no logos, no club crests, no real people or faces.
```

## Görseller

| Dosya | Nerede | Prompt (ortak başın ardından) |
|---|---|---|
| `kimim-icon.png` | Oyunlar sekmesi kartı, Ayarlar > Nasıl oynanır (~52 pt) | `A plain football shirt standing upright, white with magenta trim, its number area replaced by a big rounded magenta question mark (a shape, not a letter). Two small speech bubbles float on either side, one grass green and one coral, each with a tiny football inside. Soft light pink-violet round base under it.` |
| `kimim-hero.png` | Oyunun giriş ekranı (~150 pt) | `Two chunky faceless toy footballers sitting face to face at a small round table, one in a green kit and one in a coral kit, each holding up a little card; between them on the table a white football shirt lies face down under a soft spotlight with a magenta question mark floating above it. Playful, uncluttered, seen slightly from above.` |
| `kimim-lives.png` | Maçta can göstergesi (ileride, ~20 pt) | `A single small rounded football shaped like a heart (a football with a heart outline, black and white patches), glossy toy style. Very simple, must read at 20px.` |

## Kontrol listesi

- Yazı, numara, logo, arma, gerçek yüz yok; soru işareti bir şekil, harf gibi yazılmamış.
- Gizli Oyuncu'nun siyah silüetine benzemiyor (o tek kişilik oyun).
- 44 px'te tanınır: ince çizgi ve küçük detay yok.
- Arka plan gerçekten şeffaf (dama deseni çizilmiş sahte şeffaflık değil).
- Rondo ve diğer ikonlarla aynı ışık ve malzeme.
