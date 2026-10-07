"use strict";

window._debugTimeStart = Date.now();

const truffledNativeFetch = window.fetch.bind(window);
const truffledNativeWebSocket = window.WebSocket;
const truffledNativeWindowOpen = window.open.bind(window);
const truffledTransportModule = "/js/libcurlbareclient.mjs?v=krunker-wisp-20260512";
let truffledWispClientPromise = null;
const truffledLocalRoots = [
  "/css/",
  "/css-img/",
  "/docs/",
  "/img/",
  "/libs/",
  "/models/",
  "/promo/",
  "/scares/",
  "/scripts/",
  "/shaders/",
  "/sound/",
  "/textures/",
  "/user-assets/",
];

function truffledLocalAssetPath(pathname) {
  if (!truffledLocalRoots.some((root) => pathname.startsWith(root))) {
    return null;
  }
  return new URL("." + pathname, location.href).href;
}

function truffledRewriteElementUrl(element, attribute) {
  const value = element.getAttribute(attribute);
  if (!value) return;
  const rewritten = rewrite(value);
  if (typeof rewritten === "string" && rewritten !== value) {
    element.setAttribute(attribute, rewritten);
  }
}

function truffledKeepNavigationInFrame(url) {
  if (!url || url === "about:blank") return null;
  try {
    const target = new URL(url, location.href);
    if (target.protocol === "javascript:") return null;
    if (
      target.origin === location.origin &&
      target.pathname === "/" &&
      target.searchParams.has("game")
    ) {
      return new URL("./" + target.search + target.hash, location.href).href;
    }
    if (
      target.origin === location.origin &&
      target.pathname.startsWith("/") &&
      !target.pathname.startsWith("/games/krunker/")
    ) {
      return new URL("." + target.pathname + target.search + target.hash, location.href)
        .href;
    }
    return rewrite(target.href);
  } catch (_) {
    return rewrite(String(url));
  }
}

function truffledPatchLinkTarget(element) {
  if (!element || element.tagName !== "A") return;
  if (element.target && element.target.toLowerCase() !== "_self") {
    element.target = "_self";
  }
  element.rel = "";
}

function truffledRewriteElementUrls(root = document) {
  const elements = root.querySelectorAll
    ? root.querySelectorAll("[src], [href], [target], source[src], video[src], audio[src]")
    : [];
  for (const element of elements) {
    truffledRewriteElementUrl(element, "src");
    truffledRewriteElementUrl(element, "href");
    truffledPatchLinkTarget(element);
  }
}

function truffledWispUrl() {
  return (
    (location.protocol === "https:" ? "wss:" : "ws:") +
    "//" +
    location.host +
    "/wisp/"
  );
}

function truffledIsLocalGameServerUrl(url) {
  return (
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "6767"
  );
}

function truffledSameOriginGameServerUrl(url) {
  if (!truffledIsLocalGameServerUrl(url) || url.origin === location.origin) {
    return null;
  }
  if (location.pathname.startsWith("/games/krunker/")) {
    return (
      location.origin +
      "/games/krunker" +
      url.pathname +
      url.search +
      url.hash
    );
  }
  return null;
}

async function truffledTransportOptions() {
  if (window.TruffledProxyRegion?.getTransportOptions) {
    return window.TruffledProxyRegion.getTransportOptions(truffledWispUrl());
  }
  return { websocket: truffledWispUrl(), wisp: truffledWispUrl() };
}

async function truffledWispClient() {
  if (!truffledWispClientPromise) {
    truffledWispClientPromise = (async () => {
      const oldFetch = window.fetch;
      const oldWebSocket = window.WebSocket;
      window.fetch = truffledNativeFetch;
      window.WebSocket = truffledNativeWebSocket;
      try {
        const module = await import(truffledTransportModule);
        const Client = module.default;
        const client = new Client(await truffledTransportOptions());
        await client.init();
        return client;
      } finally {
        window.fetch = oldFetch;
        window.WebSocket = oldWebSocket;
      }
    })();
  }
  return truffledWispClientPromise;
}

