import zxcvbn from "zxcvbn";

const MINIMUM_ZXCVBN_SCORE = 3;

export function evaluatePasswordStrength(password: string, email: string) {
  const result = zxcvbn(password, [email]);

  return {
    isStrongEnough: result.score >= MINIMUM_ZXCVBN_SCORE,
    score: result.score,
    warning: result.feedback.warning,
    suggestions: result.feedback.suggestions
  };
}
