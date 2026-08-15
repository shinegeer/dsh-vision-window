window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-vision-window",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");
		var ReactDOM = require("react-dom");

		var CHANNEL = "/paste-image";
		var STYLE_ID = "ui-paste-image-style";

		var CSS = [
			".ui-paste-image-root{position:relative;display:inline-flex}",
			".ui-paste-image-btn{height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex;font-family:inherit}",
			".ui-paste-image-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".ui-paste-image-btn:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}",
			".ui-paste-image-btn:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
			".ui-paste-image-btn svg{width:14px;height:14px;flex:none}",
			".ui-paste-image-float{position:fixed;z-index:200;box-sizing:border-box;width:260px;max-height:calc(100vh - 24px);overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}",
			".ui-paste-image-float-head{display:flex;align-items:center;justify-content:space-between;font-weight:500;cursor:move;user-select:none}",
			".ui-paste-image-float-close{width:20px;height:20px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:14px;line-height:20px}",
			".ui-paste-image-float-close:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".ui-paste-image-paste{box-sizing:border-box;width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;resize:none;outline:none}",
			".ui-paste-image-paste:focus{border-color:var(--dsw-alias-state-business-primary)}",
			".ui-paste-image-paste::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".ui-paste-image-float-thumbs{display:flex;flex-wrap:wrap;gap:6px}",
			".ui-paste-image-thumb{position:relative;width:48px;height:48px;border-radius:8px;overflow:hidden;flex:none;border:1px solid var(--dsw-alias-border-l2)}",
			".ui-paste-image-thumb img{width:100%;height:100%;object-fit:cover;display:block}",
			".ui-paste-image-thumb[data-status=saving]{opacity:.6}",
			".ui-paste-image-thumb[data-status=error]{border-color:var(--dsw-alias-state-error-primary)}",
			".ui-paste-image-remove{position:absolute;top:2px;right:2px;width:16px;height:16px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:10px;line-height:16px;text-align:center;cursor:pointer;display:none}",
			".ui-paste-image-thumb:hover .ui-paste-image-remove{display:block}",
			".ui-paste-image-float-actions{display:flex;align-items:stretch;gap:8px}",
			".ui-paste-image-float-pick{height:40px;flex:1;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:13px;line-height:20px;cursor:pointer}",
			".ui-paste-image-float-pick:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".ui-paste-image-float-pick:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px}",
			".ui-paste-image-float-go{height:40px;flex:1.9;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:12px;background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-inverse);font-family:inherit;font-size:14px;font-weight:600;line-height:20px;cursor:pointer;box-shadow:0 2px 8px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 35%,transparent);transition:filter .15s ease,transform .05s ease}",
			".ui-paste-image-float-go svg{width:15px;height:15px;flex:none}",
			".ui-paste-image-float-go:hover:not(:disabled){filter:brightness(1.08)}",
			".ui-paste-image-float-go:active:not(:disabled){transform:translateY(1px)}",
			".ui-paste-image-float-go:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px}",
			".ui-paste-image-float-go[data-ready=true]{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 28%,transparent),0 4px 14px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 45%,transparent)}",
			".ui-paste-image-float-go:disabled{opacity:.55;cursor:default;box-shadow:none}",
			"@media (prefers-reduced-motion: reduce){.ui-paste-image-float-go{transition:none}}",
			".ui-paste-image-float-err{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:4px 8px;font-size:12px;line-height:18px}",
			".ui-paste-image-float-gear{width:20px;height:20px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:13px;line-height:20px}",
			".ui-paste-image-float-gear:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".ui-paste-image-cfg{border-top:1px solid var(--dsw-alias-border-l2);padding-top:8px;display:flex;flex-direction:column;gap:6px;max-height:min(42vh,340px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}",
			".ui-paste-image-cfg-row{display:flex;flex-direction:column;gap:2px}",
			".ui-paste-image-cfg-label{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
			".ui-paste-image-cfg-input{box-sizing:border-box;width:100%;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:24px;outline:none}",
			".ui-paste-image-cfg-input:focus{border-color:var(--dsw-alias-state-business-primary)}",
			"select.ui-paste-image-cfg-input{appearance:none;-webkit-appearance:none}",
			".ui-paste-image-cfg-actions{display:flex;gap:6px}",
			".ui-paste-image-cfg-btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:24px;cursor:pointer}",
			".ui-paste-image-cfg-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".ui-paste-image-cfg-btn:disabled{opacity:.5;cursor:default}",
			".ui-paste-image-cfg-btn-primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-inverse);border:none}",
			".ui-paste-image-cfg-btn-primary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-primary)}",
			".ui-paste-image-cfg-status{font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:pre-line}",
			".ui-paste-image-cfg-status[data-kind=error]{color:var(--dsw-alias-state-error-primary)}",
			".ui-paste-image-cfg-status[data-kind=ok]{color:var(--dsw-alias-state-business-primary)}",
			".ui-paste-image-cfg-info{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);word-break:break-all}",
			".ui-paste-image-cfg-check{display:flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer}",
			".ui-paste-image-cfg-check input{margin:0}",
			".ui-paste-image-cfg-section{font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary);font-weight:500;margin-top:2px}"
		].join("\n");

		function ensureStyle() {
			if (document.getElementById(STYLE_ID)) return;
			if (!document.head) return;
			var style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = CSS;
			document.head.appendChild(style);
		}

		function readAsBase64(file) {
			return new Promise((resolve, reject) => {
				var reader = new FileReader();
				reader.onload = function () {
					var s = String(reader.result || "");
					var i = s.indexOf(",");
					resolve(i >= 0 ? s.slice(i + 1) : s);
				};
				reader.onerror = function () {
					reject(reader.error || new Error("read failed"));
				};
				reader.readAsDataURL(file);
			});
		}

		function filesFromClipboard(e) {
			var items = e.clipboardData && e.clipboardData.items;
			if (!items) return null;
			var out = [];
			for (var i = 0; i < items.length; i++) {
				var it = items[i];
				if (it.kind === "file" && typeof it.type === "string" && it.type.indexOf("image/") === 0) {
					var f = it.getAsFile ? it.getAsFile() : null;
					if (f) out.push(f);
				}
			}
			return out.length > 0 ? out : null;
		}

		function composeInstruction(paths) {
			return paths.length === 1
				? "识别图片 " + paths[0]
				: "识别图片：\n" + paths.map(function (p) { return "- " + p; }).join("\n");
		}

		function cfgRow(key, label, inputEl) {
			return React.createElement("div", { key: key, className: "ui-paste-image-cfg-row" }, [
				React.createElement("label", { key: "l", className: "ui-paste-image-cfg-label" }, label),
				React.cloneElement(inputEl, { key: "i" })
			]);
		}

		function cfgTextInput(props) {
			return React.createElement("input", Object.assign({ type: "text", className: "ui-paste-image-cfg-input", spellCheck: false }, props));
		}

		var STR = {
			zh: {
				btnRecognize: "识图",
				btnSaving: "保存中…",
				btnTitle: "识图：打开图片存储框，粘贴截图后点“识别并发送”",
				boxTitle: "图片存储框（可拖动）",
				cfgTitle: "配置识图模型（预设/凭据/降级链）",
				close: "关闭",
				pastePlaceholder: "粘贴截图到这里（Ctrl+V），或把图片拖入此框",
				remove: "移除",
				pick: "选择图片",
				go: "识别并发送",
				sending: "发送中…",
				goTitle: "把「识别图片 <路径>」插到输入框文字最前面一起发送；AI 会自动调 vision 识图并整理到「已识别图片」",
				preset: "模型预设",
				fallbacksLabel: "备用供应商（从上到下自动降级）",
				presetInfo: "地址 {baseUrl} · 模型 {model} · 接口 {apiType}",
				presetCredential: "凭据 {credential}",
				customSection: "自定义供应商",
				advSection: "高级设置",
				baseUrl: "接口地址 baseURL",
				model: "模型名 model",
				apiType: "接口类型",
				apiTypeChat: "chat · Chat Completions（兼容最广）",
				apiTypeResponses: "responses · OpenAI Responses",
				apiTypeCompletions: "completions · 仅文本，不支持识图",
				maxTokens: "maxTokens（可选，留空=不限制）",
				maxTokensPlaceholder: "留空=用模型默认输出上限",
				language: "语言 Language",
				langZh: "中文",
				langEn: "English",
				credential: "DSH 凭据名（只存名字，不存 key）",
				credentialValue: "新密钥值（写入 DSH 凭据库，不回显）",
				credentialValuePlaceholder: "sk-…（点“保存凭据”时写入 ~/.dsh/.credentials.yaml）",
				credentialConfigured: "已配置（来源：{source}）",
				credentialMissing: "未配置",
				saveCredential: "保存凭据",
				clearCredential: "清除凭据",
				needCredentialName: "请填写凭据名",
				needCredentialValue: "请填写新密钥值",
				downscale: "调用前自动缩小大图（sharp）",
				downscaleMaxPixels: "像素预算（px）",
				cache: "答案缓存（同图同问不重复调用）",
				cacheTtl: "缓存 TTL（秒，0=不过期）",
				cacheMaxEntries: "缓存条数上限",
				stripThink: "剥离推理块（<think>/reasoning）",
				localTools: "本地像素/OCR 工具（vw_*，零配置）",
				artifactsDir: "本地工具产物目录",
				timeout: "单次请求超时（秒）",
				test: "测试连接",
				save: "保存",
				clear: "清除",
				saved: "已保存",
				cleared: "已清除配置",
				readFailed: "读取配置失败",
				corrupt: "配置文件损坏，请重新保存",
				needBaseAndModel: "自定义供应商的地址和模型名不能为空",
				needBaseAndModelForTest: "请先填写自定义供应商的地址和模型名",
				testing: "正在测试…",
				testOk: "{name}：连接成功",
				testFail: "{name}：{message}",
				saveFailed: "保存失败",
				clearFailed: "清除失败",
				testFailed: "测试失败",
				credentialSaveFailed: "保存凭据失败",
				credentialClearFailed: "清除凭据失败",
				sendFailed: "发送失败",
				failed: "失败"
			},
			en: {
				btnRecognize: "Vision",
				btnSaving: "Saving…",
				btnTitle: "Vision: open the image box, paste a screenshot, then click “Recognize & send”",
				boxTitle: "Image box (draggable)",
				cfgTitle: "Configure the vision model (preset / credential / fallback chain)",
				close: "Close",
				pastePlaceholder: "Paste a screenshot here (Ctrl+V), or drop an image",
				remove: "Remove",
				pick: "Choose image",
				go: "Recognize & send",
				sending: "Sending…",
				goTitle: "Prepends “识别图片 <path>” before your text; the AI then calls vision and organizes results",
				preset: "Model preset",
				fallbacksLabel: "Fallback providers (tried top to bottom)",
				presetInfo: "{baseUrl} · model {model} · {apiType}",
				presetCredential: "Credential {credential}",
				customSection: "Custom provider",
				advSection: "Advanced",
				baseUrl: "Base URL",
				model: "Model",
				apiType: "API type",
				apiTypeChat: "chat · Chat Completions (most compatible)",
				apiTypeResponses: "responses · OpenAI Responses",
				apiTypeCompletions: "completions · text-only, no images",
				maxTokens: "maxTokens (optional, blank = unlimited)",
				maxTokensPlaceholder: "Blank = use model default",
				language: "Language",
				langZh: "中文",
				langEn: "English",
				credential: "DSH credential name (stores a reference, never the key)",
				credentialValue: "New key value (written to the DSH credential store)",
				credentialValuePlaceholder: "sk-… (click “Save credential” to write ~/.dsh/.credentials.yaml)",
				credentialConfigured: "Configured (source: {source})",
				credentialMissing: "Not configured",
				saveCredential: "Save credential",
				clearCredential: "Clear credential",
				needCredentialName: "Fill in the credential name",
				needCredentialValue: "Fill in the new key value",
				downscale: "Downscale large images before calling (sharp)",
				downscaleMaxPixels: "Pixel budget",
				cache: "Answer cache (same image + question)",
				cacheTtl: "Cache TTL (seconds, 0 = never expire)",
				cacheMaxEntries: "Max cache entries",
				stripThink: "Strip reasoning blocks (<think>/reasoning)",
				localTools: "Local pixel/OCR tools (vw_*, zero-config)",
				artifactsDir: "Local tool artifact directory",
				timeout: "Request timeout (seconds)",
				test: "Test connection",
				save: "Save",
				clear: "Clear",
				saved: "Saved",
				cleared: "Config cleared",
				readFailed: "Failed to read config",
				corrupt: "Config file is corrupt — please save again",
				needBaseAndModel: "Custom provider needs a base URL and a model",
				needBaseAndModelForTest: "Fill in the custom provider base URL and model first",
				testing: "Testing…",
				testOk: "{name}: connected",
				testFail: "{name}: {message}",
				saveFailed: "Save failed",
				clearFailed: "Clear failed",
				testFailed: "Test failed",
				credentialSaveFailed: "Failed to save credential",
				credentialClearFailed: "Failed to clear credential",
				sendFailed: "Send failed",
				failed: "Failed"
			}
		};

		function apply(ctx) {
			ctx.effect(() => {
				ensureStyle();
				return () => {
					var s = document.getElementById(STYLE_ID);
					if (s) s.remove();
				};
			}, "paste-image: styles");

			ctx.inject(["slots", "sessions", "connection"], (scope) => {
				scope.slots.inject("conversation.input.right", () => scope.slots.register({
					name: "conversation.input.right",
					id: "paste-image",
					order: 20,
					inject: (sessionId) => ({
						rpc: scope.connection.rpc,
						send: (text) => {
							const actx = scope.sessions.scope(sessionId);
							const session = actx ? scope.sessions.sessionOf(actx) : undefined;
							if (!session) return Promise.reject(new Error("no session"));
							return session.prompt([{ type: "text", text }], "queue");
						}
					})
				}, PasteImageButton));
			});
		}

		function PasteImageButton(props) {
			var sessionId = props.sessionId;
			var useSessions = props.useSessions;
			var useInput = props.useInput;
			var inputActions = props.inputActions;
			var rpc = props.rpc;
			var send = props.send;

			var cwd = useSessions(function (s) {
				return s.byId && s.byId[sessionId] ? s.byId[sessionId].cwd : undefined;
			});
			var draft = useInput(function (s) { return s.draft; });

			var openState = React.useState(false);
			var open = openState[0];
			var setOpen = openState[1];
			var itemsState = React.useState([]);
			var items = itemsState[0];
			var setItems = itemsState[1];
			var busyState = React.useState(false);
			var busy = busyState[0];
			var setBusy = busyState[1];
			var sendingState = React.useState(false);
			var sending = sendingState[0];
			var setSending = sendingState[1];
			var errorState = React.useState(null);
			var error = errorState[0];
			var setError = errorState[1];
			var posState = React.useState(null);
			var pos = posState[0];
			var setPos = posState[1];
			var draggingState = React.useState(false);
			var dragging = draggingState[0];
			var setDragging = draggingState[1];

			var idRef = React.useRef(0);
			var itemsRef = React.useRef([]);
			var draftRef = React.useRef("");
			var pasteRef = React.useRef(null);
			var fileRef = React.useRef(null);
			var floatRef = React.useRef(null);
			var dragRef = React.useRef(null);
			var configOpenState = React.useState(false);
			var configOpen = configOpenState[0];
			var setConfigOpen = configOpenState[1];
			var customOpenState = React.useState(false);
			var customOpen = customOpenState[0];
			var setCustomOpen = customOpenState[1];
			var advOpenState = React.useState(false);
			var advOpen = advOpenState[0];
			var setAdvOpen = advOpenState[1];
			var emptyCustom = { baseUrl: "", model: "", apiType: "chat", credential: "", maxTokens: 0 };
			var cfgState = React.useState({
				preset: "opencode-go",
				fallbacks: [],
				custom: Object.assign({}, emptyCustom),
				language: "zh",
				downscale: true,
				downscaleMaxPixels: 4000000,
				cache: true,
				cacheTtlSeconds: 3600,
				cacheMaxEntries: 200,
				stripThink: true,
				timeoutMs: 60000,
				localTools: true,
				artifactsDir: ".dsh-vision-window/artifacts",
				presetList: [],
				credentials: {}
			});
			var cfg = cfgState[0];
			var setCfg = cfgState[1];
			var keyInputState = React.useState("");
			var keyInput = keyInputState[0];
			var setKeyInput = keyInputState[1];
			var cfgBusyState = React.useState(false);
			var cfgBusy = cfgBusyState[0];
			var setCfgBusy = cfgBusyState[1];
			var cfgStatusState = React.useState(null);
			var cfgStatus = cfgStatusState[0];
			var setCfgStatus = cfgStatusState[1];
			draftRef.current = draft;

			React.useEffect(function () {
				return function () {
					itemsRef.current.forEach(function (it) {
						if (it.objectUrl) { try { URL.revokeObjectURL(it.objectUrl); } catch (e) {} }
					});
				};
			}, []);

			React.useEffect(function () {
				if (open && pasteRef.current) pasteRef.current.focus();
			}, [open]);

			React.useEffect(function () {
				loadConfig();
			}, []);

			React.useEffect(function () {
				if (!dragging) return;
				function move(e) {
					var d = dragRef.current;
					if (!d) return;
					var left = Math.max(0, Math.min(d.left + (e.clientX - d.startX), (window.innerWidth || 0) - 60));
					var bottom = Math.max(0, Math.min(d.bottom - (e.clientY - d.startY), (window.innerHeight || 0) - 120));
					setPos({ left: left, bottom: bottom });
				}
				function up() { setDragging(false); }
				window.addEventListener("mousemove", move);
				window.addEventListener("mouseup", up);
				return function () {
					window.removeEventListener("mousemove", move);
					window.removeEventListener("mouseup", up);
				};
			}, [dragging]);

			if (!cwd || !rpc || !send || !inputActions) return null;

			function upsert(id, patch) {
				itemsRef.current = itemsRef.current.map(function (p) {
					return p.id === id ? Object.assign({}, p, patch) : p;
				});
				setItems(itemsRef.current.slice());
			}

			function removeItem(id) {
				var it = itemsRef.current.find(function (p) { return p.id === id; });
				itemsRef.current = itemsRef.current.filter(function (p) { return p.id !== id; });
				if (it && it.objectUrl) { try { URL.revokeObjectURL(it.objectUrl); } catch (e) {} }
				setItems(itemsRef.current.slice());
			}

			function clearAll() {
				itemsRef.current.forEach(function (it) {
					if (it.objectUrl) { try { URL.revokeObjectURL(it.objectUrl); } catch (e) {} }
				});
				itemsRef.current = [];
				setItems([]);
			}

			function patchCfg(patch) { setCfg(Object.assign({}, cfg, patch)); }
			function patchCustom(patch) { patchCfg({ custom: Object.assign({}, cfg.custom || emptyCustom, patch) }); }

			function mapConfig(v) {
				if (!v) return null;
				return {
					preset: v.preset || "opencode-go",
					fallbacks: Array.isArray(v.fallbacks) ? v.fallbacks.slice() : [],
					custom: {
						baseUrl: v.custom && v.custom.baseUrl ? v.custom.baseUrl : "",
						model: v.custom && v.custom.model ? v.custom.model : "",
						apiType: v.custom && v.custom.apiType ? v.custom.apiType : "chat",
						credential: v.custom && v.custom.credential ? v.custom.credential : "",
						maxTokens: v.custom && v.custom.maxTokens ? v.custom.maxTokens : 0
					},
					language: v.language === "en" ? "en" : "zh",
					downscale: v.downscale !== false,
					downscaleMaxPixels: Number.isFinite(v.downscaleMaxPixels) && v.downscaleMaxPixels > 0 ? v.downscaleMaxPixels : 4000000,
					cache: v.cache !== false,
					cacheTtlSeconds: Number.isFinite(v.cacheTtlSeconds) ? v.cacheTtlSeconds : 3600,
					cacheMaxEntries: Number.isFinite(v.cacheMaxEntries) ? v.cacheMaxEntries : 200,
					stripThink: v.stripThink !== false,
					timeoutMs: Number.isFinite(v.timeoutMs) ? v.timeoutMs : 60000,
					localTools: v.localTools !== false,
					artifactsDir: typeof v.artifactsDir === "string" && v.artifactsDir ? v.artifactsDir : ".dsh-vision-window/artifacts",
					presetList: Array.isArray(v.presetList) ? v.presetList : [],
					credentials: v.credentials && typeof v.credentials === "object" ? v.credentials : {}
				};
			}

			function presetById(id) {
				var list = cfg.presetList || [];
				for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
				return null;
			}

			function credentialRefOf(id) {
				if (id === "custom") return (cfg.custom && cfg.custom.credential) || "";
				var p = presetById(id);
				return p && p.credential ? p.credential : "";
			}

			function credStatus(ref) {
				if (!ref) return null;
				return (cfg.credentials || {})[ref] || null;
			}

			function fallbackToggled(id, checked) {
				var next = (cfg.fallbacks || []).slice();
				var i = next.indexOf(id);
				if (checked && i < 0) next.push(id);
				if (!checked && i >= 0) next.splice(i, 1);
				patchCfg({ fallbacks: next });
			}

			function numField(value, fallback) {
				var n = Number(value);
				return Number.isFinite(n) ? n : fallback;
			}

			function wireConfigPayload() {
				return {
					preset: cfg.preset,
					fallbacks: (cfg.fallbacks || []).slice(),
					custom: {
						baseUrl: (cfg.custom && cfg.custom.baseUrl ? cfg.custom.baseUrl : "").trim(),
						model: (cfg.custom && cfg.custom.model ? cfg.custom.model : "").trim(),
						apiType: cfg.custom && cfg.custom.apiType ? cfg.custom.apiType : "chat",
						credential: (cfg.custom && cfg.custom.credential ? cfg.custom.credential : "").trim(),
						maxTokens: cfg.custom && cfg.custom.maxTokens ? cfg.custom.maxTokens : 0
					},
					language: cfg.language,
					downscale: !!cfg.downscale,
					downscaleMaxPixels: numField(cfg.downscaleMaxPixels, 4000000),
					cache: !!cfg.cache,
					cacheTtlSeconds: numField(cfg.cacheTtlSeconds, 3600),
					cacheMaxEntries: numField(cfg.cacheMaxEntries, 200),
					stripThink: !!cfg.stripThink,
					timeoutMs: numField(cfg.timeoutMs, 60000),
					localTools: !!cfg.localTools,
					artifactsDir: (cfg.artifactsDir || ".dsh-vision-window/artifacts").trim()
				};
			}

			function t(key) {
				var d = STR[cfg.language] || STR.zh;
				return d[key] !== undefined ? d[key] : key;
			}

			function loadConfig() {
				if (!rpc) return;
				rpc.call(CHANNEL, "get-config", {}).then(function (res) {
					if (res && res.ok === true && res.value) {
						var mapped = mapConfig(res.value);
						if (mapped) setCfg(mapped);
						if (res.value.corrupt) setCfgStatus({ kind: "error", text: t("corrupt") });
					} else {
						setCfgStatus({ kind: "error", text: (res && res.error && res.error.message) || t("readFailed") });
					}
				}).catch(function (e) { setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			function onToggleConfig() {
				if (!configOpen) { setKeyInput(""); setCfgStatus(null); setCustomOpen(false); setAdvOpen(false); setConfigOpen(true); loadConfig(); }
				else setConfigOpen(false);
			}

			function customIsActive() {
				return cfg.preset === "custom" || (cfg.fallbacks || []).indexOf("custom") >= 0;
			}

			function onSaveConfig() {
				if (customIsActive() && (!(cfg.custom && cfg.custom.baseUrl && cfg.custom.baseUrl.trim()) || !(cfg.custom && cfg.custom.model && cfg.custom.model.trim()))) {
					setCfgStatus({ kind: "error", text: t("needBaseAndModel") });
					return;
				}
				setCfgBusy(true);
				setCfgStatus(null);
				rpc.call(CHANNEL, "set-config", wireConfigPayload()).then(function (res) {
					setCfgBusy(false);
					if (res && res.ok === true && res.value) {
						var mapped = mapConfig(res.value);
						if (mapped) setCfg(mapped);
						setKeyInput("");
						setCfgStatus({ kind: "ok", text: t("saved") });
					} else {
						setCfgStatus({ kind: "error", text: (res && res.error && res.error.message) || t("saveFailed") });
					}
				}).catch(function (e) { setCfgBusy(false); setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			function onTestConfig() {
				if (customIsActive() && (!(cfg.custom && cfg.custom.baseUrl && cfg.custom.baseUrl.trim()) || !(cfg.custom && cfg.custom.model && cfg.custom.model.trim()))) {
					setCfgStatus({ kind: "error", text: t("needBaseAndModelForTest") });
					return;
				}
				setCfgBusy(true);
				setCfgStatus({ kind: "info", text: t("testing") });
				rpc.call(CHANNEL, "test-vision", wireConfigPayload()).then(function (res) {
					setCfgBusy(false);
					var lines = [];
					var okAny = false;
					if (res && res.ok === true && res.value && Array.isArray(res.value.providers)) {
						res.value.providers.forEach(function (p) {
							if (p.ok) {
								okAny = true;
								lines.push(t("testOk", { name: p.name }));
							} else {
								lines.push(t("testFail", { name: p.name, message: p.message || t("failed") }));
							}
						});
					}
					if (okAny) setCfgStatus({ kind: "ok", text: lines.join("\n") });
					else {
						var msg = lines.length > 0 ? lines.join("\n") : (res && res.error && res.error.message) || t("testFailed");
						setCfgStatus({ kind: "error", text: msg });
					}
				}).catch(function (e) { setCfgBusy(false); setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			function onSaveCredential() {
				var ref = credentialRefOf(cfg.preset).trim();
				if (!ref) { setCfgStatus({ kind: "error", text: t("needCredentialName") }); return; }
				if (!keyInput.trim()) { setCfgStatus({ kind: "error", text: t("needCredentialValue") }); return; }
				setCfgBusy(true);
				setCfgStatus(null);
				rpc.call(CHANNEL, "set-credential", { ref: ref, value: keyInput }).then(function (res) {
					setCfgBusy(false);
					if (res && res.ok === true) {
						setKeyInput("");
						loadConfig();
						setCfgStatus({ kind: "ok", text: t("saved") });
					} else {
						setCfgStatus({ kind: "error", text: (res && res.error && res.error.message) || t("credentialSaveFailed") });
					}
				}).catch(function (e) { setCfgBusy(false); setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			function onClearCredential() {
				var ref = credentialRefOf(cfg.preset).trim();
				if (!ref) { setCfgStatus({ kind: "error", text: t("needCredentialName") }); return; }
				setCfgBusy(true);
				setCfgStatus(null);
				rpc.call(CHANNEL, "unset-credential", { ref: ref }).then(function (res) {
					setCfgBusy(false);
					if (res && res.ok === true) {
						loadConfig();
						setCfgStatus({ kind: "ok", text: t("cleared") });
					} else {
						setCfgStatus({ kind: "error", text: (res && res.error && res.error.message) || t("credentialClearFailed") });
					}
				}).catch(function (e) { setCfgBusy(false); setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			function onClearConfig() {
				setCfgBusy(true);
				setCfgStatus(null);
				rpc.call(CHANNEL, "set-config", {
					preset: "opencode-go",
					fallbacks: [],
					custom: { baseUrl: "", model: "", apiType: "chat", credential: "", maxTokens: 0 },
					language: cfg.language,
					downscale: true,
					downscaleMaxPixels: 4000000,
					cache: true,
					cacheTtlSeconds: 3600,
					cacheMaxEntries: 200,
					stripThink: true,
					timeoutMs: 60000,
					localTools: true,
					artifactsDir: ".dsh-vision-window/artifacts"
				}).then(function (res) {
					setCfgBusy(false);
					if (res && res.ok === true && res.value) {
						var mapped = mapConfig(res.value);
						if (mapped) setCfg(mapped);
						setKeyInput("");
						setCfgStatus({ kind: "ok", text: t("cleared") });
					} else {
						setCfgStatus({ kind: "error", text: (res && res.error && res.error.message) || t("clearFailed") });
					}
				}).catch(function (e) { setCfgBusy(false); setCfgStatus({ kind: "error", text: String((e && e.message) || e) }); });
			}

			async function processFiles(fileList) {
				var files = Array.from(fileList || []);
				if (files.length === 0) return;
				setBusy(true);
				setError(null);
				var todo = files.map(function (file) {
					var id = ++idRef.current;
					var objectUrl = null;
					try { objectUrl = URL.createObjectURL(file); } catch (e) {}
					var it = { id: id, name: file.name || "image", objectUrl: objectUrl, status: "saving" };
					itemsRef.current = itemsRef.current.concat([it]);
					return { file: file, it: it };
				});
				setItems(itemsRef.current.slice());

				for (var i = 0; i < todo.length; i++) {
					var pair = todo[i];
					try {
						var data = await readAsBase64(pair.file);
						var res = await rpc.call(CHANNEL, "save", { cwd: cwd, data: data });
						if (res && res.ok === true && res.value && typeof res.value.path === "string") {
							upsert(pair.it.id, { status: "done", path: res.value.path });
						} else {
							var msg = res && res.error && res.error.message ? res.error.message : t("saveFailed");
							upsert(pair.it.id, { status: "error", error: msg });
						}
					} catch (e) {
						upsert(pair.it.id, { status: "error", error: String((e && e.message) || e) });
					}
				}

				setBusy(false);
			}

			async function onRecognizeAndSend() {
				var paths = itemsRef.current
					.filter(function (it) { return it.status === "done" && it.path; })
					.map(function (it) { return it.path; });
				if (paths.length === 0) return;
				setSending(true);
				setError(null);
				try {
					var block = composeInstruction(paths);
					var d = draftRef.current;
					var text = d && d.trim().length > 0 ? block + "\n" + d : block;
					var sres = await send(text);
					if (sres && sres.ok === true) {
						inputActions.setDraft("");
						clearAll();
						setOpen(false);
					} else {
						setError((sres && sres.error && sres.error.message) || t("sendFailed"));
					}
				} catch (e) {
					setError(String((e && e.message) || e));
				} finally {
					setSending(false);
				}
			}

			function onPaste(e) {
				var files = filesFromClipboard(e);
				if (files) { e.preventDefault(); processFiles(files); }
			}
			function onDrop(e) {
				e.preventDefault();
				if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
					processFiles(e.dataTransfer.files);
				}
			}
			function onDragOver(e) { e.preventDefault(); }
			function measureComposer() {
				var card = document.querySelector("[data-composer-card]");
				if (!card) return { left: 24, bottom: 180 };
				var rect = card.getBoundingClientRect();
				var vh = window.innerHeight || 0;
				var vw = window.innerWidth || 0;
				// Default: dock to the right edge of the composer. Fall back to
				// the left side only when the right side would overflow the screen.
				var left = rect.right + 12;
				if (vw && left + 260 + 12 > vw) left = Math.max(0, rect.left - 260 - 12);
				return { left: Math.max(0, left), bottom: Math.max(0, vh - rect.bottom) };
			}
			function onToggle() {
				if (!open) {
					setPos(measureComposer());
					setOpen(true);
				} else {
					setOpen(false);
				}
			}
			function onPick() { if (fileRef.current) fileRef.current.click(); }
			function onFileChange(e) {
				processFiles(e.target.files);
				e.target.value = "";
			}
			function onHeaderMouseDown(e) {
				if (e.button !== 0) return;
				var el = floatRef.current;
				if (!el) return;
				var rect = el.getBoundingClientRect();
				dragRef.current = { startX: e.clientX, startY: e.clientY, left: rect.left, bottom: (window.innerHeight || 0) - rect.bottom };
				setDragging(true);
				e.preventDefault();
			}

			var icon = React.createElement("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
				React.createElement("rect", { x: 2, y: 2, width: 12, height: 12, rx: 2, stroke: "currentColor", strokeWidth: 1.25 }),
				React.createElement("circle", { cx: 5.6, cy: 5.6, r: 1.3, fill: "currentColor" }),
				React.createElement("path", { d: "M2.5 11.8 6 8.3l3 3 2.2-2.2 2.3 2.3", stroke: "currentColor", strokeWidth: 1.25, strokeLinejoin: "round", strokeLinecap: "round" })
			);

			var doneCount = items.filter(function (it) { return it.status === "done"; }).length;
			var floatStyle = {
				left: (pos ? pos.left : 24) + "px",
				bottom: (pos ? pos.bottom : 180) + "px"
			};

			var configEl = null;
			if (configOpen) {
				var primaryPreset = presetById(cfg.preset);
				var customActive = customIsActive();
				var activeRef = credentialRefOf(cfg.preset);
				var activeCred = credStatus(activeRef);
				var credStatusText = activeCred && activeCred.configured
					? t("credentialConfigured", { source: activeCred.source || "file" })
					: t("credentialMissing");

				var fallbackChecks = (cfg.presetList || []).filter(function (p) { return p && p.id !== cfg.preset; }).map(function (p) {
					var checked = (cfg.fallbacks || []).indexOf(p.id) >= 0;
					return React.createElement("label", { key: p.id, className: "ui-paste-image-cfg-check" }, [
						React.createElement("input", {
							key: "c",
							type: "checkbox",
							checked: checked,
							onChange: function (e) { fallbackToggled(p.id, e.target.checked); }
						}),
						React.createElement("span", { key: "s" }, p.label || p.id)
					]);
				});

				configEl = React.createElement("div", { key: "cfg", className: "ui-paste-image-cfg" }, [
					cfgRow("preset", t("preset"), React.createElement("select", { className: "ui-paste-image-cfg-input", value: cfg.preset, onChange: function (e) { patchCfg({ preset: e.target.value }); } },
						(cfg.presetList || []).map(function (p) {
							return React.createElement("option", { key: p.id, value: p.id }, p.label || p.id);
						})
					)),
					primaryPreset && primaryPreset.id !== "custom"
						? React.createElement("div", { key: "presetInfo", className: "ui-paste-image-cfg-info" },
							t("presetInfo", { baseUrl: primaryPreset.baseUrl, model: primaryPreset.model, apiType: primaryPreset.apiType }) + " · " + t("presetCredential", { credential: primaryPreset.credential }))
						: null,
					fallbackChecks.length > 0 ? React.createElement("div", { key: "fallbacks", className: "ui-paste-image-cfg-row" }, [
						React.createElement("label", { key: "l", className: "ui-paste-image-cfg-label" }, t("fallbacksLabel")),
						React.createElement("div", { key: "c", style: { display: "flex", flexDirection: "column", gap: "4px" } }, fallbackChecks)
					]) : null,
					customActive ? React.createElement("div", { key: "customBlock", style: { display: "flex", flexDirection: "column", gap: "6px" } }, [
						React.createElement("button", {
							key: "toggle",
							type: "button",
							className: "ui-paste-image-cfg-btn",
							style: { width: "100%", justifyContent: "flex-start" },
							onClick: function () { setCustomOpen(!customOpen); }
						}, (customOpen ? "▾ " : "▸ ") + t("customSection")),
						customOpen ? React.createElement("div", { key: "fields", style: { display: "flex", flexDirection: "column", gap: "6px" } }, [
							cfgRow("baseUrl", t("baseUrl"), cfgTextInput({ value: cfg.custom.baseUrl, placeholder: "https://api.example.com/v1", onChange: function (e) { patchCustom({ baseUrl: e.target.value }); } })),
							cfgRow("model", t("model"), cfgTextInput({ value: cfg.custom.model, placeholder: "gpt-4o-mini / qwen-vl-max …", onChange: function (e) { patchCustom({ model: e.target.value }); } })),
							cfgRow("apiType", t("apiType"), React.createElement("select", { className: "ui-paste-image-cfg-input", value: cfg.custom.apiType, onChange: function (e) { patchCustom({ apiType: e.target.value }); } }, [
								React.createElement("option", { key: "chat", value: "chat" }, t("apiTypeChat")),
								React.createElement("option", { key: "responses", value: "responses" }, t("apiTypeResponses")),
								React.createElement("option", { key: "completions", value: "completions" }, t("apiTypeCompletions"))
							])),
							cfgRow("maxTokens", t("maxTokens"), cfgTextInput({ type: "number", value: cfg.custom.maxTokens > 0 ? String(cfg.custom.maxTokens) : "", placeholder: t("maxTokensPlaceholder"), min: "1", onChange: function (e) { var raw = e.target.value; if (raw === "") { patchCustom({ maxTokens: 0 }); return; } var v = parseInt(raw, 10); patchCustom({ maxTokens: Number.isFinite(v) && v > 0 ? v : 0 }); } })),
							cfgRow("credentialName", t("credential"), cfgTextInput({ value: cfg.custom.credential, placeholder: "MY_VISION_API_KEY", onChange: function (e) { patchCustom({ credential: e.target.value }); } }))
						]) : null
					]) : null,
					React.createElement("div", { key: "credBlock", style: { display: "flex", flexDirection: "column", gap: "6px" } }, [
						cfgRow("credValue", t("credentialValue"), React.createElement("input", { type: "password", className: "ui-paste-image-cfg-input", value: keyInput, placeholder: t("credentialValuePlaceholder"), autoComplete: "off", onChange: function (e) { setKeyInput(e.target.value); } })),
						React.createElement("div", { key: "credActions", className: "ui-paste-image-cfg-actions" }, [
							React.createElement("button", { key: "save", type: "button", className: "ui-paste-image-cfg-btn", disabled: cfgBusy || !activeRef, onClick: onSaveCredential }, t("saveCredential")),
							React.createElement("button", { key: "clear", type: "button", className: "ui-paste-image-cfg-btn", disabled: cfgBusy || !activeRef, onClick: onClearCredential }, t("clearCredential"))
						]),
						React.createElement("div", { key: "credStatus", className: "ui-paste-image-cfg-info" }, activeRef ? activeRef + " · " + credStatusText : t("credential"))
					]),
					React.createElement("div", { key: "advBlock", style: { display: "flex", flexDirection: "column", gap: "6px" } }, [
						React.createElement("button", {
							key: "toggle",
							type: "button",
							className: "ui-paste-image-cfg-btn",
							style: { width: "100%", justifyContent: "flex-start" },
							onClick: function () { setAdvOpen(!advOpen); }
						}, (advOpen ? "▾ " : "▸ ") + t("advSection")),
						advOpen ? React.createElement("div", { key: "fields", style: { display: "flex", flexDirection: "column", gap: "6px" } }, [
							React.createElement("label", { key: "downscale", className: "ui-paste-image-cfg-check" }, [
								React.createElement("input", { type: "checkbox", checked: !!cfg.downscale, onChange: function (e) { patchCfg({ downscale: e.target.checked }); } }),
								React.createElement("span", null, t("downscale"))
							]),
							cfg.downscale ? cfgRow("downscaleMaxPixels", t("downscaleMaxPixels"), cfgTextInput({ type: "number", value: String(cfg.downscaleMaxPixels), min: "1000", step: "100000", onChange: function (e) { patchCfg({ downscaleMaxPixels: numField(e.target.value, 4000000) }); } })) : null,
							React.createElement("label", { key: "cache", className: "ui-paste-image-cfg-check" }, [
								React.createElement("input", { type: "checkbox", checked: !!cfg.cache, onChange: function (e) { patchCfg({ cache: e.target.checked }); } }),
								React.createElement("span", null, t("cache"))
							]),
							cfg.cache ? cfgRow("cacheTtl", t("cacheTtl"), cfgTextInput({ type: "number", value: String(cfg.cacheTtlSeconds), min: "0", onChange: function (e) { patchCfg({ cacheTtlSeconds: numField(e.target.value, 3600) }); } })) : null,
							cfg.cache ? cfgRow("cacheMaxEntries", t("cacheMaxEntries"), cfgTextInput({ type: "number", value: String(cfg.cacheMaxEntries), min: "1", onChange: function (e) { patchCfg({ cacheMaxEntries: numField(e.target.value, 200) }); } })) : null,
							React.createElement("label", { key: "stripThink", className: "ui-paste-image-cfg-check" }, [
								React.createElement("input", { type: "checkbox", checked: !!cfg.stripThink, onChange: function (e) { patchCfg({ stripThink: e.target.checked }); } }),
								React.createElement("span", null, t("stripThink"))
							]),
							cfgRow("timeout", t("timeout"), cfgTextInput({ type: "number", value: String(cfg.timeoutMs), min: "1", onChange: function (e) { patchCfg({ timeoutMs: numField(e.target.value, 60000) }); } })),
							React.createElement("label", { key: "localTools", className: "ui-paste-image-cfg-check" }, [
								React.createElement("input", { type: "checkbox", checked: !!cfg.localTools, onChange: function (e) { patchCfg({ localTools: e.target.checked }); } }),
								React.createElement("span", null, t("localTools"))
							]),
							cfgRow("artifactsDir", t("artifactsDir"), cfgTextInput({ value: cfg.artifactsDir || ".dsh-vision-window/artifacts", onChange: function (e) { patchCfg({ artifactsDir: e.target.value }); } }))
						]) : null
					]),
					cfgRow("language", t("language"), React.createElement("select", { className: "ui-paste-image-cfg-input", value: cfg.language, onChange: function (e) { patchCfg({ language: e.target.value }); } }, [
						React.createElement("option", { key: "zh", value: "zh" }, t("langZh")),
						React.createElement("option", { key: "en", value: "en" }, t("langEn"))
					])),
					React.createElement("div", { key: "actions", className: "ui-paste-image-cfg-actions" }, [
						React.createElement("button", { key: "test", type: "button", className: "ui-paste-image-cfg-btn", disabled: cfgBusy, onClick: onTestConfig }, t("test")),
						React.createElement("button", { key: "save", type: "button", className: "ui-paste-image-cfg-btn ui-paste-image-cfg-btn-primary", disabled: cfgBusy, onClick: onSaveConfig }, t("save")),
						React.createElement("button", { key: "clear", type: "button", className: "ui-paste-image-cfg-btn", disabled: cfgBusy, onClick: onClearConfig }, t("clear"))
					]),
					cfgStatus ? React.createElement("div", { key: "status", className: "ui-paste-image-cfg-status", "data-kind": cfgStatus.kind }, cfgStatus.text) : null
				]);
			}

			var buttonEl = React.createElement("div", { className: "ui-paste-image-root" },
				React.createElement("button", {
					type: "button",
					className: "ui-paste-image-btn",
					tabIndex: 0,
					disabled: busy,
					onClick: onToggle,
					title: t("btnTitle")
				}, [
					icon,
					React.createElement("span", { key: "label" }, busy ? t("btnSaving") : t("btnRecognize"))
				])
			);

			var floatingEl = null;
			if (open) {
				floatingEl = ReactDOM.createPortal(
					React.createElement("div", { className: "ui-paste-image-float", ref: floatRef, style: floatStyle }, [
						React.createElement("div", { key: "head", className: "ui-paste-image-float-head", onMouseDown: onHeaderMouseDown }, [
							React.createElement("span", { key: "t" }, t("boxTitle")),
							React.createElement("div", { key: "tools", style: { display: "flex", gap: "2px" }, onMouseDown: function (e) { e.stopPropagation(); } }, [
								React.createElement("button", { key: "gear", type: "button", className: "ui-paste-image-float-gear", onClick: onToggleConfig, title: t("cfgTitle") }, "\u2699\uFE0E"),
								React.createElement("button", { key: "close", type: "button", className: "ui-paste-image-float-close", onClick: function () { setOpen(false); }, title: t("close") }, "\u00d7")
							])
						]),
						configEl,
						React.createElement("textarea", {
							key: "paste",
							ref: pasteRef,
							className: "ui-paste-image-paste",
							readOnly: true,
							rows: 2,
							placeholder: t("pastePlaceholder"),
							onPaste: onPaste,
							onDrop: onDrop,
							onDragOver: onDragOver
						}),
						items.length > 0 ? React.createElement("div", { key: "thumbs", className: "ui-paste-image-float-thumbs" },
							items.map(function (it) {
								return React.createElement("div", {
									key: it.id,
									className: "ui-paste-image-thumb",
									"data-status": it.status,
									title: it.status === "error" ? (it.error || t("failed")) : (it.path || it.name)
								}, [
									it.objectUrl ? React.createElement("img", { key: "img", src: it.objectUrl, alt: it.name }) : null,
									React.createElement("button", {
										key: "x",
										type: "button",
										className: "ui-paste-image-remove",
										onClick: function () { removeItem(it.id); },
										title: t("remove")
									}, "\u00d7")
								]);
							})
						) : null,
						React.createElement("div", { key: "actions", className: "ui-paste-image-float-actions" }, [
							React.createElement("button", { key: "pick", type: "button", className: "ui-paste-image-float-pick", onClick: onPick }, t("pick")),
							React.createElement("button", {
								key: "go",
								type: "button",
								className: "ui-paste-image-float-go",
								"data-ready": doneCount > 0 ? "true" : "false",
								disabled: sending || doneCount === 0,
								onClick: onRecognizeAndSend,
								title: t("goTitle")
							}, [
								React.createElement("span", { key: "label" }, sending ? t("sending") : t("go")),
								React.createElement("svg", { key: "icon", viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
									React.createElement("path", { d: "M3 8h9.5", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }),
									React.createElement("path", { d: "M8.8 3.8 13 8l-4.2 4.2", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
								)
							])
						]),
						error ? React.createElement("div", { key: "err", className: "ui-paste-image-float-err" }, error) : null,
						React.createElement("input", {
							key: "file",
							ref: fileRef,
							type: "file",
							accept: "image/*",
							multiple: true,
							style: { display: "none" },
							onChange: onFileChange
						})
					]),
					document.body
				);
			}

			return React.createElement(React.Fragment, null, buttonEl, floatingEl);
		}

		exports.apply = apply;
		return module.exports;
	}
});
