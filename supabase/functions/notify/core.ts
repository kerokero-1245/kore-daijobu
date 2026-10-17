// 通知の Edge Function の中身。相談が届いたら子へ、返事が届いたら親へ、Expo Push で知らせる。
// Deno にも Node にも依存しない。外との出入り（fetch・時計・待ち・DB）は全部 NotifyDeps で受ける。
// Deno の入口は index.ts（秘密の環境変数と service role の client を作って、ここに渡すだけ）。
// テストは tests/notify.test.mjs（fetch と DB を差し替えて、送り先・再試行・無効化を確かめる）。
//
// 流れ: DB Webhook の POST（{ type, table, schema, record, old_record }）
//   → 秘密のヘッダを確かめる（違えば 401）
//   → consultations の INSERT なら宛先は子、UPDATE で waiting → answered になったら宛先は親
//   → 宛先の有効なトークン（disabled_at が null）へ送り、ticket を push_log に 1 件ずつ記録
//   → DeviceNotRegistered のトークンは disabled_at を埋め、以後は送らない
//   → 送らなかったとき（ペア・宛先・トークンが無い）も、理由を push_log に 1 行残す
// プッシュは届かないこともある補助の経路で、正本は DB（画面は Realtime と起動時の取り直しで追いつく）。

// 種類の名前・アプリ名・data の名前・チャンネルは、同じフォルダの shared.ts
// （`npm run gen:notify` がアプリの正本から作る写し）から読む。
// Deno のデプロイが functions の外を束ねる保証が無いので、このフォルダの外は import しない。
import {
  APP_NAME,
  CATEGORY_META,
  PUSH_CHANNEL_ID,
  PUSH_DATA_KEY,
} from "./shared.ts";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Webhook に付ける秘密のヘッダの名前（値は環境変数 NOTIFY_WEBHOOK_SECRET と同じにする）。
export const SECRET_HEADER = "x-notify-secret";
// 通信失敗・429・5xx のときの再試行の回数（最初の 1 回とは別）。間は 1 秒・2 秒・4 秒と広げる。
export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 1000;
// Expo が 1 回の送信で受ける件数の上限。
export const MAX_MESSAGES_PER_REQUEST = 100;
// Expo への 1 回の送信を待つ上限。応答が無いまま Function が基盤の上限まで待たないように切る
// （切れたら通信失敗として再試行する）。
export const FETCH_TIMEOUT_MS = 5000;

// ---- 外との出入り ----

export interface HttpResponseLike {
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<HttpResponseLike>;

export interface PairParties {
  parentId: string | null;
  childId: string;
}

// push_log の 1 行（列名は supabase/migrations/20261016000000_init.sql と同じ）。
// status は Expo が受けたら ok、送れなかったら error、送らなかったら null（error に理由）。
export interface PushLogRow {
  event: string;
  ticket_id: string | null;
  status: "ok" | "error" | null;
  error: string | null;
}

export interface NotifyDeps {
  fetch: FetchLike;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  // pairs の行から親と子の uid を引く（無ければ null）。
  getPairParties(pairId: string): Promise<PairParties | null>;
  // その人の有効なトークン（disabled_at が null）。
  listActiveTokens(userId: string): Promise<string[]>;
  // トークンを無効にする（disabled_at を埋める）。
  disableTokens(tokens: string[], disabledAt: string): Promise<void>;
  writePushLog(rows: PushLogRow[]): Promise<void>;
  // Expo の access token（EAS で送信に access token を求める設定にしたとき。MVP では任意）。
  expoAccessToken?: string;
}

// ---- Webhook の読み取り ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type Recipient = "parent" | "child";

export interface NotifyEvent {
  event: string; // push_log の event 列（例: consultation_created:<id>）
  consultationId: string;
  pairId: string;
  recipient: Recipient;
  title: string;
  body: string;
}

function categoryLabelOf(v: unknown): string {
  const known =
    typeof v === "string" &&
    Object.prototype.hasOwnProperty.call(CATEGORY_META, v);
  return known
    ? CATEGORY_META[v as keyof typeof CATEGORY_META].label
    : CATEGORY_META.other.label;
}

// 通知する出来事を Webhook の payload から決める。知らせるものでなければ null。
// 本文は「相談・気づきの補助」の立ち位置に合わせ、危ない・安全などの断定の語を使わない。
export function eventFromPayload(payload: unknown): NotifyEvent | null {
  if (!isRecord(payload) || payload.table !== "consultations") return null;
  const record = payload.record;
  if (!isRecord(record)) return null;
  const id = record.id;
  const pairId = record.pair_id;
  if (typeof id !== "string" || typeof pairId !== "string") return null;

  if (payload.type === "INSERT") {
    return {
      event: `consultation_created:${id}`,
      consultationId: id,
      pairId,
      recipient: "child",
      title: APP_NAME,
      body: `親から相談：${categoryLabelOf(record.category)}`,
    };
  }
  // 返事は返信の挿入トリガーが status を answered にする UPDATE で知る。
  // 親が答えを開いた印（parent_seen_at）の UPDATE では送らない（前の status が waiting のときだけ）。
  const old = payload.old_record;
  if (
    payload.type === "UPDATE" &&
    record.status === "answered" &&
    isRecord(old) &&
    old.status === "waiting"
  ) {
    return {
      event: `reply_arrived:${id}`,
      consultationId: id,
      pairId,
      recipient: "parent",
      title: APP_NAME,
      body: "返事が届きました",
    };
  }
  return null;
}

// 宛先の uid を pairs の行から決める。
export function recipientId(
  parties: PairParties,
  recipient: Recipient,
): string | null {
  return recipient === "child" ? parties.childId : parties.parentId;
}

// ---- 送信 ----

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  // Android の既定は normal で、Doze 中の端末では届くのが遅れる。電話の最中の相談なので high にする。
  priority: "high";
  // Android のチャンネル（アプリが作るものと同じ名前）。
  channelId: string;
}

