// 親子のペアリング（役割・招待コード・引き換えの結果）の規則と文言。
// 純関数とデータだけを置く（React・React Native・バックエンドに依存しない）。

export type Role = "parent" | "child";
export type PairStatus = "pending" | "active";

// 自分のペア（自分の役割はペアの中の位置で決まる）。
export interface PairInfo {
  pairId: string;
  role: Role;
  status: PairStatus;
}

// 招待の引き換えの結果。DB の関数 redeem_invite が返す reason と同じ値。
export type RedeemReason =
  | "ok"
  | "too_many_attempts"
  | "invalid"
  | "expired"
  | "used"
  | "not_parent"
  | "already_paired";

// 招待コードは数字 6 桁。期限は発行から 10 分。失敗が 10 分で 5 回に達したら断る。
export const INVITE_CODE_LENGTH = 6;
export const INVITE_TTL_MS = 10 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

// 子が親を待つ間に読み直す間隔。番号の期限を過ぎたら、その番号ではつながらないので間隔を延ばす
// （止めはしない。端末の時計のずれと、購読の取りこぼしに備える）。新しい番号を出すと 5 秒に戻る。
export const WAIT_POLL_MS = 5000;
export const WAIT_POLL_SLOW_MS = 60 * 1000;

export function waitPollDelay(now: number, expiresAt: number | null): number {
  return expiresAt !== null && now >= expiresAt
    ? WAIT_POLL_SLOW_MS
    : WAIT_POLL_MS;
}

export function isInviteCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code);
}

// 起動時の画面の分かれ目。
export type SessionStatus =
  "choose_role" | "child_unpaired" | "parent_unpaired" | "paired";

export function sessionStatusOf(
  role: Role | null,
  pair: PairInfo | null,
): SessionStatus {
  if (pair && pair.status === "active") return "paired";
  if (role === "child") return "child_unpaired";
  if (role === "parent") return "parent_unpaired";
  return "choose_role";
}

// 残り時間を「9:05」の形に（負なら 0:00）。
export function formatRemaining(expiresAt: number, now: number): string {
  const sec = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// 引き換えに失敗した理由を、親の画面に出す平易な 1 文に。
const REDEEM_MESSAGE: Record<Exclude<RedeemReason, "ok">, string> = {
  expired: "番号の期限が切れています。子のスマホで新しい番号を出してください。",
  used: "この番号はもう使われています。子のスマホで新しい番号を出してください。",
  invalid: "番号がちがいます。もう一度入れてください。",
  too_many_attempts:
    "まちがいが多いので、10分ほど待ってから、もう一度入れてください。",
  not_parent:
    "このスマホは親のスマホになっていません。アプリを一度終了してから開き直して、「親のスマホ」を選び直してください。",
  already_paired: "このスマホは、もうつながっています。",
};

export function redeemMessage(reason: Exclude<RedeemReason, "ok">): string {
  return REDEEM_MESSAGE[reason];
}

// 断られたあとに、自分のペアを 1 回読み直すか。used・already_paired は、前に送った番号が DB では
// 引き換え済み（応答だけが失われた）でも返る。読み直してつながっていれば、親のホームへ進める。
export function recheckAfterRedeem(reason: RedeemReason): boolean {
  return reason === "used" || reason === "already_paired";
}

const REASONS: Record<RedeemReason, true> = {
  ok: true,
  too_many_attempts: true,
  invalid: true,
  expired: true,
  used: true,
  not_parent: true,
  already_paired: true,
};

// 外から来た値を RedeemReason に絞る。知らない値は invalid に寄せる。
function isRedeemReason(v: unknown): v is RedeemReason {
  return (
    typeof v === "string" && Object.prototype.hasOwnProperty.call(REASONS, v)
  );
}

export function toRedeemReason(v: unknown): RedeemReason {
  return isRedeemReason(v) ? v : "invalid";
}
