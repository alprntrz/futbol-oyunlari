"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "tr" | "en";

const dict = {
  tr: {
    appName: "Futbol Oyunları",
    missingXI: "Eksik 11",
    missingXITagline: "Tarihi maçların ilk 11'ini tahmin et",
    daily: "Günün Kadrosu",
    practice: "Pratik",
    turkishTeams: "Türk Takımları",
    noMatches: "Bu koleksiyonda henüz maç yok.",
    onlineRace: "Online Yarış",
    howToPlay: "Nasıl oynanır?",
    howToPlayText:
      "Sahadaki her forma, o maçta ilk 11'de çıkan bir futbolcu. Formaya tıkla ve oyuncunun adını harf harf tahmin et — her tahminden sonra kutular ipucu verir.",
    hintCorrect: "Harf doğru yerde",
    hintPresent: "Harf var ama yanlış yerde",
    hintAbsent: "Harf isimde yok",
    normal: "Normal",
    hard: "Zor",
    normalDesc: "Oyuncu başına 6 tahmin, 3 hatadan sonra ilk harf ipucu",
    hardDesc: "Oyuncu başına 4 tahmin, ipucu yok",
    guess: "Tahmin Et",
    giveUp: "Pes Et",
    solved: "bildin",
    won: "Tebrikler! 11'in tamamını bildin!",
    lost: "Oyun bitti. Kadro aşağıda.",
    totalGuesses: "Toplam tahmin",
    share: "Sonucu Paylaş",
    copied: "Kopyalandı!",
    playAgain: "Tekrar Oyna",
    newMatch: "Yeni Maç",
    stats: "İstatistikler",
    played: "Oyun",
    winRate: "Kazanma %",
    streak: "Seri",
    bestStreak: "En İyi Seri",
    close: "Kapat",
    createRoom: "Oda Kur",
    joinRoom: "Odaya Katıl",
    roomCode: "ODA KODU",
    yourName: "Takma adın",
    waiting: "Rakip bekleniyor…",
    start: "Başlat",
    opponent: "Rakip",
    you: "Sen",
    raceDesc: "Aynı kadroyu rakibinden önce çöz!",
    raceWin: "Yarışı kazandın! 🏆",
    raceLose: "Rakibin daha hızlıydı.",
    raceTie: "Berabere!",
    roomNotFound: "Oda bulunamadı",
    roomFull: "Oda dolu",
    connectionLost: "Bağlantı koptu",
    soon: "Yakında",
    tikiTakaSoon: "Tiki Taka Toe — yakında!",
    versus: "vs",
    guessThe: "kadrosunu bil",
    failedSlot: "Bilemedin",
    keyboardEnter: "GİR",
    keyboardDelete: "SİL",
    tikiTakaName: "Tiki Taka Toe",
    tikiTakaTagline: "Sırayla, iki kriteri de sağlayan futbolcuyu yaz — 3'ü yan yana getir!",
    ttTurn: "Sıra",
    ttWins: "kazandı!",
    ttDraw: "Berabere!",
    ttNewGrid: "Yeni Izgara",
    ttHint: "Boş kareye tıkla, satır ve sütun kriterini sağlayan bir futbolcu yaz. Her oyuncu bir kez kullanılır; yanlış tahminde sıra rakibe geçer.",
    ttYourGuess: "tahminin",
    ttPlaceholder: "Futbolcu adı…",
    ttSubmit: "Yerleştir",
    ttWrong: "Olmadı — sıra rakibe geçti",
    ttTimeout: "süre doldu — sıra rakibe geçti",
    ttNoResult: "Eşleşen oyuncu yok",
    twoPlayers: "İki oyuncu · aynı cihaz",
  },
  en: {
    appName: "Football Games",
    missingXI: "Missing 11",
    missingXITagline: "Guess the starting XI of historic matches",
    daily: "Daily XI",
    practice: "Practice",
    turkishTeams: "Turkish Teams",
    noMatches: "No matches in this collection yet.",
    onlineRace: "Online Race",
    howToPlay: "How to play",
    howToPlayText:
      "Every shirt on the pitch is a player who started that match. Tap a shirt and guess the player's name letter by letter — tiles give feedback after each guess.",
    hintCorrect: "Letter in the correct spot",
    hintPresent: "Letter in the name but wrong spot",
    hintAbsent: "Letter not in the name",
    normal: "Normal",
    hard: "Hard",
    normalDesc: "6 guesses per player, first-letter hint after 3 misses",
    hardDesc: "4 guesses per player, no hints",
    guess: "Guess",
    giveUp: "Give up",
    solved: "solved",
    won: "Congrats! You completed the XI!",
    lost: "Game over. Full lineup below.",
    totalGuesses: "Total guesses",
    share: "Share result",
    copied: "Copied!",
    playAgain: "Play again",
    newMatch: "New match",
    stats: "Statistics",
    played: "Played",
    winRate: "Win %",
    streak: "Streak",
    bestStreak: "Best streak",
    close: "Close",
    createRoom: "Create Room",
    joinRoom: "Join Room",
    roomCode: "ROOM CODE",
    yourName: "Your nickname",
    waiting: "Waiting for opponent…",
    start: "Start",
    opponent: "Opponent",
    you: "You",
    raceDesc: "Solve the same XI before your opponent!",
    raceWin: "You won the race! 🏆",
    raceLose: "Your opponent was faster.",
    raceTie: "It's a tie!",
    roomNotFound: "Room not found",
    roomFull: "Room is full",
    connectionLost: "Connection lost",
    soon: "Coming soon",
    tikiTakaSoon: "Tiki Taka Toe — coming soon!",
    versus: "vs",
    guessThe: "guess the XI",
    failedSlot: "Missed",
    keyboardEnter: "ENTER",
    keyboardDelete: "DEL",
    tikiTakaName: "Tiki Taka Toe",
    tikiTakaTagline: "Take turns naming a player who fits both criteria — get 3 in a row!",
    ttTurn: "Turn",
    ttWins: "wins!",
    ttDraw: "Draw!",
    ttNewGrid: "New Grid",
    ttHint: "Tap an empty square and name a player matching the row and column. Each player is used once; a wrong guess passes the turn.",
    ttYourGuess: "your guess",
    ttPlaceholder: "Player name…",
    ttSubmit: "Place",
    ttWrong: "Nope — turn passed",
    ttTimeout: "time's up — turn passed",
    ttNoResult: "No matching player",
    twoPlayers: "Two players · same device",
  },
} as const;

export type TKey = keyof (typeof dict)["tr"];

const I18nContext = createContext<{
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
}>({ locale: "tr", t: (k) => k, setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "tr" || saved === "en") setLocaleState(saved);
    else if (!navigator.language.startsWith("tr")) setLocaleState("en");
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  const t = (k: TKey) => dict[locale][k];

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
