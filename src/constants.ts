import { Category, Verdict } from './types';

// 親が選ぶ相談の種類（表示順）。
export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'money', label: 'お金の話', emoji: '💰' },
  { key: 'refund', label: '還付金・税金', emoji: '🏦' },
  { key: 'construction', label: '点検・工事・リフォーム', emoji: '🔧' },
  { key: 'impersonation', label: '家族や役所を名乗る電話', emoji: '📞' },
  { key: 'other', label: 'その他', emoji: '❓' },
];

export function categoryLabel(key: Category): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? 'その他';
}

export function categoryEmoji(key: Category): string {
  return CATEGORIES.find((c) => c.key === key)?.emoji ?? '❓';
}

// 子がタップで返信できる定型文。
export const REPLY_TEMPLATES: { verdict: Verdict; message: string }[] = [
  { verdict: 'danger', message: 'それ詐欺かも！絶対に対応しないで' },
  { verdict: 'unsure', message: '一旦電話を切って。あとでかけ直すね' },
  { verdict: 'safe', message: '大丈夫、それは本物だよ' },
];

// 判定ごとの見出し（親の答え画面で使う）。
export const VERDICT_HEADLINE: Record<Verdict, string> = {
  danger: '⚠️ 詐欺かもしれません',
  unsure: '🟡 いったん待って',
  safe: '✅ 大丈夫そうです',
};