function truffledRemoteUrl(value) {
  try {
    const href =
      value instanceof Request
        ? value.url
        : value instanceof URL
          ? value.href
          : String(value);
    const url = new URL(href, location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (
      url.origin === location.origin ||
      (url.hostname === "127.0.0.1" && url.port === "6767") ||
      (url.hostname === "localhost" && url.port === "6767") ||
      url.hostname.endsWith(".krunker.io") ||
      url.hostname === "krunker.io"
    ) {
      return url;
    }
  } catch (_) {}
  return null;
}

async function truffledProxyFetch(input, init = {}) {
  const remote = truffledRemoteUrl(input);
  const sameOriginLocal = remote ? truffledSameOriginGameServerUrl(remote) : null;
  if (sameOriginLocal) {
    return truffledNativeFetch(sameOriginLocal, init);
  }
  if (
    !remote ||
    remote.origin === location.origin ||
    truffledIsLocalGameServerUrl(remote)
  ) {
    return truffledNativeFetch(input, init);
  }

  const request = input instanceof Request ? input : null;
  const method = init.method || request?.method || "GET";
  const headers = new Headers(request?.headers || {});
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  const body = init.body ?? request?.body ?? undefined;
  const client = await truffledWispClient();
  const response = await client.request(
    remote,
    method,
    body,
    Array.from(headers.entries()),
    init.signal || request?.signal,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

window.open = function (url, target, features) {
  const rewritten = truffledKeepNavigationInFrame(url);
  if (!rewritten) return truffledNativeWindowOpen(url, "_self", features);
  window.location.href = rewritten;
  return window;
};

// delete window.require;
// delete window.module;
// delete window.exports;
// delete window.__dirname;
// delete window.__filename;

localStorage.logs = "true";

window.images = [];

{
  const pr = Image.prototype;
  const src = Object.getOwnPropertyDescriptor(pr, "src");
  Object.defineProperty(pr, "src", {
    get: src.get,
    set: function (value) {
      const newValue = rewrite(value);
      window.images.push(value);
      // console.log(`image ${value} -> ${newValue}`);
      src.set.call(this, newValue);
    },
  });
}

{
  const pr = XMLHttpRequest.prototype;
  const { open } = pr;
  pr.open = function (method, url, ...args) {
    const newUrl = rewrite(url);
    // console.log(`xhr ${url} -> ${newUrl}`);
    return open.call(this, method, newUrl, ...args);
  };
}

{
  const pr = History.prototype;
  const { pushState, replaceState } = pr;
  pr.pushState = function (state, title, url) {
    const newUrl = rewrite_history(url);
    // console.log(`pushState ${url} -> ${newUrl}`);
    return pushState.call(this, state, title, newUrl);
  };
  pr.replaceState = function (state, title, url) {
    const newUrl = rewrite_history(url);
    // console.log(`replaceState ${url} -> ${newUrl}`);
    return replaceState.call(this, state, title, newUrl);
  };
}

function rewrite_history(url) {
  // console.log("url", url);
  return url;
}

{
  const pr = HTMLMediaElement.prototype;
  const src = Object.getOwnPropertyDescriptor(pr, "src");
  Object.defineProperty(pr, "src", {
    get: src.get,
    set: function (value) {
      const newValue = rewrite(value);
      // console.log(`media ${value} -> ${newValue}`);
      src.set.call(this, newValue);
    },
  });
}

{
  const WebSocket = truffledNativeWebSocket;
  class WispWebSocket extends EventTarget {
    constructor(value, protocols) {
      super();
      this.url = String(value);
      this.protocol = "";
      this.extensions = "";
      this.binaryType = "blob";
      this.bufferedAmount = 0;
      this.readyState = WebSocket.CONNECTING;
      this._sendRaw = null;
      this._closeRaw = null;
      this._closeArgs = null;

      const protocolList = Array.isArray(protocols)
        ? protocols
        : protocols
          ? [protocols]
          : [];
      const remote = new URL(this.url, location.href);
      if (truffledIsLocalGameServerUrl(remote)) {
        return new WebSocket(remote.href, protocols);
      }

      truffledWispClient()
        .then((client) => {
          if (this.readyState === WebSocket.CLOSED) return;
          const oldWebSocket = window.WebSocket;
          window.WebSocket = WebSocket;
          try {
            const [sendRaw, closeRaw] = client.connect(
              remote,
              protocolList,
              [],
              (protocol) => {
                this.protocol = protocol || "";
                this.readyState = WebSocket.OPEN;
                this._emit("open", new Event("open"));
                if (this._closeArgs) this.close(...this._closeArgs);
              },
              (data) => {
                const payload =
                  this.binaryType === "arraybuffer" || !(data instanceof ArrayBuffer)
                    ? data
                    : new Blob([data]);
                this._emit("message", new MessageEvent("message", { data: payload }));
              },
              (code, reason) => {
                this._finishClose(code || 1000, reason || "");
              },
              () => {
                this._emit("error", new Event("error"));
              },
            );
            this._sendRaw = sendRaw;
            this._closeRaw = closeRaw;
          } finally {
            window.WebSocket = oldWebSocket;
          }
        })
        .catch((error) => {
          console.error("Wisp WebSocket failed", error);
          this._emit("error", new Event("error"));
          this._finishClose(1006, "");
        });
    }

    send(data) {
      if (this.readyState !== WebSocket.OPEN || !this._sendRaw) {
        throw new Error("WebSocket is not open.");
      }
      this._sendRaw(data);
    }

    close(code = 1000, reason = "") {
      if (
        this.readyState === WebSocket.CLOSING ||
        this.readyState === WebSocket.CLOSED
      ) {
        return;
      }
      this.readyState = WebSocket.CLOSING;
      if (this._closeRaw) {
        this._closeRaw(code, reason);
      } else {
        this._closeArgs = [code, reason];
      }
    }

    _finishClose(code, reason) {
      if (this.readyState === WebSocket.CLOSED) return;
      this.readyState = WebSocket.CLOSED;
      this._emit("close", new CloseEvent("close", { code, reason }));
    }

    _emit(type, event) {
      this.dispatchEvent(event);
      const handler = this["on" + type];
      if (typeof handler === "function") handler.call(this, event);
    }
  }

  WispWebSocket.CONNECTING = WebSocket.CONNECTING;
  WispWebSocket.OPEN = WebSocket.OPEN;
  WispWebSocket.CLOSING = WebSocket.CLOSING;
  WispWebSocket.CLOSED = WebSocket.CLOSED;
  window.WebSocket = WispWebSocket;
  // const { send } = pr;
  // pr.send = function (packet) {
  //   try{
  //     let padding = 2;
  //   let data = packet.slice(0, -padding);
  //   const [label, ...values] = [...msgpack.decode(data)];
  //   // console.log("%c => ", "background:#19FF6A;color:#000", [label, ...values]);
  //   }catch(e){
  //     log.error("Failed to decode packet", e);
  //   }
  //   return send.call(this, packet);
  // };
}
const xhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...args) {
  const rewrittenUrl = rewrite_mm(url);
  // console.log("xhr", method, url, "=>", rewrittenUrl);
  return xhrOpen.call(this, method, rewrittenUrl, ...args);
};

window.fetch = function (init, opts) {
  const rewrittenUrl = init instanceof Request ? init : rewrite_mm(init);
  // console.log("fetch", init, "=>", rewrittenUrl);
  // console.log(`fetch ${init} -> ${rewrittenUrl}`);
  return truffledProxyFetch(rewrittenUrl, opts);
};

window.grecaptcha = {
  execute: function (siteKey, options) {
    // console.trace("grecaptcha.execute", siteKey, options);
    return Promise.resolve(
      "recaptcha-token-" + Math.random().toString(36).slice(2),
    );
  },
  ready: function (cb) {
    cb();
  },
};

waitFor(() => document.documentElement).then(() => {
  truffledRewriteElementUrls();
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a[href]");
      if (!link) return;
      const originalTarget = link.getAttribute("target");
      const rewritten = truffledKeepNavigationInFrame(link.href);
      if (rewritten) link.href = rewritten;
      truffledPatchLinkTarget(link);
      if (originalTarget && originalTarget.toLowerCase() !== "_self") {
        event.preventDefault();
        if (rewritten) window.location.href = rewritten;
      }
    },
    true,
  );
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        truffledRewriteElementUrl(record.target, record.attributeName);
        truffledPatchLinkTarget(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        truffledRewriteElementUrl(node, "src");
        truffledRewriteElementUrl(node, "href");
        truffledPatchLinkTarget(node);
        truffledRewriteElementUrls(node);
      }
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["src", "href", "target"],
    childList: true,
    subtree: true,
  });
});

