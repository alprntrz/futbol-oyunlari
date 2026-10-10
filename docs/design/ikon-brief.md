# Futbol Oyunları — İkon ve illüstrasyon brief'i

ChatGPT görsel üretimi (GPT Image) için hazırlandı. Prompt'lar İngilizce, çünkü
model İngilizce talimatlarla daha tutarlı sonuç veriyor. Üretilen dosyaları
**`mobile/assets/brand/`** klasörüne, aşağıdaki dosya adlarıyla koy; gerisini ben
bağlarım.

---

## 1. Önce bunu oku: neyi üretiyoruz, neyi üretmiyoruz

| Ne | Üretilecek mi? | Neden |
|---|---|---|
| Uygulama ikonu, açılış logosu | ✅ Evet | Uygulamanın yüzü |
| Mod ikonları (Günün Kadrosu, Pratik, Takımını seç, Online Yarış, Tiki Taka) | ✅ Evet | Ana ekrandaki satırlar ve kartlar |
| Boş durum / sonuç illüstrasyonları | ✅ Evet | İstatistik boşken, yarış beklerken, oyun bitince |
| **Formalar** | ❌ Hayır (kodda kalıyor) | Her takımın renkleri farklı (45+ takım) ve forma numarası değişken. Görsel dosya bunu yapamaz; forma kodla (SVG) çiziliyor ve takım renklerine göre boyanıyor. İstersen sadece **şekil referansı** üretebilirsin (bkz. bölüm 6), ben onu vektöre çeviririm. |
| Alt sekme ikonları (Oyunlar / İstatistik / Ayarlar) | ❌ Hayır | Apple'ın kendi SF Symbols ikonları; seçili/seçisiz renkleri ve iOS 26 cam görünümü otomatik. Özel görsel bunları bozar. |
| Klavye, butonlar, oklar gibi arayüz ikonları | ❌ Hayır | Aynı sebep: sistem ikonları |

---

## 2. Stil rehberi (tüm görseller için ortak)

**His:** sıcak, oyuncu, sade. Uygulamanın açık temasıyla uyumlu: beyaz/açık gri
zemin, tek ana renk çim yeşili.

**Stil:** "soft 3D" — yuvarlak hatlı, hafif hacimli, mat yüzeyli (oyuncak/kil
hissi ama abartısız). Keskin fotogerçekçilik yok, parlak plastik yok, neon yok.

