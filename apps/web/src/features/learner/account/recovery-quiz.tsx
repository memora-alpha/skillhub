"use client";
import { useId, useState } from "react";
import styles from "./reputation-recovery.module.css";
export type RecoveryQuizData = {
  version: string;
  policy: string[];
  questions: string[];
};
export function RecoveryQuiz({
  quiz,
  disabled,
  pending,
  onSubmit,
}: Readonly<{
  quiz: RecoveryQuizData;
  disabled: boolean;
  pending: boolean;
  onSubmit: (body: { version: string; answers: boolean[] }) => void;
}>) {
  const id = useId();
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const count = Object.keys(answers).length;
  const complete = quiz.questions.length > 0 && count === quiz.questions.length;
  return (
    <section
      id="recovery-quiz"
      className={styles.quiz}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.quizHeader}>
        <div>
          <h3 id={`${id}-title`}>Cùng hiểu lại quy tắc cộng đồng</h3>
          <p>
            Chọn Đúng hoặc Sai cho mỗi câu. Đạt ít nhất{" "}
            {Math.ceil(quiz.questions.length * 0.8)}/{quiz.questions.length} câu
            để hoàn thành.
          </p>
        </div>
        <span className={styles.counter} aria-live="polite">
          Đã chọn {count}/{quiz.questions.length}
        </span>
      </div>
      <form
        className={styles.quizForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !complete) return;
          onSubmit({
            version: quiz.version,
            answers: quiz.questions.map((_, index) => answers[index]!),
          });
        }}
      >
        {quiz.questions.map((question, index) => (
          <fieldset
            className={styles.question}
            key={question}
            disabled={disabled}
          >
            <legend>
              <span className={styles.number}>{index + 1}</span>
              {question}
            </legend>
            <div className={styles.options}>
              {([true, false] as const).map((value) => (
                <label key={String(value)} className={styles.option}>
                  <input
                    type="radio"
                    name={`${id}-answer-${index}`}
                    value={String(value)}
                    required
                    checked={answers[index] === value}
                    onChange={() =>
                      setAnswers((current) => ({ ...current, [index]: value }))
                    }
                  />
                  <span>{value ? "Đúng" : "Sai"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className={styles.quizFooter}>
          <p>
            {complete
              ? "Bạn đã trả lời đủ. Sẵn sàng kiểm tra kết quả!"
              : "Trả lời đủ các câu để nộp bài."}
          </p>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={disabled || !complete}
          >
            {pending ? "Đang kiểm tra…" : "Nộp bài kiểm tra"}
          </button>
        </div>
      </form>
    </section>
  );
}