function rewrite(url) {
  if (url instanceof URL) url = url.href;
  if (typeof url !== "string") return url;
  try {
    const parsed = new URL(url, location.href);
    if (parsed.origin === location.origin) {
      const localAsset = truffledLocalAssetPath(parsed.pathname);
      if (localAsset) return localAsset + parsed.search + parsed.hash;
    }
  } catch (_) {}
  if (url.startsWith("/")) {
    url = url.slice(1);
  }
  {
    const p = "../";
    if (url.startsWith(p)) return url.replace(p, "");
  }
  {
    const p = "file:///";
    if (url.startsWith(p)) return url.replace(p, "");
  }
  {
    const p = "https://user-assets.krunker.io/";
    // console.log("rewriting user asset", url);
    if (url.startsWith(p)) return url.replace(p, "user-assets/");
  }
  {
    const p = "https://assets.krunker.io/";
    if (url.startsWith(p)) return url.replace(p, "");
  }
  return url;
}

function rewrite_mm(url) {
  if (url instanceof URL) url = url.href;
  if (url instanceof Request) url = url.url;
  if (typeof url !== "string") return url;
  try {
    const parsed = new URL(url, location.href);
    if (parsed.origin === location.origin) {
      const localAsset = truffledLocalAssetPath(parsed.pathname);
      if (localAsset) return localAsset + parsed.search + parsed.hash;
    }
  } catch (_) {}
  {
    const p = "../";
    if (url.startsWith(p)) return url.replace(p, "");
  }
  {
    const p = "http://true";
    if (url.startsWith(p)) {
      url = url.replace(p, "https://krunker.io");
    }
  }
  {
    const p = "https://krunker.io";
    if (url.startsWith(p)) return url;
  }
  {
    const p = "https://social_beta.krunker.io";
    if (url.startsWith(p)) return url;
  }
  {
    const p = "https://matchmaker_beta.krunker.io";
    if (url.startsWith(p)) return url;
  }
  {
    const p = "https://assets.krunker.io/";
    if (url.startsWith(p)) return url.replace(p, "");
  }
  if (url.startsWith("/")) return url.slice(1);
  return url;
}

