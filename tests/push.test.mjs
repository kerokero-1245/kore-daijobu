// プッシュ通知のアプリ側の手順（src/data/pushRegistration.ts）を固定するテスト。
// 守るもの:
//   - 許可が無ければトークンを保存しない。未許可なら 1 回だけ尋ね、granted なら 1 回保存する
//   - EAS の projectId が無ければ警告を 1 回出し、保存しない
//   - Expo Go・Web・シミュレータでは何もしない（canRegisterPush。expo-notifications にも触れない）
//   - Android はチャンネル（送る側の channelId と同じ名前）を先に作る
//   - 途中で取り消されたら保存しない（つなぎ直しの後に前の利用者で保存しない）
//   - 押された通知の data から相談の id を取り、親は答えの画面・子は詳細を開く。最後の通知は 1 回だけ読む
//   - Web 版（pushTokens.ts）と iOS / Android 版（pushTokens.native.ts）の書き出しの名前が同じ
//     （App.tsx の型検査は Web 版の型でしか通らないため）
// expo-notifications・expo-device・expo-constants は偽物を渡す（実機・Expo には接続しない）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const {
  openLastResponse,
  openResponse,
  projectIdFrom,
  registerPushTokenWith,
  routeForResponse,
} = await import("../src/data/pushRegistration.ts");
const { PUSH_CHANNEL_ID, PUSH_DATA_KEY, canRegisterPush } =
  await import("../src/domain/push.ts");
const { createOnce } = await import("../src/domain/once.ts");

const CID = "50000000-0000-4000-8000-000000000001";
const DEVICE = {
  os: "ios",
  isDevice: true,
  appOwnership: null,
  executionEnvironment: "storeClient",
};

// expo-notifications の偽物。呼ばれた順を calls に残す。
function fakeNotifications({ current = "granted", answer = "granted" } = {}) {
  const calls = [];
  return {
    calls,
    api: {
      async getPermissionsAsync() {
        calls.push(["getPermissionsAsync"]);
        return { status: current };
      },
      async requestPermissionsAsync() {
        calls.push(["requestPermissionsAsync"]);
        return { status: answer };
      },
      async setNotificationChannelAsync(id, channel) {
        calls.push(["setNotificationChannelAsync", id, channel]);
        return null;
      },
      async getExpoPushTokenAsync(options) {
        calls.push(["getExpoPushTokenAsync", options]);
        return { type: "expo", data: "ExponentPushToken[abc]" };
      },
    },
  };
}

function fakeBackend() {
  const saved = [];
  return {
    saved,
    backend: {
      async upsertPushToken(token) {
        saved.push(token);
      },
    },
  };
}

function run(opts = {}) {
  const n = fakeNotifications(opts);
  const b = fakeBackend();
  const warnings = [];
  const deps = {
    notifications: n.api,
    env: opts.env ?? DEVICE,
    maxImportance: 5,
    projectId: "projectId" in opts ? opts.projectId : "eas-project",
    warnNoProjectId: opts.warn ?? (() => warnings.push("no projectId")),
    isCancelled: opts.isCancelled,
  };
  return {
    n,
    b,
    warnings,
    promise: registerPushTokenWith(deps, b.backend),
  };
}

