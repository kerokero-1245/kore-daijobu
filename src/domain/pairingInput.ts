// 親の番号入力の状態遷移（数字キー・消す・つなぐ・結果の受け取り）と、「つなぐ」を押せるかの判定。
// 純関数だけを置く（React・React Native・バックエンドに依存しない）。画面はこれを使うだけにする。
//   - 6 桁そろっても自動では送らない（送るのは beginSend だけ）。
//   - 失敗しても数字は残す。ただし断られた番号は、数字を 1 つでも変えるまで送り直せない
//     （DB は失敗を毎回数えるので、同じ番号の送り直しで回数を使い切らせない）。
//   - 送れなかった（通信の失敗）ときだけ、同じ番号のまま送り直せる。
//   - まちがいが多いと断られたら、回数を数える窓の間は数字を変えても送れない（押すたびにロックが延びるため）。

import {
  ATTEMPT_WINDOW_MS,
  INVITE_CODE_LENGTH,
  type RedeemReason,
} from "./pairing";

// 送った結果。send_error は通信の失敗（DB に届いたか分からない）。
export type SendOutcome = RedeemReason | "send_error";
export type SendFailure = Exclude<SendOutcome, "ok">;

export interface PairingInputState {
  code: string;
  busy: boolean;
  // 画面に理由を出している失敗（数字を足すと消える）。
  failure: SendFailure | null;
  // 最後に断られた番号（この番号のままでは送れない）。
  rejectedCode: string | null;
  // まちがいが多いと断られたときの、送れるようになる時刻（ミリ秒）。
  lockedUntil: number | null;
}

export const initialPairingInput: PairingInputState = {
  code: "",
  busy: false,
  failure: null,
  rejectedCode: null,
  lockedUntil: null,
};

export function pressDigit(
  s: PairingInputState,
  digit: string,
): PairingInputState {
  if (s.busy || s.code.length >= INVITE_CODE_LENGTH) return s;
  if (!/^[0-9]$/.test(digit)) return s;
  return { ...s, code: s.code + digit, failure: null };
}

export function eraseDigit(s: PairingInputState): PairingInputState {
  if (s.busy || s.code.length === 0) return s;
  return { ...s, code: s.code.slice(0, -1) };
}

export function canSend(s: PairingInputState, now: number): boolean {
  if (s.busy || s.code.length !== INVITE_CODE_LENGTH) return false;
  if (s.rejectedCode !== null && s.code === s.rejectedCode) return false;
  if (s.lockedUntil !== null && now < s.lockedUntil) return false;
  return true;
}

// 「つなぐ」を押したとき。送れないときは同じ状態を返す（呼び出し側は state が変わったかで送るかを決める）。
export function beginSend(
  s: PairingInputState,
  now: number,
): PairingInputState {
  if (!canSend(s, now)) return s;
  return { ...s, busy: true, failure: null };
}

// 送った結果を受け取る。送っている間は数字を変えられないので、断られたのは今の code。
export function finishSend(
  s: PairingInputState,
  outcome: SendOutcome,
  now: number,
): PairingInputState {
  const done = { ...s, busy: false };
  switch (outcome) {
    case "ok":
      return { ...done, failure: null };
    case "send_error":
      return { ...done, failure: outcome };
    case "too_many_attempts":
      return {
        ...done,
        failure: outcome,
        lockedUntil: now + ATTEMPT_WINDOW_MS,
      };
    case "invalid":
    case "used":
    case "expired":
    case "not_parent":
    case "already_paired":
      return { ...done, failure: outcome, rejectedCode: s.code };
  }
}