const grounds = new WeakMap();
// window.mapOverride = require("./zombie_high.json");
// console.log(window.mapOverride);

Object.defineProperty(Object.prototype, "noclip", {
  get() {
    return window.fly || grounds.get(this);
  },
  set(value) {
    grounds.set(this, value);
  },
});

// Force all objects to report singlePlayer=true.
// This makes the client take offline/local paths and skip multiplayer network paths,
// including the "q" input-batch send branch guarded by !game.singlePlayer.
// Object.defineProperty(Object.prototype, "singlePlayer", {
//   get() {
//     return true;
//   },
// });

console.log("Hacks:");
console.log("[n] fly");
console.log("[b] bhop");

window.fly = false;
window.bhopEnabled = localStorage.getItem("bhop") === "1";
window.bhop = false;
window.ctrlTpEnabled = localStorage.getItem("ctrlTp") === "1";
window.ctrlTp = false;

// Admin commands (cycle map, noclip, ctrl+click TP) are restricted to the DEV
// account on the client; the server independently enforces the same gate when
// PERMS mode is on (see main/constants.js).
function isDevPlayer() {
  try {
    const lp = window.localPlayer;
    return !!(lp && lp.account && lp.account.name === "DEV");
  } catch (_) {
    return false;
  }
}

document.addEventListener("keydown", (e) => {
  // Ignore OS auto-repeat so holding a key doesn't spam actions (e.g. ` cycling maps).
  if (e.repeat) return;
  const input = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

  switch (e.key) {
    case "F5":
      location.reload();
      break;
    case "F6":
      console.log("Creating editor window");
      // ipcRenderer.send("create-editor");
      window.open("editor.html");
      break;
    case "`":
      if (input) return;
      // io_ch(null, "Cycling map...", 2);
      notify("Cycling map...");
      console.log(window.io, "sending packet");
      window.io.send("cycle");

      break;
    case "r":
    case "R":
      if (input) return;
      // ipcRenderer.send("respawn");
      forceLocalReload();
      // notify("Reloading...");
      break;
    case "N":
    case "n":
      if (input) return;
      // Server is authoritative — it replies with ["noc", state] which io_noc
      // applies to localPlayer.noclip and shows the in-game toast.
      window.io.send("noclip");
      break;
    case "T":
    case "t":
      if (input) return;
      window.ctrlTpEnabled ^= 1;
      localStorage.setItem("ctrlTp", +window.ctrlTpEnabled);
      {
        const msg =
          "Ctrl TP - " + (window.ctrlTpEnabled ? "Enabled" : "Disabled");
        // io_ch(null, msg, 2);
        notify(msg);
        console.log(msg);
      }
      break;
    case "B":
    case "b":
      if (input) return;
      window.bhopEnabled ^= 1;
      localStorage.setItem("bhop", +window.bhopEnabled);
      {
        const msg = "Bhop - " + (window.bhopEnabled ? "Enabled" : "Disabled");
        // io_ch(null, msg, 2);
        notify(msg);
        console.log(msg);
      }
      break;
  }
});

