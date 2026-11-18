import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import type { Recovery } from "../api/recovery-api";
import { reputationStyles as styles } from "./reputation.styles";

export function RecoveryQuiz({
  quiz,
  answers,
  disabled,
  onAnswer,
  onSubmit,
}: Readonly<{
  quiz: NonNullable<Recovery["quiz"]>;
  answers: Record<number, boolean>;
  disabled: boolean;
  onAnswer: (index: number, answer: boolean) => void;
  onSubmit: () => void;
}>) {
  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <Text style={styles.label}>Nguyên tắc cộng đồng</Text>
        {quiz.policy.map((rule, index) => (
          <Text key={`${index}:${rule}`} style={styles.meta}>
            {index + 1}. {rule}
          </Text>
        ))}
      </View>
      {quiz.questions.map((question, index) => (
        <View
          key={`${quiz.version}:${index}`}
          style={[styles.section, styles.separator]}
        >
          <Text style={styles.label}>
            {index + 1}. {question}
          </Text>
          <View style={styles.answers}>
            {[true, false].map((answer) => (
              <Button
                key={String(answer)}
                variant={answers[index] === answer ? "craft" : "paper"}
                style={styles.answer}
                disabled={disabled}
                accessibilityLabel={`Câu ${index + 1}: ${answer ? "Đúng" : "Sai"}`}
                accessibilityState={{ selected: answers[index] === answer }}
                onPress={() => onAnswer(index, answer)}
              >
                {answer ? "Đúng" : "Sai"}
              </Button>
            ))}
          </View>
        </View>
      ))}
      <Button
        variant="craft"
        disabled={
          disabled ||
          quiz.questions.some((_, index) => answers[index] === undefined)
        }
        onPress={onSubmit}
      >
        Gửi bài kiểm tra
      </Button>
    </View>
  );
}
