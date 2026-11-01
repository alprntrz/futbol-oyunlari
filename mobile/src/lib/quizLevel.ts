import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import type { QuizDifficulty } from "@/lib/quiz";

const KEY = "qz-difficulty";

/** The quiz level this phone last picked (random rooms and new friend rooms). */
export function useQuizDifficulty() {
  const [level, setLevel] = useState<QuizDifficulty>("normal");
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === "easy" || v === "normal" || v === "hard") && setLevel(v))
      .catch(() => {});
  }, []);
  const choose = (v: QuizDifficulty) => {
    setLevel(v);
    AsyncStorage.setItem(KEY, v).catch(() => {});
  };
  return [level, choose] as const;
}