export function buildMessages(tokens: string[], e: NotifyEvent): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: e.title,
    body: e.body,
    data: { [PUSH_DATA_KEY]: e.consultationId },
    sound: "default",
    priority: "high",
    channelId: PUSH_CHANNEL_ID,
  }));
}

type SendOutcome =
  { ok: true; tickets: unknown[] } | { ok: false; error: string };

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function errorOfResponse(res: HttpResponseLike): Promise<string> {
  const head = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    const first =
      isRecord(body) && Array.isArray(body.errors) ? body.errors[0] : null;
    const code = isRecord(first) ? first.code : null;
    return typeof code === "string" ? `${head} ${code}` : head;
  } catch {
    return head;
  }
}

// 1 回分（最大 100 件）を送る。通信失敗・時間切れ・429・5xx は間を広げて MAX_RETRIES 回まで再試行し、
// それ以外の失敗（400 など、送り方の誤り）は再試行しない。
// 2xx で応答が読めないときも再試行しない（Expo は受けているかもしれず、送り直すと二重に届く）。
export async function sendBatch(
  deps: NotifyDeps,
  messages: ExpoMessage[],
): Promise<SendOutcome> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (deps.expoAccessToken)
    headers.authorization = `Bearer ${deps.expoAccessToken}`;
  const body = JSON.stringify(messages);

  for (let attempt = 0; ; attempt++) {
    let error: string;
    let retryable: boolean;
    try {
      const res = await deps.fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status >= 200 && res.status < 300) {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          return { ok: false, error: "応答が読めません" };
        }
        const tickets =
          isRecord(json) && Array.isArray(json.data) ? json.data : null;
        return tickets
          ? { ok: true, tickets }
          : { ok: false, error: "応答が読めません" };
      }
      error = await errorOfResponse(res);
      retryable = isRetryableStatus(res.status);
    } catch (e) {
      error = `通信失敗: ${e instanceof Error ? e.message : String(e)}`;
      retryable = true;
    }
    if (!retryable || attempt >= MAX_RETRIES) return { ok: false, error };
    await deps.sleep(BASE_DELAY_MS * 2 ** attempt);
  }
}

