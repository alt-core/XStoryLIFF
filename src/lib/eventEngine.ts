import { app, parseUserStatus, updateUserStatus } from "./app.svelte.ts";
import { requestLines, sendText } from "./api.ts";
import { loadGlyphs } from "./fontLoader.ts";
import imageLoader from "./imageLoader.ts";
import { withBase } from "./project.ts";
import type { Command } from "./types.ts";
import { requireString, toNumber } from "./values.ts";
import { withLaunchParams } from "./xstorybot.ts";

/**
 * コマンドのハンドラー。台本に書かれた任意の引数を受け取るため、引数の型は各ハンドラー側で絞る。
 * Promise を返すと、エンジンはその完了を待ってから次のコマンドへ進む（利用者の操作を待つコマンドは、操作を終えた時に解決する）。
 * 例外を投げるか Promise が失敗すると、台本を止める。
 */
export type CommandHandler = (...args: any[]) => unknown;

export interface EngineState {
  commandQueue: Command[];
  isExecuting: boolean;
  messageVisible: boolean;
  currentMessage: unknown;
  initialCommandsExecuted: boolean;
  imagesLoaded: boolean;
  fontsLoaded: boolean;
  /** 表示できる状態か（表示前に実行するコマンドを終え、画像と書体を読み込んだ） */
  isReady: boolean;
  /** 利用者が台詞を送るのを待っている */
  waitingForUserInteraction: boolean;
}

/** on で受け取れるイベントと、渡される値 */
export interface EngineEvents {
  /** 状態が変わった（登録した時にも、今の状態で一度呼ぶ） */
  stateChange: EngineState;
  /** 表示できる状態になった */
  ready: EngineState;
  beforeCommandExecute: { command: Command; action: string; args: unknown[] };
  commandExecuted: { command: Command; action: string; args: unknown[]; result: unknown; success: true };
  commandError: { command: Command; action: string; args: unknown[]; error: unknown };
  /** 不具合で台本を止めた */
  halt: { command: Command; error: unknown };
}

type Listener<K extends keyof EngineEvents> = (data: EngineEvents[K]) => void;
type ListenerMap = { [K in keyof EngineEvents]?: Array<Listener<K>> };

interface HandlerEntry {
  handler: CommandHandler;
  canExecuteBeforeReady: boolean;
}

/** コマンドの形（先頭がコマンド名の配列）か */
function isCommand(value: unknown): value is Command {
  return Array.isArray(value) && typeof value[0] === "string" && value[0] !== "";
}

/** 台本の台詞の文字（台詞を出す前に、その文字の書体を読み込むため） */
function messageText(commands: Command[]): string {
  return commands
    .filter(([name]) => name === "message")
    .map(([, text]) => String(text ?? ""))
    .join("");
}

/**
 * ページごとのイベント台本を実行する。
 *
 * - キューを進めるのは、ハンドラーの完了を待ったエンジンだけ（ハンドラーは自分でキューを進めない）。
 *   台詞は利用者が送るまで待ち、利用者の操作を待つコマンド（condition など）は、ハンドラーが返す Promise の完了を待つ。
 * - 台本の途中の不具合（無いコマンド、ハンドラーの例外、command の取得の失敗、台詞を出せないページの message）では、
 *   残りの台本を捨てて止め、halt を通知する。書き誤りや通信の失敗で、まだ開いていないイベントへ進めないため。
 */