**Renk paleti** (prompt'larda da geçiyor):

| Rol | Renk | Hex |
|---|---|---|
| Ana (çim yeşili) | yeşil | `#16A34A` |
| Açık yeşil | yumuşak | `#DCFCE7` |
| Mavi (X oyuncusu) | mavi | `#2563EB` |
| Mercan (O oyuncusu) | mercan | `#F43F5E` |
| Amber (vurgu, kupa) | sarı-turuncu | `#F59E0B` |
| Mor (online yarış) | mor | `#7C3AED` |
| Koyu metin | lacivert-siyah | `#0B1220` |
| Zemin | açık gri | `#F2F4F7` |

**Kurallar (hepsinde geçerli):**
- Görselde **yazı, harf, rakam olmasın** (forma numarası dahil). Metinleri uygulama kendisi yazıyor, iki dilde.
- **Gerçek kulüp arması, logo, marka, gerçek futbolcu yüzü yok.** Telif ve mağaza onayı için şart.
- Tek nesne, ortalanmış, kenarlarda ~%12 boşluk.
- Mod ikonları küçük gösterilecek (40–56 pt). **Basit silüet**, en fazla 2–3 ana şekil; küçükken de okunmalı.
- Arka plan **şeffaf PNG** (uygulama ikonu hariç).

---

## 3. Tutarlılık için üretim sırası

1. Önce aşağıdaki **"stil kartı"** prompt'unu çalıştır. Beş mod ikonunu tek görselde, aynı stilde görürsün.
2. Beğendiğin stil kartını aynı sohbette tut ve her ikon için *"Same style as the style sheet above"* diye başlayan tekil prompt'ları sırayla ver.
3. Hepsini **aynı sohbette** üret. Yeni sohbet stili kaydırır.

### Stil kartı prompt'u (önce bu)

```
Create a style sheet of 5 app icons in a single row on a plain white background, same visual language for all:
1) a calendar page with a small football on it,
2) two curved arrows forming a shuffle loop around a football,
3) a plain football shirt seen from the front (no number, no logo),
4) a stopwatch with a small chequered racing flag,
5) a 3x3 tic-tac-toe grid with one X and one O.
Style: soft 3D, rounded friendly shapes, matte finish, subtle soft shadows, gentle highlights, clean simple silhouettes that stay readable at 48px.
Palette only: grass green #16A34A, light green #DCFCE7, blue #2563EB, coral #F43F5E, amber #F59E0B, purple #7C3AED, ink #0B1220, white.
No text, no letters, no numbers, no logos, no real club crests.
```

---

## 4. Varlık listesi ve prompt'lar

### A. Uygulama ikonu — `app-icon.png`
- **Boyut:** 1024×1024 PNG, **şeffaflık yok**, tam kare. Köşeleri yuvarlatma (iOS kendisi yapar).
- **Nerede:** telefon ana ekranı, App Store.

```
App icon for a football (soccer) puzzle game, 1024x1024, full-bleed square, opaque background, do NOT round the corners.
Background: smooth vertical gradient of grass green, #22C55E at the top to #15803D at the bottom, with very faint lighter mowing stripes.
Centered subject: a white football shirt seen from the front in soft 3D, slightly tilted, with a small football resting against its lower corner.
Style: soft 3D, rounded, matte, subtle soft shadow under the subject, gentle highlights. Bold and simple so it reads at 60px on a phone home screen.
No text, no letters, no numbers, no logos, no club crest.
```

### B. Android ikon ön planı — `android-icon-foreground.png`
- **Boyut:** 1024×1024 PNG, **şeffaf** arka plan. Nesne ortadaki %66'lık alanda kalsın (Android kenarları kırpar).

```
Same subject and style as the app icon above (white football shirt with a small football), on a fully transparent background, no gradient.
Keep the whole subject inside the central 60% of the canvas with generous empty margins. No text, no logos.
```

### C. Açılış logosu — `splash-logo.png`
- **Boyut:** 1024×1024 PNG, şeffaf. Açılışta açık gri zemin (`#F2F4F7`) üstünde ortada küçük gösterilecek.

```
Same white football shirt with small football as the app icon, but placed on a soft green rounded-square badge (#16A34A, rounded corners), soft 3D, on a transparent background.
Centered, subject occupies about 70% of the canvas. No text, no logos.
```

### D. Mod ikonları (şeffaf, 1024×1024; uygulamada ~48 pt)

**`icon-daily.png`** — Günün Kadrosu (ana sayfadaki yeşil kart)
```
Same style as the style sheet above. Single icon: a calendar page with rings on top and a small football on the page. Calendar body white with a grass green #16A34A header strip. Transparent background, centered, simple silhouette, no text or numbers on the calendar.
```

**`icon-practice.png`** — Pratik
```
Same style as the style sheet above. Single icon: two rounded arrows forming a shuffle/loop around a small football. Arrows grass green #16A34A, football white with ink #0B1220 patches. Transparent background, centered, no text.
```

**`icon-team.png`** — Takımını seç
```
Same style as the style sheet above. Single icon: a plain football shirt seen from the front, coral #F43F5E body with white collar and white sleeve cuffs, no number, no logo, no crest. Transparent background, centered.
```

**`icon-race.png`** — Online Yarış
```
Same style as the style sheet above. Single icon: a stopwatch in purple #7C3AED with a small chequered racing flag behind it, suggesting a fast head-to-head race. Transparent background, centered, no text or numbers on the dial.
```

**`icon-tiki.png`** — Tiki Taka Toe
```
Same style as the style sheet above. Single icon: a 3x3 tic-tac-toe grid drawn with thick rounded white bars on a light rounded tile, one bold blue #2563EB X and one bold coral #F43F5E O inside the grid. Transparent background, centered.
```

### E. İllüstrasyonlar (şeffaf, 1536×1024 yatay; uygulamada ~200 pt genişlik)

**`illus-empty-stats.png`** — İstatistik boşken
```
Same style as the style sheet above, wider composition. A small empty bar chart with three rounded bars in light green #DCFCE7 and one grass green #16A34A bar, next to a football resting on the ground, calm and friendly mood, lots of empty space. Transparent background, no text, no numbers.
```

**`illus-waiting-room.png`** — Online yarışta rakip beklenirken
```
Same style as the style sheet above, wider composition. Two simple rounded smartphones facing each other with a small football bouncing between them along a dotted arc, purple #7C3AED and grass green #16A34A accents. Transparent background, no text, no faces.
```

**`illus-win.png`** — 11'in hepsi bulununca
```
Same style as the style sheet above. A shiny but matte amber #F59E0B trophy cup with a small football in front of it and a few soft green confetti pieces. Transparent background, centered, no text.
```

**`illus-finish.png`** — Oyun bitti ama hepsi bulunamadı
```
Same style as the style sheet above. A friendly referee whistle in ink #0B1220 with a green #16A34A lanyard and a small football next to it, encouraging (not sad) mood. Transparent background, centered, no text.
```

**`illus-howto.png`** — "Nasıl oynanır" kartının başı
```
Same style as the style sheet above, wider composition. A smartphone lying slightly tilted showing a green football pitch with a few plain white shirts on it, and above it a row of five rounded letter tiles: two green #22A55A, one amber #E9B10A, two grey #8D96A5, all tiles blank with no letters. Transparent background, no text.
```

---

## 5. Teslim

`mobile/assets/brand/` klasörüne şu adlarla koy:

```
app-icon.png
android-icon-foreground.png
splash-logo.png
icon-daily.png
icon-practice.png
icon-team.png
icon-race.png
icon-tiki.png
illus-empty-stats.png
illus-waiting-room.png
illus-win.png
illus-finish.png
illus-howto.png
```

Bir kısmını üretip beğenmezsen sorun değil; olanları bağlarım, eksikler için
mevcut sistem ikonları kalır.

---

## 6. (İsteğe bağlı) Forma şekli referansı — `ref-jersey.png`

Formadaki **şekli** değiştirmek istersen (V yaka yerine polo yaka, daha geniş
kollar vb.) bunu üret. Renk ve numara yine kodla gelecek; ben bu görseli SVG
çizime çeviririm.

```
Flat front-view football shirt silhouette as a design reference: solid white fill with a thin dark outline, short sleeves, polo-style collar, clear separate shapes for body, left sleeve, right sleeve, collar and sleeve cuffs. Perfectly symmetric, no shading, no number, no logo, no wrinkles, plain transparent background, 1024x1024.
```