describe("トークンの登録", () => {
  test("許可済みなら尋ねずに 1 回保存する", async () => {
    const { n, b, promise } = run();
    assert.equal(await promise, "saved");
    assert.deepEqual(b.saved, ["ExponentPushToken[abc]"]);
    assert.deepEqual(n.calls, [
      ["getPermissionsAsync"],
      ["getExpoPushTokenAsync", { projectId: "eas-project" }],
    ]);
  });

  test("未許可なら 1 回尋ね、granted なら 1 回保存する", async () => {
    const { n, b, promise } = run({ current: "undetermined" });
    assert.equal(await promise, "saved");
    assert.equal(
      n.calls.filter(([c]) => c === "requestPermissionsAsync").length,
      1,
    );
    assert.deepEqual(b.saved, ["ExponentPushToken[abc]"]);
  });

  test("尋ねても許可されなければ、トークンを取らず保存しない", async () => {
    for (const answer of ["denied", "undetermined"]) {
      const { n, b, promise } = run({ current: "denied", answer });
      assert.equal(await promise, "denied");
      assert.deepEqual(b.saved, []);
      assert.ok(!n.calls.some(([c]) => c === "getExpoPushTokenAsync"));
    }
  });

  test("projectId が無ければ警告を 1 回出し、トークンを取らず保存しない", async () => {
    const { n, b, warnings, promise } = run({ projectId: null });
    assert.equal(await promise, "no_project");
    assert.deepEqual(warnings, ["no projectId"]);
    assert.deepEqual(b.saved, []);
    assert.ok(!n.calls.some(([c]) => c === "getExpoPushTokenAsync"));
    // 呼ぶ側（pushTokens.native.ts）は createOnce で包むので、起動を重ねても警告は 1 回。
    const once = createOnce();
    const shown = [];
    const warn = () => once.run(() => shown.push("no projectId"));
    await run({ projectId: null, warn }).promise;
    await run({ projectId: null, warn }).promise;
    assert.deepEqual(shown, ["no projectId"]);
  });

  test("Expo Go・Web・シミュレータでは何もしない（expo-notifications にも触れない）", async () => {
    for (const env of [
      { ...DEVICE, appOwnership: "expo" },
      { ...DEVICE, os: "web" },
      { ...DEVICE, isDevice: false },
    ]) {
      assert.equal(canRegisterPush(env), false);
      const { n, b, warnings, promise } = run({ env });
      assert.equal(await promise, "unsupported");
      assert.deepEqual(n.calls, []);
      assert.deepEqual(b.saved, []);
      assert.deepEqual(warnings, []);
    }
  });

  test("Android は送る側と同じ名前のチャンネルを、許可を尋ねる前に作る", async () => {
    const { n, promise } = run({
      env: { ...DEVICE, os: "android" },
      current: "undetermined",
    });
    assert.equal(await promise, "saved");
    assert.equal(PUSH_CHANNEL_ID, "default");
    assert.deepEqual(n.calls[0], [
      "setNotificationChannelAsync",
      PUSH_CHANNEL_ID,
      { name: "相談と返事", importance: 5 },
    ]);
    assert.equal(n.calls[1][0], "getPermissionsAsync");
  });

  test("途中で取り消されたら保存しない", async () => {
    let cancelled = false;
    const n = fakeNotifications();
    const b = fakeBackend();
    const getToken = n.api.getExpoPushTokenAsync;
    n.api.getExpoPushTokenAsync = async (o) => {
      const r = await getToken(o);
      cancelled = true; // トークンを取っている間につなぎ直しが走った
      return r;
    };
    const r = await registerPushTokenWith(
      {
        notifications: n.api,
        env: DEVICE,
        maxImportance: 5,
        projectId: "eas-project",
        warnNoProjectId: () => {},
        isCancelled: () => cancelled,
      },
      b.backend,
    );
    assert.equal(r, "cancelled");
    assert.deepEqual(b.saved, []);
  });

  test("projectId は extra.eas.projectId、無ければ easConfig.projectId", () => {
    assert.equal(projectIdFrom({ eas: { projectId: "a" } }, "b"), "a");
    assert.equal(projectIdFrom({ eas: { projectId: "" } }, "b"), "b");
    assert.equal(projectIdFrom(undefined, "b"), "b");
    assert.equal(projectIdFrom({ eas: null }, undefined), null);
    assert.equal(projectIdFrom("x", 1), null);
  });
});

describe("押された通知", () => {
  const response = (data) => ({
    notification: { request: { content: { data } } },
  });

  test("data から id を取り、親は答えの画面・子は相談の詳細を開く", () => {
    const r = response({ [PUSH_DATA_KEY]: CID });
    assert.deepEqual(routeForResponse("parent", r), {
      name: "ParentStatus",
      params: { consultationId: CID },
    });
    assert.deepEqual(routeForResponse("child", r), {
      name: "ConsultationDetail",
      params: { consultationId: CID },
    });
  });

  test("id の無い通知は開かない", () => {
    const opened = [];
    for (const data of [
      undefined,
      {},
      { [PUSH_DATA_KEY]: 1 },
      { [PUSH_DATA_KEY]: "" },
    ])
      openResponse("parent", response(data), (route) => opened.push(route));
    assert.deepEqual(opened, []);
  });

  test("最後に押された通知は 1 回だけ読んで開き、読んだら消す", () => {
    let last = response({ [PUSH_DATA_KEY]: CID });
    const api = {
      getLastNotificationResponse: () => last,
      clearLastNotificationResponse: () => {
        last = null;
      },
    };
    const opened = [];
    openLastResponse(api, "child", (route) => opened.push(route));
    openLastResponse(api, "child", (route) => opened.push(route));
    assert.deepEqual(opened, [
      { name: "ConsultationDetail", params: { consultationId: CID } },
    ]);
  });
});

describe("Web 版と iOS / Android 版", () => {
  // export の名前を拾う（function・const・型）。
  function exportsOf(file) {
    const src = readFileSync(
      new URL(`../src/data/${file}`, import.meta.url),
      "utf8",
    );
    const names = [
      ...src.matchAll(
        /^export\s+(?:async\s+)?(?:function|const|let|class|interface|type)\s+([A-Za-z0-9_$]+)/gm,
      ),
    ].map((m) => m[1]);
    return names.sort();
  }

  test("書き出しの名前が同じ（0 件なら失敗）", () => {
    const web = exportsOf("pushTokens.ts");
    const native = exportsOf("pushTokens.native.ts");
    assert.ok(web.length > 0, "Web 版の export が 0 件");
    assert.deepEqual(native, web);
    assert.deepEqual(web, ["registerPushToken", "usePushNotifications"]);
  });
});
