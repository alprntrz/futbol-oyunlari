# Mağaza ekran görüntüleri: ChatGPT promptları

Ham görüntüler `docs/release/screenshots/tr/` içinde: iPhone 17 Pro Max simülatörü,
1320×2868 (App Store'un istediği 6.9" boyutu), saat 9:41, uygulama Türkçe.
Sıra, mağazada görünecek sıradır (ilk 3 en önemlisi; arama sonuçlarında bunlar görünür).

| # | Dosya | Ekran |
|---|---|---|
| 1 | `01-hattrick.png` | Hat-trick tahtası, oyun ortası |
| 2 | `02-zafer.png` | Seri zaferi (defne, madalya) |
| 3 | `03-bilgi-yarisi.png` | Bilgi Yarışı, doğru cevap +8 |
| 4 | `04-eksik-11.png` | Eksik 11: Türkiye–Hırvatistan, EURO 2008 |
| 5 | `05-possession.png` | Possession Play altıgen saha |
| 6 | `06-hattrick-cevap.png` | Futbolcu arama |
| 7 | `07-oyunlar.png` | Oyunlar listesi |
| 8 | `08-ana-sayfa.png` | Ana sayfa, günün ızgarası |

## Apple kuralı (önemli)

Ekranın **içindeki** arayüz gerçek kalmalı (Guideline 2.3.3). Üstüne başlık, arka plan
ve telefon çerçevesi eklemek serbest; ama ChatGPT ekranı "yeniden çizerse" (yazıları,
formaları, isimleri değiştirirse) o görsel reddedilebilir. Her çıktıyı orijinalle
yan yana kontrol et. ChatGPT ekranı bozarsa çözüm aşağıda, "B planı"nda.

## Nasıl üretilir

1. Yeni bir ChatGPT sohbeti aç, önce **ortak prompt**u gönder (stil sabitlensin).
2. Sonra her ekran için ilgili PNG'yi yükle ve o ekranın satırını gönder.
3. Hepsi **aynı sohbette** üretilsin, yoksa stil kayar.
4. Çıktı 1320×2868 değilse bana ver, ben doğru boyuta getiririm.

### Ortak prompt (ilk mesaj, görsel yüklemeden)

```
I will upload real app screenshots one by one. For each, make an App Store screenshot
in exactly this style, consistent across the whole set:

- Canvas: portrait, 1320x2868 px.
- Background: rich grass green (#16A34A to #0F7A35 soft vertical gradient) with a very
  subtle mowed-pitch stripe pattern and a faint white centre-circle line, nothing busy.
- Top 28%: the headline I give you, in a heavy condensed sports display font (like
  Bebas Neue / Anton), white, centred, max 2 lines, with a small gold (#F5B800)
  underline accent. Optional smaller subline under it in white at 80% opacity.
- Below: a modern iPhone (thin black bezel, Dynamic Island) slightly tilted 0-4 degrees,
  showing MY UPLOADED SCREENSHOT INSIDE THE SCREEN.
- Critical: paste the uploaded screenshot into the phone screen pixel-for-pixel. Do
  not redraw, retype, translate, restyle, crop out or "improve" anything inside it.
  Every word, number, shirt and colour inside the phone must stay exactly as uploaded.
- No logos, no club crests, no real people, no "official" wording, no extra badges
  or stars or awards.
- Soft shadow under the phone. Clean, premium, playful, like a top football game.
Reply "ready" and wait for the first screenshot.
```

### Ekran başına mesajlar (görseli yükle + bunu yaz)

**1. `01-hattrick.png`**
```
Headline: "FUTBOLCUYLA XOX"
Subline: "Satırı ve sütunu tutan oyuncuyu bul"
```

**2. `02-zafer.png`**
```
Headline: "3 ALAN SERİYİ KAZANIR"
Subline: "Arkadaşınla ya da online rakiple"
Note: this screenshot already has a green background; keep the phone frame clearly
visible against the outer background (make the outer background a bit darker).
```

**3. `03-bilgi-yarisi.png`**
```
Headline: "5 KİŞİLİK BİLGİ YARIŞI"
Subline: "Hızlı ve doğru olan kazanır"
```

**4. `04-eksik-11.png`**
```
Headline: "EFSANE MAÇLARIN İLK 11'İ"
Subline: "Formaya dokun, soyadını yaz"
```

**5. `05-possession.png`**
```
Headline: "SAHAYI ELE GEÇİR"
Subline: "Altıgeni kap, rakibin bölgesini çal"
```

**6. `06-hattrick-cevap.png`**
```
Headline: "BİNLERCE FUTBOLCU"
Subline: "Süper Lig'den Premier Lig'e"
```

**7. `07-oyunlar.png`**
```
Headline: "6 FUTBOL OYUNU"
Subline: "Hepsi tek uygulamada"
```

**8. `08-ana-sayfa.png`**
```
Headline: "HER GÜN YENİ IZGARA"
Subline: "Her gün yeni görevler ve ödüller"
```

### İngilizce set (ikinci dil)

Ham görüntüler `docs/release/screenshots/en/` içinde, uygulama İngilizceyken çekildi
(Eksik 11 ekranı: Liverpool 4-0 Barcelona, 2019). Aynı sohbette ortak promptu bir kez
daha gönderip aşağıdaki başlıklarla üret.

| # | Dosya | Headline | Subline |
|---|---|---|---|
| 1 | `01-hattrick.png` | TIC-TAC-TOE WITH FOOTBALLERS | Name a player who fits the row and column |
| 2 | `02-victory.png` | FIRST TO 3 WINS | Play a friend or an online rival |
| 3 | `03-quiz.png` | LIVE QUIZ FOR UP TO 5 | Fast and right wins |
| 4 | `04-missing-11.png` | NAME THE STARTING XI | Tap a shirt, type the surname |
| 5 | `05-possession.png` | TAKE OVER THE PITCH | Claim hexes, steal your rival's ground |
| 6 | `06-hattrick-answer.png` | THOUSANDS OF PLAYERS | From the Süper Lig to the Premier League |
| 7 | `07-games.png` | 6 FOOTBALL GAMES | All in one app |
| 8 | `08-home.png` | A NEW GRID EVERY DAY | New quests and rewards daily |

## B planı: ChatGPT ekranı bozarsa

Sadece **arka planı ve başlığı** ürettir, telefonu boş bırak:

```
Same style, but leave the phone screen pure flat magenta #FF00FF (empty).
Headline: "..."
```

Sonra bana ver; gerçek ekran görüntüsünü magenta alana ben yerleştiririm
(piksel kaybı olmadan).

## Yükleme

App Store Connect → Uygulama → iOS → 6.9" Display. Sürükle-bırak, sırayı yukarıdaki
gibi ayarla. 6.5" boyut artık zorunlu değil; 6.9" görselleri küçük ekranlara otomatik
ölçeklenir.
