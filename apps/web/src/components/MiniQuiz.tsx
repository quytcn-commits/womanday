"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { quizQuestions, type QuizQuestion } from "@/lib/quizData";
import { apiFetch } from "@/lib/api";

interface MegaphoneBalance {
  megaphoneSmall: number;
  megaphoneBig: number;
}

interface AnswerResult {
  isCorrect: boolean;
  megaphoneSmall: number;
  megaphoneBig: number;
  newBigMegaphone?: boolean;
  alreadyAnswered?: boolean;
}

export default function MiniQuiz() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [answeredResults, setAnsweredResults] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [balance, setBalance] = useState<MegaphoneBalance>({ megaphoneSmall: 0, megaphoneBig: 0 });
  const [reward, setReward] = useState<"small" | "big" | null>(null);

  // Load progress from server, fallback to localStorage
  useEffect(() => {
    async function loadFromServer() {
      try {
        const { answers } = await apiFetch<{ answers: { questionId: number; isCorrect: boolean }[] }>("/api/v1/quiz/answers");
        if (answers && answers.length > 0) {
          const answeredSet = new Set(answers.map((a) => a.questionId));
          const resultsMap: Record<number, boolean> = {};
          let correct = 0;
          answers.forEach((a) => {
            resultsMap[a.questionId] = a.isCorrect;
            if (a.isCorrect) correct++;
          });
          setAnswered(answeredSet);
          setAnsweredResults(resultsMap);
          setCorrectCount(correct);

          // Find first unanswered question
          const nextIdx = quizQuestions.findIndex((q) => !answeredSet.has(q.id));
          if (nextIdx === -1) {
            setFinished(true);
          } else {
            setCurrentIdx(nextIdx);
          }
        }
      } catch {
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem("quiz_progress");
          if (saved) {
            const data = JSON.parse(saved);
            if (data.answered) setAnswered(new Set(data.answered));
            if (typeof data.correctCount === "number") setCorrectCount(data.correctCount);
            if (typeof data.currentIdx === "number") setCurrentIdx(data.currentIdx);
            if (data.finished) setFinished(true);
          }
        } catch {}
      }
    }

    async function loadBalance() {
      try {
        const b = await apiFetch<MegaphoneBalance>("/api/v1/quiz/balance");
        setBalance(b);
      } catch {}
    }

    loadFromServer();
    loadBalance();
  }, []);

  // Save progress to localStorage as backup
  useEffect(() => {
    localStorage.setItem(
      "quiz_progress",
      JSON.stringify({ answered: [...answered], correctCount, currentIdx, finished })
    );
  }, [answered, correctCount, currentIdx, finished]);

  const question = quizQuestions[currentIdx];
  if (!question && !finished) return null;

  async function handleSelect(optionIdx: number) {
    if (selected !== null) return;
    setSelected(optionIdx);

    let isCorrect = optionIdx === question.correctIndex;
    let gotReward: "small" | "big" | null = null;

    // Submit to server
    try {
      const result = await apiFetch<AnswerResult>("/api/v1/quiz/answer", {
        method: "POST",
        body: JSON.stringify({ questionId: question.id, selectedIndex: optionIdx }),
      });
      isCorrect = result.isCorrect;
      setBalance({ megaphoneSmall: result.megaphoneSmall, megaphoneBig: result.megaphoneBig });

      if (result.isCorrect && !result.alreadyAnswered) {
        gotReward = result.newBigMegaphone ? "big" : "small";
      }
    } catch {
      // Fallback: use client-side check
    }

    if (isCorrect) setCorrectCount((c) => c + 1);
    setAnswered((prev) => new Set([...prev, question.id]));
    setAnsweredResults((prev) => ({ ...prev, [question.id]: isCorrect }));

    // Show reward animation
    if (gotReward) {
      setReward(gotReward);
      setTimeout(() => setReward(null), 2500);
    }

    // Auto advance after 2s
    setTimeout(() => {
      const nextIdx = quizQuestions.findIndex((q, i) => i > currentIdx && !answered.has(q.id) && q.id !== question.id);
      if (nextIdx !== -1) {
        setCurrentIdx(nextIdx);
        setSelected(null);
      } else if (currentIdx < quizQuestions.length - 1 && !answered.has(quizQuestions[currentIdx + 1]?.id)) {
        setCurrentIdx((i) => i + 1);
        setSelected(null);
      } else {
        setFinished(true);
      }
    }, 2000);
  }

  function handleReset() {
    setCurrentIdx(0);
    setSelected(null);
    setCorrectCount(0);
    setAnswered(new Set());
    setAnsweredResults({});
    setFinished(false);
    localStorage.removeItem("quiz_progress");
  }

  if (finished) {
    return (
      <div className="glass p-4 text-center">
        {/* Balance header */}
        <MegaphoneBalanceBar balance={balance} />
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-brand-deep font-bold text-sm">Hoàn thành Quiz!</p>
        <p className="text-brand-hot font-black text-xl mt-1">
          {correctCount}/{quizQuestions.length}
        </p>
        <p className="text-brand-deep/40 text-xs mt-1 font-light">câu trả lời đúng</p>
        {correctCount > 0 && (
          <p className="text-brand-gold text-xs mt-2 font-medium">
            Bạn đã nhận được loa để chat nổi bật!
          </p>
        )}
        <button
          onClick={handleReset}
          className="mt-3 text-brand-hot text-xs font-semibold hover:text-brand-hot/70 transition-colors"
        >
          Chơi lại
        </button>
      </div>
    );
  }

  return (
    <div className="glass p-4 relative overflow-hidden">
      {/* Balance header */}
      <MegaphoneBalanceBar balance={balance} />

      <div className="flex items-center justify-between mb-3">
        <p className="text-brand-deep/50 text-xs font-light uppercase tracking-widest">
          Mini Quiz 8/3
        </p>
        <span className="text-brand-deep/30 text-[10px] font-light">
          {currentIdx + 1}/{quizQuestions.length}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-3">
        {quizQuestions.map((q, i) => {
          const isAnswered = answered.has(q.id);
          const wasCorrect = answeredResults[q.id];
          return (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                background: isAnswered
                  ? wasCorrect
                    ? "rgba(34,197,94,0.5)"
                    : "rgba(239,68,68,0.3)"
                  : i === currentIdx
                  ? "rgba(232,96,122,0.9)"
                  : "rgba(139,58,80,0.08)",
              }}
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-brand-deep font-semibold text-sm mb-3 leading-relaxed">
            {question.question}
          </p>

          <div className="space-y-2">
            {question.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === question.correctIndex;
              const showResult = selected !== null;

              let bg = "rgba(139,58,80,0.04)";
              let border = "rgba(139,58,80,0.08)";
              let textColor = "#8B3A50";

              if (showResult) {
                if (isCorrect) {
                  bg = "rgba(34,197,94,0.1)";
                  border = "rgba(34,197,94,0.3)";
                  textColor = "#16a34a";
                } else if (isSelected && !isCorrect) {
                  bg = "rgba(239,68,68,0.1)";
                  border = "rgba(239,68,68,0.3)";
                  textColor = "#dc2626";
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={selected !== null}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:cursor-default"
                  style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
                >
                  <span className="font-bold mr-2 opacity-40">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {selected !== null && question.explanation && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-brand-deep/50 text-xs mt-3 font-light leading-relaxed px-1"
            >
              💡 {question.explanation}
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Reward toast */}
      <AnimatePresence>
        {reward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div
              className="px-6 py-4 rounded-2xl text-center"
              style={{
                background: reward === "big"
                  ? "linear-gradient(135deg, #D4AF37 0%, #C4977A 100%)"
                  : "linear-gradient(135deg, #E8749A 0%, #C4977A 100%)",
                boxShadow: "0 8px 32px rgba(196,151,122,0.4)",
              }}
            >
              <div className="text-3xl mb-1">{reward === "big" ? "📣" : "📢"}</div>
              <p className="text-white font-bold text-sm">
                {reward === "big" ? "+1 Loa Lon!" : "+1 Loa Nho!"}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                {reward === "big" ? "3 loa nho → 1 loa lon!" : "Dung de chat noi bat!"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MegaphoneBalanceBar({ balance }: { balance: MegaphoneBalance }) {
  if (balance.megaphoneSmall === 0 && balance.megaphoneBig === 0) return null;
  return (
    <div className="flex items-center justify-center gap-3 mb-3 py-1.5 px-3 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
      {balance.megaphoneSmall > 0 && (
        <span className="text-xs font-semibold text-brand-gold flex items-center gap-1">
          📢 x{balance.megaphoneSmall}
        </span>
      )}
      {balance.megaphoneBig > 0 && (
        <span className="text-xs font-semibold text-brand-gold flex items-center gap-1">
          📣 x{balance.megaphoneBig}
        </span>
      )}
      <span className="text-brand-deep/30 text-[10px] font-light">Loa chat</span>
    </div>
  );
}
