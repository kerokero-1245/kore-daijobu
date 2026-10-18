// 親の番号入力の状態遷移（数字キー・消す・消すの長押し・つなぐ・結果の受け取り）と、「つなぐ」を押せるかの判定。
// 純関数だけを置く（React・React Native・バックエンドに依存しない）。画面はこれを使うだけにする。
//   - 6 桁そろっても自動では送らない（送るのは beginSend だけ）。
//   - 失敗しても数字は残す。ただし断られた番号は、数字を 1 つでも変えるまで送り直せない
//     （DB は失敗を毎回数えるので、同じ番号の送り直しで回数を使い切らせない）。
//   - 送れなかった（通信の失敗）ときだけ、同じ番号のまま送り直せる。
//   - まちがいが多いと断られたら、回数を数える窓の間は数字を変えても送れない（押すたびにロックが延びるため）。
//   - 「つなぐ」は押せるままにする。送れない状態で押したら送らずに理由を出す（sendBlockMessage）。
//     理由は数字を足す・消すと消える（子の返信の「送る」と同じ作法）。

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
  // 送れない状態で「つなぐ」を押した（理由を出す。数字を足す・消すと消える）。
  tried: boolean;
}

// 「つなぐ」で送れない理由（canSend の判定を分けたもの）。
//   busy … 送っている間 / locked … まちがいが多くて待つ窓の間 / short … 6 桁そろっていない /
//   rejected … 断られた番号のまま
// 待つ窓の間は数字をそろえても送れないので、6 桁そろっていないより先に出す。
export type SendBlock = "busy" | "locked" | "short" | "rejected";

export const initialPairingInput: PairingInputState = {
  code: "",
  busy: false,
  failure: null,
  rejectedCode: null,
  lockedUntil: null,
  tried: false,
};

export function pressDigit(
  s: PairingInputState,
  digit: string,
): PairingInputState {
  if (s.busy || s.code.length >= INVITE_CODE_LENGTH) return s;
  if (!/^[0-9]$/.test(digit)) return s;
  return { ...s, code: s.code + digit, failure: null, tried: false };
}

export function eraseDigit(s: PairingInputState): PairingInputState {
  if (s.busy || s.code.length === 0) return s;
  return { ...s, code: s.code.slice(0, -1), tried: false };
}

// 「消す」の長押し。数字を全部消す（期限切れ・使用済みのあとに 6 回押さずに打ち直せるように）。
// 失敗しても数字を残す決定は変えない（これは利用者が明示に選ぶ操作）。理由の文は eraseDigit と同じく残す。
export function eraseAll(s: PairingInputState): PairingInputState {
  if (s.busy || s.code.length === 0) return s;
  return { ...s, code: "", tried: false };
}

export function sendBlock(s: PairingInputState, now: number): SendBlock | null {
  if (s.busy) return "busy";
  if (s.lockedUntil !== null && now < s.lockedUntil) return "locked";
  if (s.code.length !== INVITE_CODE_LENGTH) return "short";
  if (s.rejectedCode !== null && s.code === s.rejectedCode) return "rejected";
  return null;
}

export function canSend(s: PairingInputState, now: number): boolean {
  return sendBlock(s, now) === null;
}

// 送れない状態で「つなぐ」を押したあとに出す理由の 1 文。押す前・送れる状態・送っている間は null。
// 押したあとで状態が変われば（待つ窓が明けたなど）、そのときの理由に替わる。
export function sendBlockMessage(
  s: PairingInputState,
  now: number,
): string | null {
  if (!s.tried) return null;
  switch (sendBlock(s, now)) {
    case null:
    case "busy":
      return null;
    case "locked":
      return "まちがいが多かったので、いまは送れません。しばらく待ってから「つなぐ」を押してください。";
    case "short": {
      const rest = INVITE_CODE_LENGTH - s.code.length;
      return s.code.length === 0
        ? `番号がまだ入っていません。${INVITE_CODE_LENGTH} 桁入れて「つなぐ」を押してください。`
        : `あと ${rest} 桁です。${INVITE_CODE_LENGTH} 桁入れて「つなぐ」を押してください。`;
    }
    case "rejected":
      return "この番号のままでは送れません。数字を直してから「つなぐ」を押してください。";
  }
}

// 「つなぐ」を押したとき。送れるときは busy にする（呼び出し側は busy になったかで送るかを決める）。
// 送れないときは送らずに理由を出す印（tried）を付ける。送っている間は同じ状態を返す。
export function beginSend(
  s: PairingInputState,
  now: number,
): PairingInputState {
  if (s.busy) return s;
  if (!canSend(s, now)) return s.tried ? s : { ...s, tried: true };
  return { ...s, busy: true, failure: null, tried: false };
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