// ticket 1 件を push_log の行にし、DeviceNotRegistered かどうかを返す。
// ok は Expo が受けた印で、端末に届いた印ではない（届いたかは後の receipt で分かる。MVP では見ない）。
function readTicket(
  ticket: unknown,
  event: string,
): { row: PushLogRow; unregistered: boolean } {
  if (isRecord(ticket) && ticket.status === "ok") {
    const id = typeof ticket.id === "string" ? ticket.id : null;
    return {
      row: { event, ticket_id: id, status: "ok", error: null },
      unregistered: false,
    };
  }
  const details = isRecord(ticket) ? ticket.details : null;
  const code = isRecord(details) ? details.error : null;
  const message = isRecord(ticket) ? ticket.message : null;
  const error =
    typeof code === "string"
      ? code
      : typeof message === "string"
        ? message
        : "ticket が読めません";
  return {
    row: { event, ticket_id: null, status: "error", error },
    unregistered: code === "DeviceNotRegistered",
  };
}

type SkipReason = "no_pair" | "no_recipient" | "no_tokens";

export interface NotifyResult {
  event: string | null;
  sent: number; // Expo が受けた件数（ticket が ok）
  failed: number;
  disabled: number; // 無効にしたトークンの数
  skipped?: "ignored" | SkipReason;
}

const NOTHING: NotifyResult = { event: null, sent: 0, failed: 0, disabled: 0 };

// 送らなかった理由を push_log に 1 行残す（「トークンが保存されていない」と「Webhook が来ていない」を
// push_log だけで見分けられるように）。知らせる出来事でないもの（ignored）は残さない。
async function skip(
  deps: NotifyDeps,
  event: string,
  reason: SkipReason,
): Promise<NotifyResult> {
  await deps.writePushLog([
    { event, ticket_id: null, status: null, error: reason },
  ]);
  return { ...NOTHING, event, skipped: reason };
}

export async function notify(
  deps: NotifyDeps,
  payload: unknown,
): Promise<NotifyResult> {
  const e = eventFromPayload(payload);
  if (!e) return { ...NOTHING, skipped: "ignored" };
  const parties = await deps.getPairParties(e.pairId);
  if (!parties) return skip(deps, e.event, "no_pair");
  const uid = recipientId(parties, e.recipient);
  if (!uid) return skip(deps, e.event, "no_recipient");
  const tokens = await deps.listActiveTokens(uid);
  if (tokens.length === 0) return skip(deps, e.event, "no_tokens");

  const rows: PushLogRow[] = [];
  const unregistered: string[] = [];
  const messages = buildMessages(tokens, e);
  for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
    const outcome = await sendBatch(deps, batch);
    batch.forEach((m, j) => {
      if (!outcome.ok) {
        rows.push({
          event: e.event,
          ticket_id: null,
          status: "error",
          error: outcome.error,
        });
        return;
      }
      // ticket は送った順に並ぶ。
      const t = readTicket(outcome.tickets[j], e.event);
      rows.push(t.row);
      if (t.unregistered) unregistered.push(m.to);
    });
  }

  // 無効化が失敗しても、Expo が受けた ticket の記録は残す（両方を試み、失敗はそのあとで投げる）。
  let disableError: unknown = null;
  if (unregistered.length > 0) {
    try {
      await deps.disableTokens(
        unregistered,
        new Date(deps.now()).toISOString(),
      );
    } catch (err) {
      disableError = err;
    }
  }
  await deps.writePushLog(rows);
  if (disableError !== null) throw disableError;
  return {
    event: e.event,
    sent: rows.filter((r) => r.status === "ok").length,
    failed: rows.filter((r) => r.status === "error").length,
    disabled: unregistered.length,
  };
}

// ---- 入口の判定 ----

// 秘密のヘッダが環境変数と一致するか。秘密が未設定なら誰も通さない。
// 長さが同じなら最後まで比べる（一致した文字数で時間が変わらないように）。
export function isAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || header === null || header.length !== secret.length)
    return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++)
    diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export interface WebhookRequest {
  secretHeader: string | null;
  secret: string | undefined;
  bodyText: string;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

// 入口（index.ts）が呼ぶ。秘密を確かめてから deps を作る（違えば DB にも Expo にも触れない）。
export async function handleWebhook(
  req: WebhookRequest,
  makeDeps: () => NotifyDeps,
): Promise<WebhookResponse> {
  if (!isAuthorized(req.secretHeader, req.secret))
    return { status: 401, body: { error: "unauthorized" } };
  let payload: unknown;
  try {
    payload = JSON.parse(req.bodyText);
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  try {
    const result = await notify(makeDeps(), payload);
    return { status: 200, body: { ...result } };
  } catch (e) {
    return {
      status: 500,
      body: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
