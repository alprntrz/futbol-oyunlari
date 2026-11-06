# Arapça arayüz sözlüğü (ar, Suudi hedefli Modern Standart Arapça)

Kaynak: `src/lib/strings-ar.ts`, `src/lib/names-ar.ts`. Makine/model çevirisidir; yayından önce anadili Suudi konuşan biri okumalıdır (aşağıdaki liste ilk bakılacaklar).

## Kurallar

- Rakamlar Batı rakamı (0-9). Marka adları Latin: Tiktako, Tiktako Plus, XP, Google, Apple, Wikidata.
- Cinsiyetsiz hitap: emir kipi (erkek biçimi Arapçada genel biçimdir), geçmiş zaman 2. tekil (فزت, خسرت: yazıda eril/dişil aynı), isim cümlesi. "تعال" yerine "هيا".
- Sayı + isim yok: "النقاط: {n}", "الأيام: {n}", "{n} من اللاعبين". Arapça çoğul (1, 2, 3-10, 11+) bu yüzden kalıpla çözüldü.
- Noktalama: ، ؟ ; "…" ve ASCII iki nokta korunur. Ok: "←" (RTL'de sonraki adım sola gider).
- Oyun adları mağaza (ar-SA, `mobile/store.config.json`) ile aynı.

## Oyun ve ürün adları

| Terim | Arapça | Not |
|---|---|---|
| Tiktako / Tiktako Plus | Tiktako / Tiktako Plus | Latin kalır. Mağaza metninde "تيكتاكو بلس" geçiyor; uygulamada Latin (talimat). |
| Missing 11 | التشكيلة الناقصة | mağaza ile aynı |
| Daily XI | التشكيلة اليومية | |
| Tic-Tac-Toe | إكس-أو | mağaza ile aynı |
| Pitch Chess | شطرنج الملعب | mağaza ile aynı |
| Rondo | روندو | |
| Who Am I? | من أنا؟ | |
| Card Duel | مبارزة البطاقات | |
| Two-Club Duel | مبارزة النادِيين | yeni ad, mağazada yok |
| Football Quiz | مسابقة كرة القدم | |
| Mystery Player | اللاعب الغامض | |
| Football Bingo | بينغو كرة القدم | |
| Possession Play | لعبة الاستحواذ | kısa: الاستحواذ |
| Dribbling Rush | سباق المراوغة | mağazada yok; yargı kararı |
| Kombine | كومباين | rafa kalkmış oyun, ses aktarımı |

## Terimler

| Terim | Arapça | Not |
|---|---|---|
| match | مباراة | |
| goal | هدف | |
| lineup / starting XI | التشكيلة (الأساسية) | |
| goalkeeper / defender / midfielder / forward | حارس مرمى / مدافع / لاعب وسط / مهاجم | dar etiketlerde: حارس، دفاع، وسط، هجوم |
| bench | الدكة | "دكة البدلاء" yerine kısa |
| synergy | التناغم | mağaza metni ile aynı |
| hex (Possession) | خلية | mağazada "ملعب سداسي" |
| gold (oyun parası) | ذهب | |
| gold / silver / bronze | ذهبي / فضي / برونزي | |
| XP | XP | Latin |
| level | مستوى | |
| rank | رتبة | liderlik sırası için "ترتيب" |
| league (haftalık) | الدوري | rütbe isimleri: الدوري البرونزي ... |
| streak | سلسلة | mağaza ile aynı |
| trophy | كأس (ج. كؤوس) | |
| badge | شارة | |
| nickname | الاسم المستعار | |
| avatar | الصورة الرمزية | |
| lobby | غرفة الانتظار | |
| room code | كود الغرفة | "كود" Körfez kullanımında yaygın |
| joker (jokers) | المساعدات | Bingo'daki "wildcard" ise جوكر |
| reroll | تحديث | |
| scout | الكشّاف | |
| player (footballer) | لاعب | |
| opponent | المنافس | |
| friends / friend code | الأصدقاء / كود صداقتك | |
| draw | تعادل | |
| forfeit | انسحاب | |
| online | أونلاين | metinde tek biçim: أونلاين |

## Futbol terimi karşılıkları

| İngilizce | Arapça | Not |
|---|---|---|
| Park the bus | ركن الحافلة | |
| Gegenpress | الضغط العكسي | |
| Long ball | الكرات الطويلة | |
| Catenaccio | الكاتيناتشو | |
| Joga Bonito | جوجا بونيتو | |
| Total football | الكرة الشاملة | |
| Golden boot | الحذاء الذهبي | |
| Man of the match | أفضل لاعب | "رجل المباراة" cinsiyetli olduğu için |
| Penalties | ركلات الترجيح | |
| Ballon d'Or | الكرة الذهبية | |
| Euros | أمم أوروبا / اليورو | kısa etiketlerde اليورو |
| Saudi Pro League | دوري روشن السعودي | |

## Kulüp ve ülke adları (names-ar.ts)

Suudi/Mısır medyasının kullandığı biçimler. İkili durum: Al-Ahli (Suudi) = الأهلي, Al Ahly (Mısır) = الأهلي المصري (ikisi aynı ekranda çıkabildiği için ayrıldı). Diğer: بايرن ميونخ، باريس سان جيرمان، فنربخشة، بشكتاش، غلطة سراي، إنتر، آيندهوفن.

`AR_LABELS` içindeki derbi ve lig maçı adları `"<derbi> · <müsabaka>"` kalıbında; dosya bunları iki küçük sözlükten üretir (`DERBIES` x `DERBY_COMPETITIONS`). Dinamik etiketler (`Played with {name}`, `Managed by {name}`) anahtarlanamaz; Arapçası yok, İngilizce görünür (bkz. rapor).

## Anadili okurun önce bakacağı anahtarlar

### 1. Hukuki ve mağaza hassas (anlam birebir korunmalı)
- `plusLegal` (yenileme, mağaza hesabından tahsilat, iptal, ömür boyu tek ödeme)
- `plusTerms`, `plusAfterTrial`, `plusTrial`, `plusPerMonth`, `plusFair`
- `deleteDataAsk`, `deleteDataDesc`, `deleteDataOffline`, `deleteAccount`, `deleteAccountDesc`, `deleteAccountFailed` (kalıcı silme, geri alınamaz)
- `privacyOptions` (reklam gizliliği/rıza), `adWatch`, `adUnavailable`, `capBody`, `streakLostBody`, `giftDoubleBody`
- `signInPrivacy`, `friendsPrivacy`, `settingsAnalytics`, `settingsAnalyticsNote`, `settingsPushNote`, `settingsRemindersNote`
- `pmBlockBody`, `pmReported`, `errBody` (anonim hata raporu vaadi)
- `photoNote` (fotoğraf telefonda kalır vaadi)

### 2. Futbol terimi, emin olmadıklarım
- `ttkA_gegenpress` "الضغط العكسي": Körfez medyası "الجيجن بريس" da yazıyor.
- `ttkRule*`, `ttkTour4`, `ttkTraits`: "التناغم" (synergy). Mağaza ile uyumlu ama oyuncu dili "الكيمياء" da olabilir (`ttkClubTrait` bunu kullanıyor).
- `ppClaimed`, `ppNeighbours`, `ppTagline`: "خلية" (hex). Alternatif: "مربع سداسي".
- `lg_sapphire` / `lg_ruby`: "الياقوت الأزرق/الأحمر". Daha doğal bir lig adı çifti olabilir.
- `ttkMiss` "خارج المرمى", `ttkSave` "تصدٍّ", `ttkFullTime` "النهاية", `ttkKickoff` "صافرة البداية".
- `ttkStyle_*` (Joga Bonito, Catenaccio, Tiki-taka, "الروح القتالية" vs. "Grit"): ülke tarzı etiketleri.
- `rushHow*` "مقصورات البدلاء" (dugout), "جزّازة العشب" (mower), `rushSplash` "رشّة ماء!".
- `dzTheme_ucl` "الفائزون بدوري أبطال أوروبا فقط".
- `jk*` ve `jkRule*`: "jokers" için "المساعدات" seçtim ("الجوكر" Bingo'daki wildcard için kaldı).
- `ttkPos_*` dar etiketler: حارس / دفاع / وسط / هجوم.

### 3. Yargı kararı verdiğim yerler
- `ttWins` "فاز": özneye bağlı fiil, ekranda ad ile birlikte nasıl durduğuna bakılmalı.
- `solved`, `found`, `resultFound`, `htAnswersCount`, `bbPlayers`, `bingoUsed`, `bingoScore`, `qzGames`, `qzPoints`, `qzSummary`: İngilizce sayıdan sonra gelen birim kelimeleri. Arapçada sayıyla uyum bozulabilir; sayı kutusunun yeri ekranda kontrol edilmeli.
- `wmQ_*`: soru kalıpları (`wmQ_league` = "هل لعب مع نادٍ من {x}؟"; {x} lig adı).
- `lgCardSub`, `lgWentUp/Down/Stayed`: `{place}` Arapçada düz sayı gelir ("المركز 3"), `ordinal()` bunu veriyor.
- `qXiPlayers`, `qHtWin`, `qQzCorrect`, `plusTrial`, `plusAfterTrial`, `lgRule`, `rdFirstTo`, `rdBestOfN`: çoğul sorunu "{n} من ..." kalıbıyla çözüldü, biraz kitabi durabilir.
- `remStreak`: bildirim, "حافظ على سلسلتك (الأيام: {n})!" kalıbı resmi duruyor; daha doğal bir söyleyiş olabilir.
- Kısa düğmeler: `ttSubmit` "ضع", `keyboardEnter` "إدخال", `keyboardDelete` "حذف".
- `failedSlot` "أخطأت", `rushOver` "خطأ!" (Foul): hakem faulü, "مخالفة!" daha doğru olabilir.
- `rank_*`: هاوٍ، الأكاديمية، بديل، الفريق الأول، القائد، نجم، أسطورة.
- `badge_streak30` "اللاعب الحديدي" (Iron man), `badge_dailyDuel7` "نجم اليوم" (Man of the day).
- Erkek biçimli emirler (اكتب، اضغط، العب) cinsiyet-nötr kabul edildi.
- `qzPoints` "نقاط" (pts) ve `resultW/L/D` ف / خ / ت: dar etiketler.

### 4. Bilinçli olarak yapılmayanlar
- RTL yerleşim, yazı tipi (Barlow Condensed Arapça içermez), Doğu Arap rakamı, tarih biçimi: koda ait, bu metin dosyasında değil.
- Gerçek çoğul formu (zero/one/two/few/many/other) yok; kalıp seçimiyle çözüldü.
