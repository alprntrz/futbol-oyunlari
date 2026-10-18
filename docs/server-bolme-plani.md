# server.js bölme planı

Kaynak: graphify kod haritası (`graphify-out/`, 2026-10-18). `server.js` 2.318 satır; haritada en zayıf
bağlı grup ("Game server core", 79 düğüm, bütünlük 0.028). İçinde altı online oyun, Eksik 11 yarışı,
Live Activity, emoji, şikayet/engel, yeniden bağlanma ve eşleştirme bir arada. Oyunlar birbirine bağlı
değil; onları birbirine bağlayan sadece aşağıdaki ortak altyapı.

Hedef: davranış ve socket olay adları **hiç değişmeden** (eski uygulamalar çalışmaya devam etmeli) her
oyunu kendi dosyasına taşımak. Pitch Chess (`server-taktik.js`), hesaplar, şikayet ve sağlık zaten ayrı;
aynı kalıbı izliyoruz.

## 1. Bugün ne nerede

| Bölüm | Modül düzeyi (yardımcılar, sabitler) | Bağlantı içi (handler'lar) |
|---|---|---|
| Eksik 11 yarışı (`room:*`, `race:*`, sadece web) | `rooms`, `publicRoom`, `makeCode` | ~160 satır |
| Tic-Tac-Toe (`ht:*`) | `htPublic`, `htSeries`, `htJokers`, `htTally`, `htTurnMs`, `htCode`, `htGridOk`, `canDraw` | ~275 satır |
| Quiz (`qz:*`) + seviye/sıralama dosyası | `qzPublic`, `qzValidQuestions`, `qzSettings`, `qzStats`, `qzLevel`, `qzNick` | ~250 satır |
| Possession (`pp:*`) | `ppPublic`, `ppNewRoom`, `ppResult`, `PP_NEIGHBOURS`, `ppBoardOk` | ~150 satır |
| Kart Düellosu (`dz:*`) | `DZ_CARDS`, `dzQuestions`, `dzJudge`, `dzPublic`, `dzHandOk` | ~215 satır |
| Rondo (`rd:*`) | `rdPublic`, `rdNewRoom`, `RD` (rondo.ts yükleyici) | ~165 satır |
| Ben Kimim? (`wm:*`) | `wmPublic`, `wmNewRoom`, `WM` (whoami.ts yükleyici) | ~150 satır |
| Live Activity (`la:*`, `app:state`) | `liveSend`, `liveHt`, `livePp`, `liveDz`, `liveStrings` | ~30 satır |

## 2. Paylaşılması gereken ortak parçalar

Haritada birden çok oyun grubuna bağlanan düğümler bunlar; hepsi tek bir yerde kalmalı.

**Saf yardımcılar** → `server-core.js` (bağımlılığı yok, test edilebilir):
- Takma ad: `cleanNick`, `NICK_BLOCK`, ev sahibi adı `qzNick` (Quiz, Pitch Chess ve odalar kullanıyor).
- Eşleştirme: `cleanTier`, `tierGap`, `TIER_WIDEN_MS`, `takePairs`.
- Oda kodu: tek bir `codeFor(map)` (bugün aynı işi yapan 6 kopya var: `htCode`, `ppCode`, `dzCode`,
  `rdCode`, `wmCode`, `makeCode`; haritada "Room codes" grubu).
- Doğrulama: `critId`, `nameOf`, `cleanLook` (zaten accounts'ta).
- Kimlik: `refById`, `seatRef`, `seatNick`, `blockedPair`.
- Puan: `rateDuel`, `tellElo` (`recordResult` sarmalayıcısı).
- Süreler: `REJOIN_MS`, `INTRO_MS` (bugün `HT_INTRO_MS` adıyla Rondo, Ben Kimim ve Possession da kullanıyor).

**Bağlantı altyapısı** → `server.js`'de kalır ama oyunları bilmeden çalışır:
- Korumalı `socket.on` (boş payload, ack, 5 sn'de 60 olay sınırı).
- `dropLater` / `awayTimers` / `awayData` (kopan bağlantıyı 60 sn bekletme).
- `welcomeBack` (yeniden bağlanan telefona koltuğunu geri verme).
- `dropLoneRoom`, oda süpürücüsü (dakikada bir), `matchQueues` (saniyede bir).
- Şikayet/engel (`rep:send`, `blk:set`), arkadaş daveti (`fr:invite`), emoji (`em:send`), Live Activity
  (`la:token`, `app:state`).

Bugün bu altyapının **her biri oyunları adıyla sayıyor** (`views = { ht, pp, dz, rd, wm }`, süpürücüdeki
harita listesi, `matchQueues`'daki beş blok, emojide ve davette `game === "ht" ? … : …` zincirleri,
hayalet bağlantıda `old.data.htCode = … = null`). Yeni bir oyun eklemek bu yüzden 8 ayrı yeri değiştirmeyi
gerektiriyor; Rondo ve Ben Kimim'de bunu yaşadık.

## 3. Hedef yapı: oyun kaydı (registry)

Her oyun dosyası tek bir nesne verir; altyapı bu listeyi döner:

```js
// server-games/wm.js
module.exports = {
  id: "wm",
  rooms,                       // Map<code, room>
  queue: () => wmQueue,        // eşleştirme kuyruğu (yoksa null)
  setQueue: (q) => (wmQueue = q),
  view: wmPublic,              // yeniden bağlanma ve güncelleme için oda görünümü
  live: (room) => !!room.started && !room.winner && room.players.length === 2,  // dropLater için
  inviteOpen: (room) => room.started === false,                                  // fr:invite için
  liveActivity: null,          // varsa liveHt gibi APNs güncellemesi
  attach(socket, ctx) { /* wm:create, wm:join, wm:ask … ve disconnect */ },
};
```

`ctx` altyapının oyunlara verdiği şeyler: `io`, `dropLater`, `dropLoneRoom`, `matchQueues`,
`rateDuel`, `tellElo`, `codeFor`, `cleanNick`, `cleanLook`, `cleanTier`, `seatRef`, `seatNick`, `INTRO_MS`.

Böylece `welcomeBack`, süpürücü, `matchQueues`, emoji, davet ve Live Activity `for (const g of GAMES)`
olur; yeni bir oyun sadece kendi dosyası ve listeye bir satır demek.

Ayrıca iki kişilik sıra tabanlı oyunların (Tic-Tac-Toe, Possession, Rondo, Ben Kimim) neredeyse aynı
olan `create / join / start / queue / unqueue / pair / drop / emit / joinRoom` kısmı ortak bir
`duelRoomKit(id, { newRoom, view, … })` yardımcısına alınabilir. Bu ikinci aşama; önce taşıma.

Dosyalar: `server-core.js`, `server-games/{race,ht,qz,pp,dz,rd,wm}.js`, `server-live.js`'e
`liveHt/livePp/liveDz` taşınır. `server.js` sadece HTTP + Next, Socket.IO kurulumu, altyapı ve kayıt
listesi kalır (tahmini 450–550 satır).

## 4. Sıra (her adım ayrı commit + deploy, davranış değişmeden)

0. **Güvenlik ağı:** Bugün elle yazdığım socket test betiklerini (yeniden bağlanma, koltuk devralma,
   engelli eşleşme, Rondo, Ben Kimim, jokerler, Elo) `tests/server.int.test.mts` olarak `npm test`'e
   ekle: sunucuyu boş bir portta ve geçici veri klasörüyle açıp iki istemciyle oynar. Her adımdan sonra
   bunlar geçmeli.
1. `server-core.js`: saf yardımcıları taşı, `codeFor` ile 6 kod üreticisini birleştir.
2. Kayıt + altyapıyı oyun-bağımsız yap (`views`, süpürücü, `matchQueues`, emoji, davet, hayalet
   bağlantı listesi `GAMES`'ten okusun). Oyun kodu hâlâ `server.js`'de.
3. Pilot: **Ben Kimim?** (en yeni, en temiz) `server-games/wm.js`'e. Testler + canlıda duman testi.
4. Rondo → Possession → Kart Düellosu → Tic-Tac-Toe (Live Activity ve jokerlerle en büyüğü) → Quiz
   (seviye dosyası ve ev oyuncuları) → Eksik 11 yarışı.
5. İsteğe bağlı: `duelRoomKit` ile dört sıra tabanlı oyunun ortak iskeletini birleştir.
6. CLAUDE.md ve README'yi güncelle; graphify haritasını `--update` ile yenile ve bütünlüğü karşılaştır.

## 5. Riskler ve önlemler

- **Kapanış (closure) durumu:** Handler'lar bugün aynı `socket` kapanışını paylaşıyor (`socket.data.*Code`,
  `qzLeave`). Taşırken her oyun `attach(socket, ctx)` içinde kendi kapanışını kurar; paylaşılan tek şey
  `socket.data`.
- **`disconnect` sırası:** Her oyun kendi `disconnect` dinleyicisini ekliyor; sıra önemli değil ama
  `refById` temizliği en sonda kalmalı (bugünkü gibi `REJOIN_MS + 5 sn` gecikmeli).
- **Eski uygulamalar:** Olay adları, payload biçimleri ve `caps` kontrolleri birebir aynı kalmalı.
  Testler eski istemci gibi de bağlanacak (caps, pid, rk olmadan).
- **Deploy sırasında düşen maçlar:** Her adım bir deploy, canlı maçlar düşer; adımları az oyuncunun
  olduğu saatlere koy ve "bakım" uyarısı mevcut değil, bunu bilerek ilerle.
- **Live Activity:** `la:token` oyun koduna göre doğru odayı bulmalı; Tic-Tac-Toe adımında elle bir
  telefonla doğrulanmalı (simülatörde APNs yok).

## 6. Kazanç

- Yeni online oyun: 8 yer yerine 1 dosya + 1 satır.
- Her oyun dosyası 250–400 satır, tek başına okunur ve test edilir.
- Haritada "Game server core" grubu dağılır; her oyun kendi grubunda yüksek bütünlükle görünür.