window.addEventListener("blur", () => {
  const doHopsBoing = localStorage.boing;

  if (!doHopsBoing) window.bhop = false;
});

function forceLocalReload() {
  const b5 = localPlayer;
  if (!b5 || !b5.active) return;
  if (b5.reloadTimer) return;
  if (b5.ammos[b5.weaponIndex] >= b5.weapon.ammo) return;

  b5.reloadTimer = b5.weapon.reload * (game.config.reSpd || 1);
  b5.burstCount = 0;
  game.players.cancelInspect(b5);
  game.players.reloadUIAnim(b5);
}

let notification = document.createElement("div");
let anim = document.createElement("style");

notification.style.cssText = `
    position: absolute;
    z-index: 9999;
    top: 10px;
    right: 10px;
    transform: translateX(calc(100% + 20px));
    padding: 10px;
    margin: 10px;
    box-sizing: border-box;
    border-radius: 5px;
    background: #0005;
    color: #fff;
`;

anim.textContent = `
    @keyframes slide {
        0%, 100% {
            transform: translateX(calc(100% + 20px));
        }
    
        10%, 90% {
            transform: translateX(0);
        }
    }
    
    .anim {
        animation: slide 2s forwards;
    }
`;

function waitFor(check, interval = 50) {
  return new Promise((resolve) => {
    let timer;

    const run = () => {
      try {
        const result = check();

        if (result) {
          if (timer) clearInterval(timer);
          resolve(result);
          return true;
        }
      } catch (err) {
        if (typeof isDevelopment !== "undefined" && isDevelopment)
          console.error(err);
      }

      return false;
    };

    if (!run()) timer = setInterval(run, interval);
  });
}

waitFor(() => document.head).then(() => {
  document.body.append(notification, anim);
});

function notify(message) {
  notification.innerHTML = message;
  notification.className = "";

  void notification.offsetHeight;
  notification.className = "anim";
}

window.notify = notify;
