# Körfez web testi: yayın sayfası

Suudi Arabistan'da Arapça arayüz ve Suudi Ligi gridi ilgi görüyor mu, sorusunu reklamla ölçer.
Kod: `npm run build:web` → `out/`. Hesap açma, harcama, deploy ve reklam başlatma kullanıcıdadır.

## Yayından önce

1. Metni anadil konuşan birine okut: site, `src/app/privacy/page.web.tsx`, aşağıdaki reklam metinleri.
2. PostHog'da ayrı proje aç. "Discard client IP data" açık olsun, GeoIP kapalı kalsın.
3. Cloudflare hesabı aç. Alan adı al (`tiktako.com` ve `tiktako.app` kayıtlı; `tiktako.net` ve `tiktako.gg` RDAP'ta 404 verdi, kayıt ekranında doğrula).
4. Transfermarkt kaynaklı verinin reklamlı açık sitede durmasına karar ver (2026-10-19 kabulü uygulama içindi).
5. Derle ve yayınla:

```bash
NEXT_PUBLIC_POSTHOG_KEY=<proje_anahtarı> npm run build:web
```

```bash
npx wrangler pages deploy out --project-name tiktako-web
```

6. Telefonla aç: bir oyun oyna, PostHog'da `landing_view` ve `game_finish` olaylarını gör. Görmeden reklam başlatma.
7. `site/privacy.html` değişikliğinin `main`'e girdiğini kontrol et.

## Kampanya

- Ülke: yalnız Suudi Arabistan. Dil: Arapça. Yaş: 18–34. Cihaz: mobil.
- Aşama 1: $300, 7 gün. Snapchat $150, TikTok $150 (reklam grubu günlük $20'nin üstünde).
- Aşama 2: yalnız aşama 1 geçerse, iyi kanala +$300.
- Piksel yok. Hedef: trafik / tıklama. Bu yüzden trafik kalitesi optimize edilmez.
- Görsel: yalnız oyunun ekran kaydı. Kupa, arma, oyuncu fotoğrafı, FIFA / World Cup / AFC ifadesi kullanma.
- Kulüp veya oyuncu adını reklam başlığında onay ima edecek biçimde kullanma.

Linkler (`ALAN_ADI` yerine gerçek adresi koy):

| Reklam | Link |
|---|---|
| Snapchat, metin A | `https://ALAN_ADI/?utm_source=snap&utm_medium=paid&utm_campaign=sa1&utm_content=a` |
| Snapchat, metin B | `https://ALAN_ADI/?utm_source=snap&utm_medium=paid&utm_campaign=sa1&utm_content=b` |
| TikTok, metin A | `https://ALAN_ADI/?utm_source=tiktok&utm_medium=paid&utm_campaign=sa1&utm_content=a` |
| TikTok, metin B | `https://ALAN_ADI/?utm_source=tiktok&utm_medium=paid&utm_campaign=sa1&utm_content=b` |

Reklam metinleri (taslak, anadil kontrolü gerekli):

- A: `كم لاعبًا تعرف من الدوري السعودي؟ جرّب شبكة اليوم في 3 دقائق.`
- B: `تظن نفسك تعرف الكرة السعودية؟ املأ الشبكة قبل انتهاء الوقت.`
- Buton: `العب الآن`

## Eşikler

Harcamadan önce kilitli. Sektör verisi değil, proje önerisidir.

| Metrik | Hesap | Geçer | Kalır |
|---|---|---|---|
| Gelen ziyaretçi başı maliyet | harcama / `landing_view` | ≤ $0,80 | > $1,50 |
| Gelen → ilk tahmin | `first_guess` / `landing_view` | ≥ %40 | < %20 |
| Başlayan → bitiren | `game_finish` / `game_start` | ≥ %50 | < %25 |
| Ertesi gün dönüş | `days_since_first = 1` olan `game_start` / önceki günün yeni oyuncuları | ≥ %10 | < %4 |
| Bitiren → mağaza | `store_click` / `game_finish` (Android hariç) | ≥ %10 | < %3 |
| Arapça aramada sonuçsuz | `search` `found=false` / `search`, `arabic=true` | ≤ %15 | > %30 |

- Geçti: başlama, bitirme ve dönüş üçü de geçer.
- Kaldı: başlama veya dönüş kalır.
- Arada: kreatifi bir kez değiştir, $300 daha harca.
- Sonuçsuz arama kalırsa sorun pazar değil, isim verisidir.
- Erken durdur: $100 harcanmışken ziyaretçi başı maliyet $2'yi geçerse.

Maliyet varsayımı ($0,50 tıklama) doğrulanmadı; ilk gün gerçek rakamla düzelt.

## Sınırlar

- Kurulum, uygulama içi tutunma ve gelir ölçülmez.
- `days_since_first` tarayıcı başınadır: site verisi silinirse kişi yeni sayılır.
- Ülke verisi yoktur; kampanya hedefi ve `time_zone` ile okunur.
- App Store linki şu an Arapçasız uygulamaya gider. Mağaza tıklaması yalnız niyet gösterir.
