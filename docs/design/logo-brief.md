# Tiktako wordmark: logo brief

Ana sayfanın en üstünde duracak, sadece yazıdan oluşan (tipografik) bir logo.
Şu an yerinde uygulamanın kendi yazı tipiyle dizilmiş geçici bir "tiktako."
yazısı var (`mobile/src/components/HomeBoard.tsx`, `Wordmark`). Bu brief
ChatGPT görsel üretimi içindir.

## Ne istiyoruz

- **Sadece yazı:** "tiktako" küçük harflerle. Top, kupa, forma gibi bir simge yok.
- **Şık ve sade:** spor markası ciddiyetinde, oyuncak gibi değil. Tek renk, düz;
  gölge, 3D, parlama, kontur yok.
- **Futbola tek bir ince dokunuş** (yalnızca birini seç): "o" harflerinden
  birinin içinde çok sade bir top deseni, ya da "i"nin noktası küçük bir top,
  ya da sondaki nokta yeşil bir top. Abartılı olmamalı; uzaktan sadece yazı gibi
  okunmalı.
- **Küçükte okunmalı:** uygulamada yaklaşık 28–34 pt yüksekliğinde duracak.
- Renk: yazı koyu `#0E1A14`, tek vurgu çim yeşili `#16A34A`.

## Prompt

> Minimal typographic wordmark logo for a football trivia mobile app called
> "tiktako", all lowercase. Custom geometric sans-serif lettering, bold but
> refined, tight even spacing, slightly condensed, like a modern sports brand.
> Flat single colour #0E1A14 with one small accent in pitch green #16A34A: the
> final dot after the word is a tiny, very simple football. No other icon, no
> shadow, no 3D, no gradient, no outline, no tagline. Transparent background
> PNG, wide format 2048×640, the word centred with generous empty margin.

Tek değişkenli varyasyonlar (beğenmezsen):
- *"…same, but the dot of the letter i is the tiny football instead of a final dot"*
- *"…same, but one of the letters o contains a very subtle football pattern"*
- *"…same, but a softer rounded sans-serif"*

Bir de beyaz versiyon iste: *"…same logo in white #FFFFFF"* (ileride koyu
zeminler için).

## Teslim

Dosyaları `tiktako-logo.png` (koyu) ve `tiktako-logo-white.png` (beyaz) adıyla
bir klasöre koy ve yolunu yaz. Kırpıp boyutlayıp ana sayfadaki geçici yazının
yerine koyarım.