class EventEngine {
  #state: EngineState = {
    commandQueue: [],
    isExecuting: false,
    messageVisible: false,
    currentMessage: null,
    initialCommandsExecuted: false,
    imagesLoaded: false,
    fontsLoaded: false,
    isReady: false,
    waitingForUserInteraction: false
  };

  #listeners: ListenerMap = {};

  commandHandlers: Record<string, HandlerEntry> = {};

  /** 台詞を表示する場所（Roomの吹き出し）がページにあるか */
  messageHost = false;

  /** 台本を止めた回数。止める前に始まった処理が後から終わっても、止めた後の台本に触れないようにする */
  #generation = 0;

  /** 利用者の操作から送った action の応答を待っている */
  #userActionPending = false;

  /** go でほかのページへ移り始めた。移り終わるまで action を送らない（応答の台本は移った後に捨てられ、見えないまま状態だけが進むため） */
  #leaving = false;

  /** 台本を止めた回数（止める前に始めた処理が、後から続きを実行してよいかを確かめるため） */
  get generation(): number {
    return this.#generation;
  }

  constructor() {
    // 標準コマンドを登録
    this.registerCommandHandler("message", this.#executeMessageCommand.bind(this));
    this.registerCommandHandler("wait", this.#executeWaitCommand.bind(this));
    this.registerCommandHandler("go", this.#executeGoCommand.bind(this));
    this.registerCommandHandler("send_chat", this.#executeSendChatCommand.bind(this));
    this.registerCommandHandler("command", this.#executeCommandCommand.bind(this));
    // preloadコマンドを登録（ローディング中でも実行可能）
    this.registerCommandHandler("preload", this.#executePreloadCommand.bind(this), { canExecuteBeforeReady: true });
    // 戻る操作で、移る前のページがそのまま戻ってきた時（ブラウザーの保存からの復元）は、また受け付ける
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) this.#leaving = false;
    });
  }

  // 状態の更新（内部用）
  #updateState(updates: Partial<EngineState>): void {
    const prevState = { ...this.#state };
    this.#state = { ...this.#state, ...updates };

    // isReady の自動更新
    const shouldUpdateReady =
      this.#state.initialCommandsExecuted && this.#state.imagesLoaded && this.#state.fontsLoaded && !this.#state.isReady;

    if (shouldUpdateReady) {
      this.#state = { ...this.#state, isReady: true };
      this.#notifyListeners("ready", this.#state);

      // 実行が停止していた場合、再開
      if (!this.#state.isExecuting && this.#state.commandQueue.length > 0) {
        setTimeout(() => {
          void this.startCommandExecution();
        }, 0);
      }
    }

    // 状態が変更された場合のみ通知
    const hasChanged = (Object.keys(this.#state) as Array<keyof EngineState>).some((key) => prevState[key] !== this.#state[key]);
    if (hasChanged) this.#notifyListeners("stateChange", this.#state);
  }

  // リスナー通知
  #notifyListeners<K extends keyof EngineEvents>(event: K, data: EngineEvents[K]): void {
    for (const listener of this.#listeners[event] ?? []) listener(data);
  }

  /** イベントリスナー登録。解除用の関数を返す（stateChange は現在の状態を即時通知する） */
  on<K extends keyof EngineEvents>(event: K, callback: Listener<K>): () => void {
    const listeners: Array<Listener<K>> = this.#listeners[event] ?? [];
    this.#listeners[event] = [...listeners, callback] as ListenerMap[K];
    if (event === "stateChange") (callback as Listener<"stateChange">)(this.#state);
    return () => {
      const current: Array<Listener<K>> = this.#listeners[event] ?? [];
      this.#listeners[event] = current.filter((cb) => cb !== callback) as ListenerMap[K];
    };
  }

  // 状態の取得
  getState(): EngineState {
    return { ...this.#state };
  }

  /**
   * 応答行をコマンド列にする。`[` で始まる行はコマンドの配列（JSON）、それ以外は台詞。
   * 読めない行（JSON でない、コマンドの配列の形でない）があれば例外を投げ、応答全体を実行しない。
   */
  parseActions(actions: unknown): Command[] {
    if (!Array.isArray(actions)) throw new Error(`応答の行が配列ではありません: ${JSON.stringify(actions)}`);
    const commands: Command[] = [];
    for (const action of actions) {
      if (typeof action !== "string") throw new Error(`応答の行が文字列ではありません: ${JSON.stringify(action)}`);
      if (action.startsWith("[")) {
        const parsed: unknown = JSON.parse(action);
        if (!Array.isArray(parsed) || !parsed.every(isCommand)) throw new Error(`コマンドの行を読めません: ${action}`);
        commands.push(...parsed);
      } else {
        commands.push(["message", action]);
      }
    }
    return commands;
  }

  /**
   * ページを開いた時のイベント台本を取得する。
   * 取得できなければ、イベントを読み飛ばしたまま進まないよう台本を止め（利用者に開き直すよう知らせる）、空の台本を返す。
   */
  async fetchInitialCommands(eventName: string, pageName: string): Promise<Command[]> {
    const action = `${eventName}:${pageName}`;
    try {
      const commands = this.parseActions(await requestLines(action));
      await loadGlyphs(messageText(commands));
      return commands;
    } catch (error) {
      this.halt(["initialize", action], error);
      return [];
    }
  }

  /**
   * ページの初期化（initPage から呼ぶ）。進行中のイベントがあれば、ページのイベント台本を取得し、
   * 表示前に実行できるコマンドを実行し終えてから戻る。
   */
  async initialize(pageName: string): Promise<Command[]> {
    const commands = await this.#loadInitialCommands(pageName);
    // 表示前に実行できるコマンドを実行し終えるまで待つ（表示前は、表示前に実行できないコマンドの手前で止まる）。
    // 待たずに戻ると、ページが画像の読み込みを待ち始めた後に set が画像を加え、描き変わる途中を見せることがある
    this.addCommandsToQueue(commands);
    await this.startCommandExecution();
    this.#updateState({ initialCommandsExecuted: true });
    return commands;
  }

  async #loadInitialCommands(pageName: string): Promise<Command[]> {
    // アプリが初期化されていない（Botとつながずに開くページ。skipInitialization）
    if (!app.isInitialized) return [];

    const events: unknown = app.userStatus?.event;
    // イベントがない場合は、何も取り寄せない
    if (events === undefined || events === null || (typeof events === "object" && Object.keys(events).length === 0)) return [];

    // 進行中のイベントと優先度（{"イベント名": 優先度}）。読めなければ、でたらめな台本を取り寄せず止める
    const priorities =
      typeof events === "object" && !Array.isArray(events) ? Object.entries(events).map(([name, priority]) => [name, toNumber(priority)] as const) : [];
    if (priorities.length === 0 || priorities.some(([, priority]) => !Number.isFinite(priority))) {
      this.halt(["initialize", "event"], new Error(`get_status の event を読めません: ${JSON.stringify(events)}`));
      return [];
    }

    // 優先度の高いイベントの台本を取得
    const eventName = [...priorities].sort(([, a], [, b]) => b - a)[0][0];
    return this.fetchInitialCommands(eventName, pageName);
  }

  // コマンドキューの管理
  addCommandsToQueue(commands: Command[]): void {
    this.#updateState({ commandQueue: [...this.#state.commandQueue, ...commands] });
  }

  removeFirstCommandFromQueue(): void {
    this.#updateState({ commandQueue: this.#state.commandQueue.slice(1) });
  }

  // コマンド実行の制御
  async startCommandExecution(): Promise<void> {
    if (!this.#state.isExecuting && this.#state.commandQueue.length > 0) {
      this.#updateState({ isExecuting: true });
      await this.executeNextCommand();
    }
  }

  stopCommandExecution(): void {
    this.#updateState({ isExecuting: false });
  }

  // コマンドハンドラーの登録
  registerCommandHandler(commandType: string, handler: CommandHandler, options: { canExecuteBeforeReady?: boolean } = {}): () => void {
    const { canExecuteBeforeReady = false } = options;
    this.commandHandlers = { ...this.commandHandlers, [commandType]: { handler, canExecuteBeforeReady } };
    return () => this.unregisterCommandHandler(commandType);
  }

  // コマンドハンドラーの削除
  unregisterCommandHandler(commandType: string): void {
    const { [commandType]: _, ...rest } = this.commandHandlers;
    this.commandHandlers = rest;
  }

  // コマンド実行のディスパッチャー
  async executeCommand(command: Command): Promise<unknown> {
    const [action, ...args] = command;
    try {
      // コマンド実行前のイベント発火
      this.#notifyListeners("beforeCommandExecute", { command, action, args });

      const entry = this.commandHandlers[action];
      if (!entry) {
        // 書き誤りや、別のページ用のコマンド（Room の condition など）を素通りしないよう、不具合として止める
        throw new Error(`このページに無いコマンドです: ${action}`);
      }
      const result = await entry.handler(...args);

      // コマンド実行後のイベント発火
      this.#notifyListeners("commandExecuted", { command, action, args, result, success: true });
      return result;
    } catch (error) {
      console.error(`コマンドを実行できませんでした: ${action}`, error);
      // エラーイベント発火
      this.#notifyListeners("commandError", { command, action, args, error });
      throw error;
    }
  }

  async executeNextCommand(): Promise<void> {
    if (this.#state.commandQueue.length === 0) {
      this.stopCommandExecution();
      return;
    }

    const command = this.#state.commandQueue[0];
    // 形の崩れたコマンドは、実行の時に不具合として止める（ここで例外にすると、実行中のまま固まるため）
    const action = isCommand(command) ? command[0] : "";

    // 表示の前は、表示前に実行できるコマンドだけを実行する
    if (!this.#state.isReady && !this.commandHandlers[action]?.canExecuteBeforeReady) {
      // 表示できるようになったら続きを実行する
      this.stopCommandExecution();
      return;
    }

    const generation = this.#generation;
    try {
      await this.executeCommand(command);
    } catch (error) {
      if (generation === this.#generation) this.halt(command, error);
      return;
    }
    // 実行の途中で台本が止められていたら、ここで終える
    if (generation !== this.#generation) return;

    // 台詞を送るのを待つ場合は、次のコマンドを実行しない
    if (!this.#state.waitingForUserInteraction) {
      this.removeFirstCommandFromQueue();
      // 次のコマンドを実行
      await this.executeNextCommand();
    }
  }

  /** 残りの台本を捨てる。捨てる前に始まった処理が後から終わっても、続きを実行しないよう世代を進める */
  #discardScript(): void {
    this.#generation += 1;
    this.#updateState({ commandQueue: [], isExecuting: false, messageVisible: false, currentMessage: null, waitingForUserInteraction: false });
  }

  /**
   * 不具合で台本を止める。残りの台本を捨てる（Botの状態を進める action を送らない）。
   * 表示中の台詞も片付ける（残すと、後で押された時に、止めた後に始まった台本の先頭を取り除いてしまう）。
   */
  halt(command: Command, error: unknown): void {
    console.error("台本を止めました:", command, error);
    this.#discardScript();
    this.#notifyListeners("halt", { command, error });
  }

  // 個別コマンドの実行メソッド
  #executeMessageCommand(message: unknown): void {
    if (!this.messageHost) {
      // 台詞を表示する場所のないページでは、見えない台詞で止まったままにせず、不具合として止める
      throw new Error("このページには台詞を表示する場所がありません");
    }
    // 台詞表示の開始
    this.#updateState({ messageVisible: true, currentMessage: message, waitingForUserInteraction: true });
  }

  async #executeWaitCommand(seconds: unknown): Promise<void> {
    // 秒数が読めなければ、待たずに先へ進めず止める（"1.5" のような数の文字列も使える）
    const duration = toNumber(seconds);
    if (!Number.isFinite(duration) || duration < 0) throw new Error(`wait の秒数を読めません: ${JSON.stringify(seconds)}`);
    // 指定された秒数待機（完了後、エンジンが次のコマンドへ進む）
    await new Promise((resolve) => setTimeout(resolve, duration * 1000));
  }

  #executeGoCommand(url: unknown): void {
    const target = requireString(url, "go の行き先");
    // path と http(s) のURLだけを開く（javascript: などは開かない）
    const destination = new URL(withBase(target), window.location.href);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") throw new Error(`go の行き先に使えないURLです: ${target}`);
    // webchat で開いている時は、同じオリジンのページへ起動パラメータ（xsb_client）を引き継ぐ
    const next = new URL(withLaunchParams(destination.href));
    // 同じページの中（# だけが違う）ならページは入れ替わらないので、操作は受け付けたままにする
    const current = new URL(window.location.href);
    if (!(next.hash && next.href.split("#")[0] === current.href.split("#")[0])) this.#leaving = true;
    window.location.href = next.href;
    // ページを移るので、後ろの台本は実行しない（移る間に action を送らないため）
    this.#discardScript();
  }

  async #executeSendChatCommand(text: unknown): Promise<void> {
    // 読めない値を、利用者の発言としてトークへ送らない
    await sendText(requireString(text, "send_chat の文字列"));
  }

  #executePreloadCommand(imagePath: unknown): boolean {
    // 画像のプリロード
    imageLoader.registerImage(withBase(requireString(imagePath, "preload の画像")));
    return true;
  }

  // commandコマンドの実装
  async #executeCommandCommand(value: unknown): Promise<boolean> {
    const actionName = requireString(value, "command の action");
    const ok = await this.fetchAndExecuteAction(actionName);
    // 取得できなければ、続きの台本が前提を欠いたまま進まないよう止める
    if (!ok) throw new Error(`command の台本を取得できませんでした: ${actionName}`);
    return ok;
  }

  // メッセージクリック時の処理
  handleMessageClick = (): void => {
    if (!this.#state.messageVisible) return;

    this.#updateState({ messageVisible: false, currentMessage: null, waitingForUserInteraction: false });

    // メッセージコマンドをキューから削除
    this.removeFirstCommandFromQueue();

    // 次のコマンドを実行
    void this.executeNextCommand();
  };

  /**
   * 利用者の操作（物のタップ、メニューの action、ことばの onclick など）から action を送る。
   * 台本の実行中と、前の操作の応答を待つ間は、受け付けない（二度押しで重ねて送ったり、Botが処理した順と画面の台本の順がずれたりしないように）。
   * 受け付けて、応答の台本を実行し始めたら true。
   */
  async sendUserAction(actionName: string): Promise<boolean> {
    if (this.#leaving || this.#userActionPending || this.#state.isExecuting || this.#state.commandQueue.length > 0) return false;
    this.#userActionPending = true;
    try {
      return await this.fetchAndExecuteAction(actionName);
    } finally {
      this.#userActionPending = false;
    }
  }

  /**
   * action を Bot へ送り、応答の台本を今の台本の後ろに加えて実行する。送れなかった時と、応答を読めなかった時は false。
   * 送った後に台本が止められていたら、届いた台本は実行しない（止めた台本の続きで、状態を進める action を送らないため）。
   * go でページを移り始めた後は、送らずに false。
   */
  async fetchAndExecuteAction(actionName: string): Promise<boolean> {
    if (this.#leaving) return false;
    const generation = this.#generation;
    try {
      const commands = this.parseActions(await requestLines(actionName));
      // 台詞を、読み込み途中の別の書体で見せない
      await loadGlyphs(messageText(commands));

      if (generation !== this.#generation) {
        console.error(`台本を止めた後に届いた応答は実行しません: ${actionName}`);
        return false;
      }

      // コマンドをキューに追加
      this.addCommandsToQueue(commands);

      // 実行開始
      void this.startCommandExecution();
      return true;
    } catch (error) {
      console.error(`action を送れなかったか、応答を読めませんでした: ${actionName}`, error);
      return false;
    }
  }

  // ローディング状態の更新
  setInitialCommandsExecuted(value: boolean): void {
    this.#updateState({ initialCommandsExecuted: value });
  }

  setImagesLoaded(value: boolean): void {
    this.#updateState({ imagesLoaded: value });
  }

  setFontsLoaded(value: boolean): void {
    this.#updateState({ fontsLoaded: value });
  }
}

// シングルトンインスタンスを作成
const eventEngine = new EventEngine();

/**
 * set_hud: ステータス表示の値（lv・n_words など、get_status の値）をイベントの途中で変える。表示前にも実行できる。
 * 書き換えた後の状態が get_status と同じ形でなければ（words にことばの形でない値を入れた、など）、台本を止める。
 */
eventEngine.registerCommandHandler(
  "set_hud",
  (key: unknown, value: unknown) => {
    const name = requireString(key, "set_hud の項目名");
    updateUserStatus((status) => parseUserStatus({ ...status, [name]: value }));
  },
  { canExecuteBeforeReady: true }
);

export default eventEngine;
