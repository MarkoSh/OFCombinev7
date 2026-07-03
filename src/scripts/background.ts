console.log('[BACKGROUND] OFCombine v7');

async function inject(extensionRootUrl) {
	if (window['hasBeenInjected']) return;

	window['hasBeenInjected'] = true;

	console.log('[INJECT] OFCombine v7');

	class RequestQueue {
		queue: Promise<void>;

		constructor() {
			this.queue = Promise.resolve();
		}

		async add(fn: any) {
			const $this = this;

			$this.queue = $this.queue.then(fn, fn);

			return $this.queue;
		}
	}

	window['queue'] = new RequestQueue();
	interface HashCache {
		[userId: number]: Promise<string>;
	}

	interface FetchOptions extends RequestInit {
		headers?: Record<string, string>;
	}

	interface GenerateOptions {
		timestamp?: number;
	}

	function shuffle(array) {
		for (let i = array.length - 1; i > 0; i--) {
			// Pick a random index from 0 to i
			const j = Math.floor(Math.random() * (i + 1));
			// Swap elements array[i] and array[j]
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	const og: any = document.querySelector('[property="og:image"]');

	if (og) {
		const { content } = og;

		window['REV'] = content.match(/(\d{10,}-[a-f0-9]+)/)?.[1] || null;
	}

	class OFSignClient {
		private readonly SECRET = "Z0XSvSCtKAY7vwuMyCrNyXXMfnKTSJjE";
		private readonly TOKEN = "33d57ade8c02dbc5a333db99ff9ae26a";
		private readonly REV = window['REV'] || "202605221325-1a7b51904a";
		private readonly BASE = "https://onlyfans.com";

		private hashCache: HashCache = {};
		private xbc: string | null = null;
		private _userId: number | null = null;

		private encode(h: string): string {
			const idx: [number, number][] = [[59437, -102], [59760, -83], [58741, -88], [57821, 113], [58108, 130], [59693, 129], [59348, -75], [58482, -139], [59293, 147], [58560, 78], [58273, 89], [59502, -79], [59961, 143], [58674, 132], [59175, -126], [60180, 68], [58361, 113], [60270, 104], [60044, -95], [57580, 118], [57654, 96], [58939, -104], [59843, -86], [57474, -71], [60132, 92], [58185, -86], [59056, -133], [58006, 132], [57896, -83], [58862, -135], [57737, -92], [59577, -100]];
			return Math.abs(idx.reduce((s, [i, o]) => s + h.charCodeAt(i % 40) + o, 0)).toString(16);
		}

		private async sha1(str: string): Promise<string> {
			const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
			return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
		}

		private getXbc(): string {
			if (this.xbc !== null) {
				return this.xbc;
			}
			const xbc = localStorage.getItem('bcTokenSha');
			return xbc ? xbc : '';
		}

		private getUserId(): number {
			if (this._userId !== null) {
				return this._userId;
			}
			const authId = localStorage.getItem('user');
			return authId ? parseInt(authId, 10) : 0;
		}

		private getHash(userId: number): Promise<string> {
			if (!userId) return Promise.resolve('');
			if (!this.hashCache[userId]) {
				this.hashCache[userId] = fetch(`https://cdn2.onlyfans.com/hash/?u=${userId}`)
					.then(r => r.text());
			}
			return this.hashCache[userId];
		}

		// Ручная установка (опционально)
		setXbc(xbc: string | null): void {
			this.xbc = xbc;
		}
		setUser(userId: number): void {
			this._userId = userId;
		}

		clearCache(): void {
			this.hashCache = {};
			this.xbc = null;
			this._userId = null;
		}

		async generateHeaders(path: string, options: GenerateOptions = {}): Promise<Record<string, string>> {
			const userId = this.getUserId();
			const time = options.timestamp ?? Date.now();
			const params = `${this.SECRET}\n${time}\n${path}\n${userId}`;
			const hash = await this.sha1(params);
			const sign = `57405:${hash}:${this.encode(hash)}:69d50ddb`;

			const headers: Record<string, string> = {
				'app-token': this.TOKEN,
				'x-of-rev': this.REV,
				'x-bc': this.getXbc(),
				'time': String(time),
				'sign': sign
			};

			if (userId) {
				headers['user-id'] = String(userId);
				headers['x-hash'] = await this.getHash(userId);
			}

			return headers;
		}

		async debug(path: string, timestamp?: number): Promise<void> {
			const userId = this.getUserId();
			const time = timestamp ?? Date.now();
			const params = `${this.SECRET}\n${time}\n${path}\n${userId}`;
			const hash = await this.sha1(params);

			console.log('=== DEBUG ===');
			console.log('userId:', userId, this._userId ? '(manual)' : '(from cookie)');
			console.log('Params:');
			console.log(params);
			console.log('SHA1:', hash);
			console.log('Sign:', `57405:${hash}:${this.encode(hash)}:69d50ddb`);
		}

		async fetch(path: string, options: FetchOptions = {}): Promise<Response> {
			return new Promise((resolve, reject) => {
				const url = this.BASE + path;

				const observer = async () => {
					const signHeaders = await this.generateHeaders(path);

					const response = await fetch(url, {
						...options,
						headers: {
							'accept': 'application/json, text/plain, */*',
							...options.headers,
							...signHeaders
						}
					});

					if (429 === response.status) {
						setTimeout(observer, 1000);

						return;
					}

					resolve(response);
				};

				observer();
			});
		}

		async get(path: string): Promise<Response> {
			return this.fetch(path, { method: 'GET' });
		}

		async post<T>(path: string, body: T): Promise<Response> {
			return this.fetch(path, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(body)
			});
		}

		async put<T>(path: string, body: T): Promise<Response> {
			return this.fetch(path, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(body)
			});
		}

		async json<T = unknown>(path: string): Promise<T> {
			const resp = await this.get(path);
			return resp.json();
		}
	}

	class WorkerTimeout {
		worker: any = null;
		constructor(callback, timeout) {
			const $this = this;
			const blob = new Blob([`setTimeout(() => postMessage(0), ${timeout});`]);
			const workerScript = URL.createObjectURL(blob);
			$this.worker = new Worker(workerScript);
			$this.worker.onmessage = () => {
				callback();
				$this.worker.terminate();
			};
		}
		stop() {
			const $this = this;
			$this.worker.terminate();
		}
	}

	const OFSign = new OFSignClient();

	window['ofsign'] = OFSign;

	class OFCombine {
		app: any = false;
		users: Map<number, any> = new Map();
		vault: Map<number, Map<number, any>> = new Map();

		modals: any = {};

		currentChatId = 0;

		constructor(app) {
			const $this = this;

			$this.app = app;

			$this.init();

			$this.showToast('Injected');
		}

		init() {
			const $this = this;

			$this.fetchModals();

			$this.applyStyle();

			$this.handler();

			$this.notoficationsHandler();

			$this.statisticsEngagementMessagesHandler();

			$this.massDMPageHandler();

			$this.forwardHandler();

			$this.chatsHandler();

			$this.chatHandler();

			$this.notificationsUsersTable();

			$this.chatsUsersTable();

			$this.listUsersTable();

			$this.chatFooterHandler();
		}

		statisticsEngagementMessagesHandler() {
			const $this = this;

			const observer = () => {
				const { name } = $this.app.route.to;

				if ('StatisticsEngagementMessages' == name) {
					const statistic__btns = document.querySelectorAll('.b-top-statistic__btns');

					statistic__btns.forEach((statistic__btns) => {
						const forwardBtn = statistic__btns.querySelector('.forward-btn');

						if (!forwardBtn) {
							const button = <HTMLButtonElement>statistic__btns.querySelector('button');

							if (button) {
								const forwardBtn = document.createElement('a');

								const classes = button.getAttribute('class') || '';

								forwardBtn.setAttribute('class', classes);

								forwardBtn.classList.add('forward-btn');

								forwardBtn.innerHTML = 'Forward';

								button.before(forwardBtn);

								forwardBtn.href = '#';

								forwardBtn.target = '_blank';

								forwardBtn.onclick = e => {
									const row: any = forwardBtn.closest('tr');

									if (row) {
										const { __vue__: vue } = row;

										const { item } = vue;

										const { id: scheduleMessageId } = item;

										const link = `https://onlyfans.com/my/chats/send?scheduleMessageId=${scheduleMessageId}#forward`;

										forwardBtn.href = link;
									}
								};
							}
						}
					});

					const btns_group = document.querySelector('.b-btns-group.m-move-right');

					if (btns_group) {
						const export_ppvs = btns_group.querySelector('[id="export_ppvs"]');

						if (!export_ppvs) {
							const support = btns_group.querySelector('[href="/my/statements/support"]');

							if (support) {
								const export_ppvs = <HTMLAnchorElement>support.cloneNode(true);

								export_ppvs.id = 'export_ppvs';

								export_ppvs.innerHTML = export_ppvs.innerHTML.replace(/icon\-support/g, 'icon-download');

								support.after(export_ppvs);

								export_ppvs.onclick = e => {
									e.preventDefault();

									const wnd = window.open(`about:blank#ppvs`);

									if (wnd) {
										const document = wnd.document;

										document.title = 'PPVs';

										const script = <HTMLScriptElement>document.createElement('script');

										script.type = 'text/javascript';

										script.src = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js';

										document.head.appendChild(script);

										script.onload = async (e) => {
											const Handsontable = wnd['Handsontable'];

											const hot = new Handsontable(container, {
												data: [],
												colHeaders: [
													'id',
													'date',
													'rawText',
													'isFree',
													'isCanceled',
													'price',
													'sentCount',
													'viewedCount',
													'purchasedCount',
													'forwardLink',
												],
												columns: [
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
												],
												columnSorting: true,
												filters: true,
												dropdownMenu: true,
												rowHeaders: true,
												height: 'auto',
												autoWrapRow: true,
												autoWrapCol: true,
												licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
											});

											const { authUser } = $this.app;

											const { joinDate } = authUser;

											const joinDate__date = new Date(joinDate);

											joinDate__date.setHours(0);
											joinDate__date.setMinutes(0);
											joinDate__date.setSeconds(0);

											const startDate = joinDate__date;

											let endDate = new Date();

											let step = 0;

											const observer = async () => {
												const response = await $this.fetchEngagementMessages('group', startDate, endDate);

												const { hasMore, items } = response;

												const item = items.at(-1);

												const { date } = item;

												endDate = new Date(date);

												const filtered = new Map();

												items.map((item) => {
													const { rawText } = item;

													filtered.set(rawText ? rawText.slice(0, 50) : Math.random(), item);
												});

												const values = [...filtered.values()];

												const current = hot.getData();

												const data = current.concat(values.map(item => {
													const {
														id,
														date,
														rawText,
														isFree,
														isCanceled,
														price,
														sentCount,
														viewedCount,
														purchasedCount,
													} = item;

													const result = [
														id,
														date,
														50 < rawText.length ? `${rawText.slice(0, 50)}...` : rawText,
														isFree,
														isCanceled,
														price,
														sentCount,
														viewedCount,
														purchasedCount,
														`https://onlyfans.com/my/chats/send?scheduleMessageId=${id}#forward`,
													];

													return result;
												}));

												hot.updateData(data);

												step++;

												if (!hasMore || 2 < step) {
													wnd.alert('PPVs loaded');

													return;
												}

												setTimeout(observer, 100);
											};

											observer();
										};

										const container = document.createElement('div');

										container.id = 'container';

										document.body.appendChild(container);
									}

									return true;
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		formatDateTime(date) {
			const formatter = new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false // Ensures 24-hour format (HH)
			});

			// Map parts array into a clean key-value object
			const parts: any = formatter.formatToParts(date).reduce((acc, part) => {
				acc[part.type] = part.value;
				return acc;
			}, {});

			// Construct the target string structure
			return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
		}

		async fetchEngagementMessages(type: string = 'group', startDate: Date, endDate: Date) {
			const $this = this;

			const BASE_PATH = `/api2/v2/users/me/stats/messages/${type}`;

			const PARAMS = `startDate=${encodeURI($this.formatDateTime(startDate))}&endDate=${encodeURI($this.formatDateTime(endDate))}&limit=100`;

			const path = `${BASE_PATH}?${PARAMS}`;

			const response = await queue.add(async () => await OFSign.get(path));

			return await response.json();
		}

		notoficationsHandler() {
			const $this = this;

			const observer = () => {
				const notifications__list = document.querySelector('.b-notifications__list');

				if (notifications__list) {
					const notification_items = notifications__list.querySelectorAll('[at-attr="notification_item"]');

					notification_items.forEach((notification_item: any) => {
						const { __vue__: vue } = notification_item;

						const fast_message_chat = notification_item.querySelector('.fast-message-chat');

						if (!fast_message_chat) {
							const fast_message_chat = document.createElement('button');

							fast_message_chat.setAttribute('class', 'g-btn m-with-round-hover m-icon m-icon-only m-gray m-sm-size attach_file has-tooltip');

							fast_message_chat.classList.add('fast-message-chat');

							fast_message_chat.innerHTML = '💬';

							fast_message_chat.title = 'Fast message';

							notification_item.appendChild(fast_message_chat);

							fast_message_chat.onclick = async (e) => {
								const { id: notificationId, user } = vue;

								const { id: userId, avatar, name, username } = user;

								const div = document.createElement('div');

								div.innerHTML = $this.modals['fast_message']

								div.innerHTML = div.innerHTML.replace(/{USERID}/g, userId);
								div.innerHTML = div.innerHTML.replace(/{NAME}/g, name);
								div.innerHTML = div.innerHTML.replace(/{USERNAME}/g, username);

								const modal = <HTMLElement>div.firstChild;

								if (modal) {
									document.body.appendChild(modal);

									const previous_messages = modal.querySelector('.previous-messages');

									if (previous_messages) {
										const messages = <Map<number, any>>await $this.fetchMessages(userId);

										previous_messages.classList.remove('text-center');

										previous_messages.innerHTML = '';

										let prevMessageUserId = 0;

										[...messages.values()].reverse().map((message: any) => {
											const { fromUser, text } = message;

											const { id: messageUserId } = fromUser;

											const avatar_ = (() => {
												if (messageUserId == $this.app.authUserId) {
													return $this.app.authUser.avatar;
												}

												return avatar ?? `https://static2.onlyfans.com/static/prod/f/${window['REV']}/icons/android-chrome-144x144.png`;
											})();

											const name_ = (() => {
												if (messageUserId == $this.app.authUserId) {
													return $this.app.authUser.name;
												}

												return name;
											})();

											debugger;

											prevMessageUserId = messageUserId;
										});

										previous_messages.scrollTop = previous_messages.scrollHeight;
									}
								}
							};
						}
					});
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		chatFooterHandler() {
			const $this = this;

			const observer = () => {
				const chat_footer: any = document.querySelector('.m-chat-footer');

				if (chat_footer) {
					const { __vue__: vue } = chat_footer;

					const { resetToDefault } = vue;

					const send_btn = chat_footer.querySelector('[at-attr="send_btn"]');

					const reset_btn = chat_footer.querySelector('[at-attr="reset_btn"]');

					if (send_btn && !reset_btn) {
						const reset_btn = <HTMLButtonElement>send_btn.cloneNode(true);

						reset_btn.setAttribute('at-attr', 'reset_btn');

						reset_btn.disabled = false;

						reset_btn.innerHTML = 'Reset';

						send_btn.before(reset_btn);

						reset_btn.onclick = e => {
							resetToDefault();
						};
					}

					const { name } = $this.app.route.to;

					if ('Chat' == name) {
						const post__actions__btns = chat_footer.querySelector('.b-make-post__actions__btns');

						if (post__actions__btns) {
							const attach_file_photo = chat_footer.querySelector('[id="attach_file_photo"]');

							const export_chat = chat_footer.querySelector('[id="export_chat"]');

							if (attach_file_photo && !export_chat) {
								const export_chat = <HTMLButtonElement>attach_file_photo.cloneNode(true);

								export_chat.id = 'export_chat';

								export_chat.innerHTML = export_chat.innerHTML.replaceAll('icon-media', 'icon-download');

								post__actions__btns.appendChild(export_chat);

								export_chat.onclick = e => {
									$this.exportCurrentChat();
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		exportCurrentChat() {
			const $this = this;

			$this.showToast(`Exporting chat ${$this.currentChatId}...`);

			let fromId = 0;

			let size = 0;

			let exported = new Map();

			const observer = async () => {
				const messages = <Map<number, any>>await $this.fetchMessages($this.currentChatId, fromId, 100);

				if (messages.size) {
					const message = [...messages.values()].at(-1);

					const { createdAt } = message;

					exported = new Map([...exported, ...messages]);

					size += messages.size;

					$this.showToast(`Collected messages for chat ${$this.currentChatId}: ${size} for date ${createdAt}`);

					fromId = [...messages.keys()].at(-1) || 0;
				} else {
					$this.showToast(`Exporting chat ${$this.currentChatId}...done`);

					if (1000 < exported.size) {
						const entries = Array.from(exported.entries());

						for (let i = 0; i < exported.size; i += 1000) {
							const chunk = new Map(entries.slice(i, i + 1000));

							const data = JSON.stringify(Object.fromEntries(chunk));

							const gz = await $this.compress(data);

							const blob = new Blob([gz], { type: "application/gzip" });

							const link = document.createElement("a");
							link.href = URL.createObjectURL(blob);
							link.download = `export_chat_${$this.currentChatId}_part${i + 1}.json.gz`;

							link.click();
						}
					} else {
						const data = JSON.stringify(Object.fromEntries(exported));

						const gz = await $this.compress(data);

						const blob = new Blob([gz], { type: "application/gzip" });

						const link = document.createElement("a");
						link.href = URL.createObjectURL(blob);
						link.download = `export_chat_${$this.currentChatId}.json.gz`;

						link.click();
					}

					return;
				}

				new WorkerTimeout(observer, 100);
			};

			observer();
		}

		async compress(data: string, encoding: 'gzip' | 'deflate' = 'gzip'): Promise<ArrayBuffer> {
			const byteArray = new TextEncoder().encode(data);

			// Создаем поток из наших байтов
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(byteArray);
					controller.close();
				}
			});

			// Прогоняем через CompressionStream
			const compressionStream = new CompressionStream(encoding);
			const compressedStream = stream.pipeThrough(compressionStream);

			// Читаем результат как ArrayBuffer через Response
			return await new Response(compressedStream).arrayBuffer();
		};

		listUsersTable() {
			const $this = this;

			const observer = () => {
				const { route } = $this.app;

				const { to } = route;

				const { name } = to;

				if ([
					'SubscribersByType',
					'SubscribesByType',
					'MyFriends',
					'CustomList'
				].includes(name)) {
					const btns_group = document.querySelector('.l-main-content.m-r-side .b-btns-group.m-move-right');

					if (btns_group) {
						const btn_export = btns_group.querySelector('[id="export"]');

						if (!btn_export) {
							const btn = btns_group.querySelector('.g-btn');

							if (btn) {
								const btn_export = <HTMLAnchorElement>btn.cloneNode(true);

								btn_export.href = '#';

								btn_export.id = 'export';

								btn_export.setAttribute('aria-label', 'Export list');

								btn_export.innerHTML = btn_export.innerHTML.replace(/icon-([a-z\-]+)/g, 'icon-download');

								btns_group.appendChild(btn_export);

								btn_export.onclick = e => {
									e.preventDefault();

									const { route } = $this.app;

									const { to } = route;

									const { name, params } = to;

									const { list: listId, title } = params;

									const listId_ = (() => {
										if ('SubscribersByType' == name) return 'fans';
										if ('SubscribesByType' == name) return 'following';

										return listId;
									})();

									const wnd = window.open(`about:blank#${listId_}`);

									if (wnd) {
										const document = wnd.document;

										document.title = title || listId_;

										const script = <HTMLScriptElement>document.createElement('script');

										script.type = 'text/javascript';

										script.src = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js';

										document.head.appendChild(script);

										script.onload = async (e) => {
											const Handsontable = wnd['Handsontable'];

											const hot = new Handsontable(container, {
												data: [],
												colHeaders: [
													'id',
													'canReceiveChatMessage',
													'suggestedName',
													'displayName',
													'name',
													'username',
													'notice',
													'profileLink',
													'subscribeAt',
													'lastSeen',
													'totalSum',
													'expired',
													'chatLink',
													'isRealPerformer',
												],
												columns: [
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
												],
												columnSorting: true,
												filters: true,
												dropdownMenu: true,
												rowHeaders: true,
												height: 'auto',
												autoWrapRow: true,
												autoWrapCol: true,
												licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
											});

											hot.addHook('afterChange', (rows, amount) => {
												if (rows) {
													rows.map(row => {
														const [rowNum, _, __, value] = row;

														const data = hot.getDataAtRow(rowNum);

														const userId = data[0];
														const displayName = data[3];

														$this.setName(userId, displayName);
													});
												}
											});

											let offset = 0;

											const observer = async () => {
												const usersListUsers = await $this.fetchUsersListUsers(listId_, offset);

												const { list, hasMore, nextOffset } = usersListUsers;

												const users = new Map();

												list.map(user => {
													users.set(user.id, false);
												});

												await $this.getUsersByIds(users, true);

												const current = hot.getData();

												const data = current.concat([...users.values()].map(user => {
													const {
														id: userId,
														canReceiveChatMessage,
														displayName,
														name,
														username,
														notice,
														lastSeen,
														subscribedOnExpiredNow,
														isRealPerformer,
														subscribedOnData,
													} = user;

													const suggestedName = $this.getCleanName(displayName || name || username || "");

													const profileLink = `https://onlyfans.com/${username}`;
													const chatLink = `https://onlyfans.com/my/chats/chat/${userId}/?q=${username}`;

													const [subscribeAt, totalSumm] = (() => {
														if (subscribedOnData) {
															const { subscribeAt, totalSumm } = subscribedOnData;

															return [subscribeAt, totalSumm]
														}

														return [];
													})();

													return [
														userId,
														canReceiveChatMessage,
														suggestedName,
														displayName,
														name,
														username,
														notice,
														profileLink,
														subscribeAt,
														lastSeen,
														totalSumm,
														subscribedOnExpiredNow,
														chatLink,
														isRealPerformer,
													];
												}));

												hot.updateData(data);

												offset = nextOffset;

												if (!hasMore) {
													wnd.alert('List loaded');

													return;
												}

												setTimeout(observer, 100);
											};

											observer();
										};

										const container = document.createElement('div');

										container.id = 'container';

										document.body.appendChild(container);
									}

									return true;
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		chatsUsersTable() {
			const $this = this;

			const observer = () => {
				const { isChatPage } = $this.app;

				if (isChatPage) {
					const btns_group = document.querySelector('.b-btns-group.m-move-right');

					if (btns_group) {
						const btn_export = btns_group.querySelector('[id="export"]');

						if (!btn_export) {
							const btn = btns_group.querySelector('[href="/my/chats/send"]');

							if (btn) {
								const btn_export = <HTMLAnchorElement>btn.cloneNode(true);

								btn_export.href = '#';

								btn_export.id = 'export';

								btn_export.setAttribute('aria-label', 'Export priority inbox');

								btn_export.innerHTML = btn_export.innerHTML.replaceAll('icon-add', 'icon-download');

								btns_group.appendChild(btn_export);

								btn_export.onclick = e => {
									e.preventDefault();

									const wnd = window.open('about:blank#inbox');

									if (wnd) {
										const document = wnd.document;

										document.title = 'Inbox';

										const script = <HTMLScriptElement>document.createElement('script');

										script.type = 'text/javascript';

										script.src = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js';

										document.head.appendChild(script);

										script.onload = async (e) => {
											const Handsontable = wnd['Handsontable'];

											const hot = new Handsontable(container, {
												data: [],
												colHeaders: [
													'id',
													'canReceiveChatMessage',
													'suggestedName',
													'displayName',
													'name',
													'username',
													'notice',
													'profileLink',
													'subscribeAt',
													'lastSeen',
													'totalSum',
													'expired',
													'chatLink',
													'isRealPerformer',
												],
												columns: [
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
												],
												columnSorting: true,
												filters: true,
												dropdownMenu: true,
												rowHeaders: true,
												height: 'auto',
												autoWrapRow: true,
												autoWrapCol: true,
												licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
											});

											hot.addHook('afterChange', (rows, amount) => {
												if (rows) {
													rows.map(row => {
														const [rowNum, _, __, value] = row;

														const data = hot.getDataAtRow(rowNum);

														const userId = data[0];
														const displayName = data[3];

														$this.setName(userId, displayName);
													});
												}
											});

											let offset = 0;

											const observer = async () => {
												const chats = await $this.fetchChats(offset);

												const { list, hasMore } = chats;

												const users = new Map();

												list.map(chat => {
													users.set(chat.withUser.id, false);
												});

												await $this.getUsersByIds(users, true);

												const current = hot.getData();

												const data = current.concat([...users.values()].map(user => {
													const {
														id: userId,
														canReceiveChatMessage,
														displayName,
														name,
														username,
														notice,
														lastSeen,
														subscribedOnExpiredNow,
														isRealPerformer,
														subscribedOnData,
													} = user;

													const suggestedName = $this.getCleanName(displayName || name || username || "");

													const profileLink = `https://onlyfans.com/${username}`;
													const chatLink = `https://onlyfans.com/my/chats/chat/${userId}/?q=${username}`;

													const [subscribeAt, totalSumm] = (() => {
														if (subscribedOnData) {
															const { subscribeAt, totalSumm } = subscribedOnData;

															return [subscribeAt, totalSumm]
														}

														return [];
													})();

													return [
														userId,
														canReceiveChatMessage,
														suggestedName,
														displayName,
														name,
														username,
														notice,
														profileLink,
														subscribeAt,
														lastSeen,
														totalSumm,
														subscribedOnExpiredNow,
														chatLink,
														isRealPerformer,
													];
												}));

												hot.updateData(data);

												offset += 10;

												if (!hasMore) {
													wnd.alert('List loaded');

													return;
												}

												setTimeout(observer, 100);
											};

											observer();
										};

										const container = document.createElement('div');

										container.id = 'container';

										document.body.appendChild(container);
									}

									return true;
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		notificationsUsersTable() {
			const $this = this;

			const observer = () => {
				const { name } = $this.app.route.to;

				if (['Notifications', 'NotificationsByType'].includes(name)) {
					const btns_group = document.querySelector('.b-btns-group.m-notifications-user-search');

					if (btns_group) {
						const btn_export = btns_group.querySelector('[id="export"]');

						if (!btn_export) {
							const btn = btns_group.querySelector('[href="/my/settings/notifications/"]');

							if (btn) {
								const btn_export = <HTMLAnchorElement>btn.cloneNode(true);

								btn_export.href = '#';

								btn_export.id = 'export';

								btn_export.setAttribute('aria-label', 'Export notifications users');

								btn_export.innerHTML = btn_export.innerHTML.replaceAll('icon-settings', 'icon-download');

								btns_group.appendChild(btn_export);

								btn_export.onclick = e => {
									e.preventDefault();

									const { params } = $this.app.route.to;

									const { type } = params;

									const wnd = window.open('about:blank#notifications');

									if (wnd) {
										const document = wnd.document;

										document.title = `Notifications${type ? ` - ${type}` : ''}`;

										const script = <HTMLScriptElement>document.createElement('script');

										script.type = 'text/javascript';

										script.src = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js';

										document.head.appendChild(script);

										script.onload = async (e) => {
											const Handsontable = wnd['Handsontable'];

											const hot = new Handsontable(container, {
												data: [],
												colHeaders: [
													'id',
													'canReceiveChatMessage',
													'suggestedName',
													'displayName',
													'name',
													'username',
													'notice',
													'profileLink',
													'subscribeAt',
													'lastSeen',
													'totalSum',
													'expired',
													'chatLink',
													'isRealPerformer',
												],
												columns: [
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
													{},
												],
												columnSorting: true,
												filters: true,
												dropdownMenu: true,
												rowHeaders: true,
												height: 'auto',
												autoWrapRow: true,
												autoWrapCol: true,
												licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
											});

											hot.addHook('afterChange', (rows, amount) => {
												if (rows) {
													rows.map(row => {
														const [rowNum, _, __, value] = row;

														const data = hot.getDataAtRow(rowNum);

														const userId = data[0];
														const displayName = data[3];

														$this.setName(userId, displayName);
													});
												}
											});

											let fromId = 0;

											const observer = async () => {
												const notifications = await $this.fetchNotifications(fromId, type);

												const { list, hasMore } = notifications;

												const users = new Map();

												list.map(notification => {
													const { user } = notification;

													const { id: userId } = user;

													users.set(userId, false);
												});

												await $this.getUsersByIds(users, true);

												const current = hot.getData();

												const data = current.concat([...users.values()].map(user => {
													const {
														id: userId,
														canReceiveChatMessage,
														displayName,
														name,
														username,
														notice,
														lastSeen,
														subscribedOnExpiredNow,
														isRealPerformer,
														subscribedOnData,
													} = user;

													const suggestedName = $this.getCleanName(displayName || name || username || "");

													const profileLink = `https://onlyfans.com/${username}`;
													const chatLink = `https://onlyfans.com/my/chats/chat/${userId}/?q=${username}`;

													const [subscribeAt, totalSumm] = (() => {
														if (subscribedOnData) {
															const { subscribeAt, totalSumm } = subscribedOnData;

															return [subscribeAt, totalSumm]
														}

														return [];
													})();

													return [
														userId,
														canReceiveChatMessage,
														suggestedName,
														displayName,
														name,
														username,
														notice,
														profileLink,
														subscribeAt,
														lastSeen,
														totalSumm,
														subscribedOnExpiredNow,
														chatLink,
														isRealPerformer,
													];
												}));

												hot.updateData(data);

												const notification = list.at(-1);

												const { id: notificationId } = notification;

												fromId = notificationId;

												if (!hasMore) {
													wnd.alert('Notifications loaded');

													return;
												}

												wnd.alert('Notifications loaded');
											};

											observer();
										};

										const container = document.createElement('div');

										container.id = 'container';

										document.body.appendChild(container);
									}

									return true;
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		async fetchNotifications(fromId: number, type: string = '') {
			const $this = this;

			const BASE_PATH = `/api2/v2/users/notifications`;
			const PARAMS = `limit=100&skip_users=all&format=infinite`;

			const path = `${BASE_PATH}?${PARAMS}${type ? `&type=${type}` : ''}${fromId ? `&fromId=${fromId}` : ''}`;

			const response = await queue.add(async () => await OFSign.get(path));

			return await response.json();
		}

		setName(userId: string, displayName: string) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const BASE_PATH = `/api2/v2/subscriptions/${userId}`;

				const path = `${BASE_PATH}`;

				const response = await queue.add(async () => await OFSign.put(path, {
					displayName,
				}));

				const result = await response.json();

				resolve(result);
			})
		}

		/**
		 * Извлекает имя из строки, очищает его и нормализует.
		 * 
		 * @param {string} input - Входная строка (например, "Jérôme-123 Smith")
		 * @returns {string} - Отформатированное имя (например, "Jerome")
		 */
		getCleanName(input) {
			if (!input || typeof input !== 'string') return '';

			// 1. Убираем пробелы по краям, берем первое слово
			// 2. normalize("NFD") разделяет буквы и их акценты (например, 'é' -> 'e' + '´')
			// 3. replace(/[\u0300-\u036f]/g, "") удаляет эти самые "висящие" акценты
			let name = input
				.trim()
				.split(/\s+/)[0]
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "");

			// 4. Очищаем от цифр и любых символов, которые не являются латинскими буквами
			// Оставляем только A-Z и a-z
			name = name.replace(/[^a-zA-Z]/g, '');

			if (!name) return '';

			// 5. Делаем первую букву заглавной, остальные строчными
			return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
		}

		fetchModals() {
			const $this = this;

			const modals = [
				'edit_bind',
				'include_lists',
				'include_fans',
				'fast_message',
			];

			modals.map(async (modal) => {
				const link = `${extensionRootUrl}modals/${modal}.html`;

				const response: any = await fetch(link);

				const { ok, status } = response;

				if (ok) {
					const text = await response.text();

					$this.modals[modal] = text;
				}
			});

			window.addEventListener('click', (e: PointerEvent) => {
				const { target } = e;

				if (target && target instanceof HTMLElement) {
					if (target.classList.contains('combine-modal')) {
						target.remove();
					}
				}
			});
		}

		applyStyle() {
			const $this = this;

			const href = `${extensionRootUrl}css/style.css`;

			const link = document.createElement('link');

			link.id = 'OFCombineStyle';

			link.rel = 'stylesheet';
			link.type = 'text/css';
			link.href = href;

			const observer = () => {
				const style = document.querySelector('[id="OFCombineStyle"]');

				if (!style) {
					document.head.appendChild(link);
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		copyMessage(args) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const chat__message = args.closest('.b-chat__message');

				if (chat__message) {
					const { __vue__: vue } = chat__message;

					const { message } = vue;

					const { text } = message;

					const div = document.createElement('div');

					div.innerHTML = text;

					const textContent = div.textContent.trim();

					const textPlain = new Blob([textContent], { type: "text/plain" });
					const htmlBlob = new Blob([text], { type: "text/html" });

					const clipboardItem = new ClipboardItem({
						"text/plain": textPlain,
						"text/html": htmlBlob,
					});

					try {
						await navigator.clipboard.write([clipboardItem]);

						$this.showToast(`Message successfully copied!`);
					} catch (error) {
						$this.showToast(`Failed to copy rich text: ${error}`);
					}

					resolve(true);
				}
			});
		}

		downloadMedia(target) {
			const $this = this;

			const chat_message = target.closest('[at-attr="chat_message"]');

			const { __vue__: vue } = chat_message;

			const { media } = vue;

			let isDrmOn = false;

			const fulls = media.map(item => {
				const { files } = item;

				const { drm, full } = files;

				if (drm) isDrmOn = true;

				const { url } = full;

				return url;
			});

			if (isDrmOn) {
				$this.showToast(`It's under DRM protection`);

				return;
			}

			const activeIndex = (() => {
				const el = chat_message.querySelector('.swiper');

				if (el) {
					const { swiper } = el;

					const { activeIndex } = swiper;

					return activeIndex;
				}

				return 0;
			})();

			const a = document.createElement('a');

			a.href = fulls[activeIndex];

			a.target = '_blank';

			a.click();
		}

		translateMessage(args) {
			const $this = this;

			$this.showToast('Developing');

			return;
		}

		showToast(text) {
			const app: any = document.querySelector('[id="app"]');

			if (app) {
				const { __vue__: vue } = app;

				const { showToast } = vue;

				showToast({ text });
			}
		}

		replyToMessage(messageId) {
			const chat_footer: any = document.querySelector('.m-chat-footer');

			if (chat_footer) {
				const { __vue__: vue } = chat_footer;

				const { $parent } = vue;

				$parent.replyToMessageId = messageId;
			}
		}

		handler() {
			const $this = this;

			window['copyMessage'] = (args) => { $this.copyMessage(args) };

			window['downloadMedia'] = (args) => { $this.downloadMedia(args) };

			window['translateMessage'] = (args) => { $this.translateMessage(args) };

			window['showToast'] = (args) => { $this.showToast(args) };

			window['replyToMessage'] = (args) => { $this.replyToMessage(args) };

			const observer = async () => {
				const card = <HTMLElement>document.querySelector('[id="card"]');

				const { name } = $this.app.route.to;

				if ('Chat' == name) {
					const userId = location.pathname.match(/(\d+)/)?.[1] || null;

					if (userId) {
						const int__userId = parseInt(userId);

						$this.currentChatId = int__userId;

						if (!$this.users.has(int__userId)) {
							$this.users.set(int__userId, false);
						} else if ('object' === typeof $this.users.get(int__userId)) {
							const user = $this.users.get(int__userId);

							const {
								lastTransaction,
								listsStates,
								subscribedOn,
								subscribedOnData,
								subscribedOnExpiredNow,
							} = user;

							if (subscribedOnData) {
								const {
									hasActivePaidSubscriptions,
									totalSumm,
									subscribeAt,
									subscribes,
								} = subscribedOnData;

								const isRebill = listsStates.find(listState => {
									const { id: listId, hasUser } = listState;

									return 'recent' == listId && hasUser;
								});

								const fromTrial = subscribes.find(subscribe => {
									const { action, type } = subscribe;

									return 'trial' == type;
								});

								const subscribeAt_date = new Date(subscribeAt);

								const diff = Math.abs(new Date().getTime() - subscribeAt_date.getTime());

								const hours = diff / (1000 * 60 * 60);

								const isRecent = 24 > hours;

								const formatter = new Intl.DateTimeFormat('en-GB', {
									day: '2-digit',
									month: 'short',
									year: 'numeric'
								});

								if (!card) {
									new Promise((resolve, reject) => {
										const BASE_PATH = `/api2/v2/chats/${int__userId}/messages`;

										const PARAMS = `order=desc&skip_users=all`;

										const path = `${BASE_PATH}?${PARAMS}`;

										let limit = 10;

										let firstId = 0;

										let count = 0;

										const observer = async () => {
											const path_ = `${path}&limit=${limit}${firstId ? `&firstId=${firstId}` : ''}`;

											const response = await queue.add(async () => await OFSign.get(path_));

											const data: any = await response.json();

											const { list, hasMore } = data;

											count += list.length;

											const isRead = list.find(message => {
												const { fromUser, isNew } = message;

												const { id: userId } = fromUser;

												return userId != int__userId && !isNew;
											});

											const last_read_date = <HTMLAnchorElement>document.querySelector('[id="last_read_date"]');

											if (last_read_date) {
												last_read_date.onclick = e => {
													e.preventDefault();

													return true;
												};
											}

											if (isRead) {
												const { id: messageId, createdAt } = isRead;

												const createdAt__date = new Date(createdAt);

												const lastReadDate = formatter.format(createdAt__date);

												if (last_read_date) {
													last_read_date.textContent = lastReadDate;

													last_read_date.href = `https://onlyfans.com/my/chats/chat/${int__userId}/?firstId=${messageId}`;

													last_read_date.onclick = e => {
														e.preventDefault();

														const chat__messages: any = document.querySelector('.b-chat__messages');

														if (chat__messages) {
															const { __vue__: vue } = chat__messages;

															const { scrollToMessage } = vue;

															scrollToMessage(messageId);
														}

														return true;
													};
												}

												resolve(createdAt__date);

												return;
											}

											const message = list.pop();

											const { id: messageId, createdAt } = message;

											const createdAt__date = new Date(createdAt);

											const diff = Math.abs(new Date().getTime() - createdAt__date.getTime());

											const days = diff / (1000 * 60 * 60 * 24);

											if (200 < count) {
												const lastReadDate = '>200msg';

												if (last_read_date) {
													last_read_date.textContent = lastReadDate;
												}

												resolve(lastReadDate);

												return;
											}

											if (31 < days) {
												const lastReadDate = '>1month';

												if (last_read_date) {
													last_read_date.textContent = lastReadDate;
												}

												resolve(lastReadDate);

												return;
											}

											if (firstId == messageId) {
												const lastReadDate = '>1month';

												if (last_read_date) {
													last_read_date.textContent = lastReadDate;
												}

												resolve(lastReadDate);

												return;
											}

											limit = 100;

											firstId = messageId;

											setTimeout(observer, 1000);
										};

										observer();
									});

									const card = document.createElement('div');

									card.id = 'card';

									document.body.appendChild(card);

									card.dataset.userId = userId;

									card.innerHTML = `
									<ul>
										<li class="total-summ">TOTAL: ${totalSumm ? `$${totalSumm}` : 'FREE'}</li>
										<li>Subscribed at: ${formatter.format(subscribeAt_date)}</li>
										<li>Last transaction: ${lastTransaction ? formatter.format(lastTransaction) : 'not found'}</li>
										<li>Last read: <a href="#" id="last_read_date">...</a></li>
										<li class="${fromTrial ? 'from-trial-true' : 'from-trial-false'}">From trial: ${fromTrial ? 'yes' : 'no'}</li>
										<li class="${isRebill ? 'is-rebill-true' : 'is-rebill-false'}">Rebill: ${isRebill ? 'yes' : 'no'}</li>
										<li class="${subscribedOn ? 'subscribed-true' : 'subscribed-false'}">Subscriber: ${subscribedOn ? 'yes' : 'no'}</li>
										<li class="${hasActivePaidSubscriptions ? 'has-subscription-true' : 'has-subscription-false'}">Paid subscription: ${hasActivePaidSubscriptions ? 'yes' : 'no'}</li>
										<li class="${subscribedOnExpiredNow ? 'is-expired-true' : 'is-expired-true'}">Expired: ${subscribedOnExpiredNow ? 'yes' : 'no'}</li>
										<li class="${isRecent ? 'recent-true' : 'recent-false'}">Recent 24h: ${isRecent ? 'yes' : 'no'}</li>
									</ul>`;
								} else if (card.dataset.userId != userId) {
									card?.remove();
								}
							} else {
								card?.remove();
							}
						}
					}

					if (userId) {
						const int__userId = parseInt(userId);

						if ($this.vault.has(int__userId)) {
							const vault = $this.vault.get(int__userId);

							if (vault) {
								const photos__items = <NodeListOf<HTMLElement | any>>document.querySelectorAll('[id="ModalMediaVault"] .l-main-content .b-photos__item');

								photos__items.forEach(photos__item => {
									const { __vue__: vue } = photos__item;

									const { item } = vue;

									const { id: mediaId } = item;

									if (vault.has(mediaId)) {
										const media = vault.get(mediaId);

										const { id: mediaId_, messageId, queueId, price, isOpened, files } = media;

										const { drm, full } = files;

										const { url } = full;

										const tools = photos__item.querySelector('.photos-tools');

										if (!tools) {
											const tools = document.createElement('div');

											tools.classList.add('photos-tools');

											photos__item.appendChild(tools);

											tools.innerHTML = `
											<span title="Is sent">📨</span>`;

											if (price) {
												tools.innerHTML += `<span class="price" title="Price">$${price}</span>`;
											}

											tools.innerHTML += `
											<span title="Is unlocked">${isOpened ? '✔️' : '❌'}</span>
											<a href="/my/chats/chat/${int__userId}/?firstId=${messageId}" target="_blank" title="Link to message">🔗</a>
											<a href="/my/chats/send?scheduleMessageId=${queueId}#forward" target="_blank" title="Forward this ppv">🗯️</a>`;

											if (!drm) {
												tools.innerHTML += `<a href="${url}" target="_blank" title="Download this media">📥️</span>`;
											}

											const elms = tools.querySelectorAll('a');

											elms.forEach(el => {
												el.onclick = e => {
													e.stopPropagation();

													return true;
												};
											});
										}
									}
								});
							}
						}
					}
				} else {
					card?.remove();
				}

				setTimeout(observer, 100);
			};

			observer();

			setInterval(() => {
				$this.users = new Map();
			}, 1 * 60 * 1000);
		}

		includeLists(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const { listIds, excludeListIds } = vue;

				const div = document.createElement('div');

				div.innerHTML = $this.modals['include_lists']

				div.innerHTML = div.innerHTML.replace(/{LISTIDS}/g, listIds.join("\n"));
				div.innerHTML = div.innerHTML.replace(/{EXCLUIDEDLISTIDS}/g, excludeListIds.join("\n"));

				const modal = <HTMLElement>div.firstChild;

				if (modal) {
					document.body.appendChild(modal);

					const form = modal.querySelector('form');

					if (form) {
						form.onsubmit = e => {
							e.preventDefault();

							const formData = (() => {
								const formData = new FormData(form);

								const obj: any = Object.fromEntries(formData.entries());

								obj.exclude = [...new Set(obj.exclude.trim().split("\n").filter(row => row))];

								const set = new Set(obj.exclude);

								obj.include = obj.include.trim().split("\n").filter(row => row);

								obj.include = [...new Set(obj.include.filter(item => !set.has(item)))];

								return obj
							})();

							vue.listIds = formData.include;
							vue.excludeListIds = formData.exclude;

							modal.remove();

							return true;
						};
					}
				}
			}
		}
		resetLists(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				vue.listIds = [];
				vue.excludeListIds = [];

				$this.showToast('Lists reset');
			}
		}
		includeFans(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const { userIds, excludedUsersIds } = vue;

				const div = document.createElement('div');

				div.innerHTML = $this.modals['include_fans'];

				div.innerHTML = div.innerHTML.replace(/{USERIDS}/g, userIds.join("\n"));
				div.innerHTML = div.innerHTML.replace(/{EXCLUIDEDUSERIDS}/g, excludedUsersIds.join("\n"));

				const modal = <HTMLElement>div.firstChild;

				if (modal) {
					document.body.appendChild(modal);

					const form = modal.querySelector('form');

					if (form) {
						form.onsubmit = e => {
							e.preventDefault();

							const formData = (() => {
								const formData = new FormData(form);

								const obj: any = Object.fromEntries(formData.entries());

								obj.exclude = [...new Set(obj.exclude.trim().split("\n").filter(row => row))];

								const set = new Set(obj.exclude);

								obj.include = obj.include.trim().split("\n").filter(row => row);

								obj.include = [...new Set(obj.include.filter(item => !set.has(item)))];

								return obj
							})();

							vue.userIds = formData.include;
							vue.excludedUsersIds = formData.exclude;

							modal.remove();

							return true;
						};
					}
				}
			}
		}
		resetFans(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				vue.userIds = [];
				vue.excludedUsersIds = [];

				$this.showToast('Users reset');
			}
		}
		loadLists(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const { setDataSchedule } = vue;

				const chat_footer = chats__conversations.querySelector('.m-chat-footer');

				if (chat_footer) {
					const { __vue__: vue_ } = chat_footer;

					const { getMessageFromDraft } = vue_;

					const draft = (() => {
						const item = localStorage.getItem('MassDMTemplate');

						if (item) {
							return JSON.parse(item);
						}

						return false;
					})();

					if (draft) {
						const { listIds, excludeListIds } = draft;

						[vue, vue_].map(vue => {
							Object.defineProperty(vue, 'needLoadDraft', {
								writable: true,
								enumerable: true,
								configurable: true
							});
							Object.defineProperty(vue, 'draftMessage', {
								writable: true,
								enumerable: true,
								configurable: true
							});

							vue.needLoadDraft = true;
							vue.draftMessage = {
								listIds,
								excludeListIds,
							};
						});

						setDataSchedule();

						$this.showToast('Lists loaded');
					} else {
						$this.showToast('No saved template');
					}
				}
			}
		}
		loadFans(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const { setDataSchedule } = vue;

				const chat_footer = chats__conversations.querySelector('.m-chat-footer');

				if (chat_footer) {
					const { __vue__: vue_ } = chat_footer;

					const { getMessageFromDraft } = vue_;

					const draft = (() => {
						const item = localStorage.getItem('MassDMTemplate');

						if (item) {
							return JSON.parse(item);
						}

						return false;
					})();

					if (draft) {
						const { userIds, excludedUsersIds } = draft;

						debugger;

						[vue, vue_].map(vue => {
							Object.defineProperty(vue, 'needLoadDraft', {
								writable: true,
								enumerable: true,
								configurable: true
							});
							Object.defineProperty(vue, 'draftMessage', {
								writable: true,
								enumerable: true,
								configurable: true
							});

							vue.needLoadDraft = true;
							vue.draftMessage = {
								userIds,
								excludedUsersIds,
							};
						});

						setDataSchedule();

						$this.showToast('Users loaded');
					} else {
						$this.showToast('No saved template');
					}
				}
			}
		}
		loadTmpl(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const { setDataSchedule } = vue;

				const chat_footer = chats__conversations.querySelector('.m-chat-footer');

				if (chat_footer) {
					const { __vue__: vue_ } = chat_footer;

					const { getMessageFromDraft } = vue_;

					const draft = (() => {
						const item = localStorage.getItem('MassDMTemplate');

						if (item) {
							return JSON.parse(item);
						}

						return false;
					})();

					if (draft) {
						[vue, vue_].map(vue => {
							Object.defineProperty(vue, 'needLoadDraft', {
								writable: true,
								enumerable: true,
								configurable: true
							});
							Object.defineProperty(vue, 'draftMessage', {
								writable: true,
								enumerable: true,
								configurable: true
							});

							vue.needLoadDraft = true;
							vue.draftMessage = draft;
						});

						setDataSchedule();

						getMessageFromDraft();

						$this.showToast('Template loaded');
					} else {
						$this.showToast('No saved template');
					}
				}
			}
		}
		saveTmpl(args) {
			const $this = this;

			const chats__conversations: any = document.querySelector('.b-chats__conversations');

			if (chats__conversations) {
				const { __vue__: vue } = chats__conversations;

				const chat_footer = chats__conversations.querySelector('.m-chat-footer');

				if (chat_footer) {
					const { __vue__: vue } = chat_footer;

					const { prepareDraftMessage, releaseFormsData } = vue;

					const draft = prepareDraftMessage();

					const { uploadedFiles } = draft;

					uploadedFiles.forEach((uploadedFile: any) => {
						const { files } = uploadedFile;

						const { squarePreview, thumb } = files;

						[squarePreview, thumb].filter((item: any) => item).forEach(async (item: any, index, self) => {
							const { url } = item;

							const response = await fetch(url);
							const blob = await response.blob();

							const base64 = await new Promise((resolve, reject) => {
								const reader = new FileReader();
								reader.onloadend = () => resolve(reader.result);
								reader.onerror = reject;
								reader.readAsDataURL(blob);
							});

							self[index].url = base64;
						});
					});

					draft.releaseForms = releaseFormsData;

					localStorage.setItem('MassDMTemplate', JSON.stringify(draft));

					$this.showToast('Template saved');
				}
			}
		}

		massDMPageHandler() {
			const $this = this;

			/**
			 * Сторим функции в глобальную зону
			 */
			window['includeLists'] = (args) => { $this.includeLists(args) };
			window['resetLists'] = (args) => { $this.resetLists(args) };
			window['includeFans'] = (args) => { $this.includeFans(args) };
			window['resetFans'] = (args) => { $this.resetFans(args) };
			window['loadLists'] = (args) => { $this.loadLists(args) };
			window['loadFans'] = (args) => { $this.loadFans(args) };
			window['loadTmpl'] = (args) => { $this.loadTmpl(args) };
			window['saveTmpl'] = (args) => { $this.saveTmpl(args) };

			/**
			 * Рендеринг кнопок
			 */
			const observer = async () => {
				const { isChatSendPage } = $this.app;

				if (isChatSendPage) {
					const chat__messages = document.querySelector('.b-chat__messages');

					if (chat__messages) {
						const tools = chat__messages.querySelector('[id="tools__massdm"]');

						if (!tools) {
							const tools = document.createElement('div');

							tools.id = 'tools__massdm';

							chat__messages.appendChild(tools);

							tools.innerHTML = `
							<div class="buttons-group">
								<button class="g-btn m-rounded" onclick="includeLists(this)">Set lists</button>
								<button class="g-btn m-rounded" onclick="loadLists(this)">Load lists</button>
								<button class="g-btn m-rounded" onclick="resetLists(this)"">Reset lists</button>
							</div>
							<div class="buttons-group">
								<button class="g-btn m-rounded" onclick="includeFans(this)">Set fans</button>
								<button class="g-btn m-rounded" onclick="loadFans(this)">Load fans</button>
								<button class="g-btn m-rounded" onclick="resetFans(this)">Reset fans</button>
							</div>
							<div class="buttons-group">
								<button class="g-btn m-rounded" onclick="loadTmpl(this)">Load template</button>
								<button class="g-btn m-rounded" onclick="saveTmpl(this)">Save template</button>
							</div>`;
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();

			{
				const observer = async () => {
					const { isChatSendPage } = $this.app;

					if (isChatSendPage) {
						const chats__conversations: any = document.querySelector('.b-chats__conversations');

						if (chats__conversations) {
							const { __vue__: vue } = chats__conversations;

							const { fetchUsersListsData } = vue;

							new Promise<void>((resolve, reject) => {
								$this.showToast('Lists loading...');

								const observer = async () => {
									const { usersListsOffset } = vue;

									if (0 < usersListsOffset) {
										await fetchUsersListsData();

										const { usersListsHasMore } = vue;

										if (!usersListsHasMore) {
											$this.showToast('Lists loaded');

											resolve();

											return;
										}
									}

									setTimeout(observer, 100);
								};

								observer();
							});

							return;
						}
					}

					setTimeout(observer, 100);
				};

				observer();
			}
		}

		forwardHandler() {
			const $this = this;

			const observer = () => {
				const isForward = '#forward' == location.hash;

				if (isForward) {
					const chat_footer: any = document.querySelector('.m-chat-footer');

					if (chat_footer) {
						const { __vue__: vue } = chat_footer;

						if (vue) {
							const { resetForwardMessage, deleteScheduleForItem } = vue;

							resetForwardMessage();
							deleteScheduleForItem();

							const { scheduleQueueMessage } = $this.app.$store.state.chats;

							if (scheduleQueueMessage) {
								$this.app.$store.state.chats.scheduleQueueMessage = null;

								return;
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		chatsHandler() {
			const $this = this;

			const observer = () => {
				const chats__list = document.querySelector('.b-chats__list-wrapper');

				if (chats__list) {
					const chats__items = <NodeListOf<HTMLElement>>chats__list.querySelectorAll('.b-chats__item');

					chats__items.forEach(chats__item => {
						const { id: userId } = chats__item;

						const int__userId = parseInt(userId);

						if (!$this.users.has(int__userId)) {
							$this.users.set(int__userId, false);
						} else if ('object' === typeof $this.users.get(int__userId)) {
							const user = $this.users.get(int__userId);

							const { subscribedOnData } = user;

							if (subscribedOnData) {
								const { subscribeAt, totalSumm } = subscribedOnData;

								const badge = chats__item.querySelector('.badge');

								if (!badge) {
									const badge = document.createElement('div');

									badge.classList.add('badge');

									chats__item.appendChild(badge);

									badge.textContent = 0 < totalSumm ? `$${totalSumm}` : 'Free';

									if (0 < totalSumm && 49.99 > totalSumm) {
										badge.classList.add('spent-1-49');
									}

									if (50 < totalSumm && 99.99 > totalSumm) {
										badge.classList.add('spent-50-99');
									}

									if (100 < totalSumm && 499.99 > totalSumm) {
										badge.classList.add('spent-100-499');
									}

									if (500 < totalSumm) {
										badge.classList.add('spent-500');
									}
								}

								const subscribeAt_date = new Date(subscribeAt);

								const diff = (new Date().getTime() - subscribeAt_date.getTime()) / 1000 / 60 / 60 / 24;

								if (24 > diff) {
									const recent = chats__item.querySelector('.recent');

									if (!recent) {
										const recent = document.createElement('div');

										recent.classList.add('recent');

										chats__item.appendChild(recent);

										recent.innerHTML = `24h`;
									}
								}
							}
						}
					});

					$this.getUsersByIds($this.users);
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		chatHandler() {
			const $this = this;

			$this.chatMessagesHandler();

			$this.vaultHandler();

			$this.renderBinds()
		}

		chatMessagesHandler() {
			const $this = this;

			const observer = () => {
				const chat_messages = <NodeListOf<HTMLElement | any>>document.querySelectorAll('[at-attr="chat_message"]');

				chat_messages.forEach(chat_message => {
					const isFromMe = chat_message.classList.contains('m-from-me');

					const { __vue__: vue } = chat_message;

					const {
						toggleLikeMessage,
						deleteMessages,
						unsendQueue,
						entityId: messageId,
						message,
						isCanCancel,
						withUser,
						hasMedia,
						onReply
					} = vue;

					const { id: userId } = withUser;

					window['toggleLikeMessage'] = toggleLikeMessage;

					window['deleteMessages'] = deleteMessages;

					const { chatId, queueId, text } = message;

					const chat__message__content = chat_message.querySelector(':scope > .b-chat__message__content');

					if (chat__message__content) {
						const tools = chat_message.querySelector('.message-tools');

						if (!tools) {
							const tools = document.createElement('div');

							tools.classList.add('message-tools');

							chat__message__content.after(tools);

							tools.innerHTML = ``;

							if (isFromMe) {
								tools.innerHTML += `
									<a href="/my/chats/chat/${chatId}/?firstId=${messageId}" title="Link" target="_blank">🔗</a>
									<a href="/my/chats/send?scheduleMessageId=${queueId}#forward" title="Forward" target="_blank">🗯️</a>`;

								if (hasMedia) {
									tools.innerHTML += `
									<a href="#" onclick="downloadMedia(this)" title="Download">📥️</a>`;
								}

								tools.innerHTML += `
									<a href="#" onclick="replyToMessage(${messageId})" title="Reply">↪️</a>
									<a href="#" onclick="copyMessage(this)" title="Copy">📋️</a>
									<a href="#" onclick="translateMessage(this, '')" title="Translate">💱</a>
									<a href="#" onclick="deleteMessages({chatId: ${chatId}, messageId: ${messageId}})" title="Unsend">❌</a>`;
							} else {
								tools.innerHTML += `
									<a href="/my/chats/chat/${chatId}/?firstId=${messageId}" title="Link" target="_blank">🔗</a>
									<a href="#" onclick="toggleLikeMessage({messageId: ${messageId}, withUserId: ${userId}})" title="Like">❤️</a>
									<a href="#" onclick="replyToMessage(${messageId})" title="Reply">↪️</a>
									<a href="#" onclick="copyMessage(this)" title="Copy">📋️</a>`;

								if (hasMedia) {
									tools.innerHTML += `
									<a href="#" onclick="downloadMedia(this)" title="Download">📥️</a>`;
								}

								tools.innerHTML += `
									<a href="#" onclick="translateMessage(this, '')" title="Translate">💱</a>`;
							}
						}
					}
				});

				setTimeout(observer, 100);
			};

			observer();
		}

		renderBinds() {
			const $this = this;

			const observer = () => {
				const { name } = $this.app.route.to;

				if ('Chat' == name) {
					const binds = document.querySelector('[id="binds"]');

					if (!binds) {
						const chat__messages = document.querySelector('.b-chat__messages');

						if (chat__messages) {
							const binds = document.createElement('div');

							binds.id = 'binds';

							chat__messages.after(binds);

							for (let i = 0; i < 24; i++) {
								const bind = document.createElement('a');

								bind.classList.add('bind');

								bind.href = '#'

								binds.appendChild(bind);

								const currentBinds = (() => {
									const item = localStorage.getItem('binds');

									if (item) {
										const json = JSON.parse(item);

										return json;
									}

									return [];
								})();

								const currentBind: any = currentBinds[i];

								if (currentBind) {
									const { hint } = currentBind;

									bind.title = hint;

									bind.classList.add('bound');
								}

								bind.onclick = async (e) => {
									e.preventDefault();

									const { shiftKey } = e;

									const currentBinds = (() => {
										const item = localStorage.getItem('binds');

										if (item) {
											const json = JSON.parse(item);

											return json;
										}

										return [];
									})();

									const currentBind: any = currentBinds[i];

									if (shiftKey || !currentBind) {
										const { hint, data } = currentBind ? currentBind : { hint: '', data: [] };

										const div = document.createElement('div');

										div.innerHTML = $this.modals['edit_bind'];

										div.innerHTML = div.innerHTML.replace(/{HINT}/g, hint);
										div.innerHTML = div.innerHTML.replace(/{TEXTS}/g, data.join("\n\n"));

										const modal = <HTMLElement>div.firstChild;

										if (modal) {
											document.body.appendChild(modal);

											const form = modal.querySelector('form');

											if (form) {
												form.onsubmit = e => {
													e.preventDefault();

													const formData = (() => {
														const formData = new FormData(form);

														const obj: any = Object.fromEntries(formData.entries());

														obj.data = obj.data.split("\n\n");

														return obj
													})();

													currentBinds[i] = formData;

													const json = JSON.stringify(currentBinds);

													localStorage.setItem('binds', json);

													modal.remove();

													binds.remove();

													return true;
												};
											}

											const markers = <NodeListOf<HTMLElement>>modal.querySelectorAll('.markers a');

											markers.forEach((marker) => {
												const textContent = marker.textContent.trim();

												marker.onclick = e => {
													e.preventDefault();

													const textarea = modal.querySelector('textarea');

													if (textarea) {
														textarea.focus();

														textarea.setRangeText(
															` ${textContent}`,
															textarea.selectionStart,
															textarea.selectionEnd,
															'end' // Moves cursor to the end of the inserted text
														);
													}

													return true;
												};
											});
										}

										return true;
									}

									if (currentBind) {
										const { data } = currentBind;

										shuffle(data);

										let message = data[0];

										const chat_footer: any = document.querySelector('.m-chat-footer');

										if (chat_footer) {
											const { __vue__: vue } = chat_footer;

											if (vue) {
												const { $parent, makeSubmitMessage, setText, text: currentText, withUser } = vue;

												const { id: userId, displayName } = withUser;

												if (displayName) {
													message = message.replace(/\%name/g, displayName);
												}

												if ('object' === typeof $this.users.get(userId)) {
													const user = $this.users.get(userId);

													const { displayName } = user;

													if (displayName) {
														message = message.replace(/\%name/g, displayName);
													}
												}

												const emojis: string[] = [
													'😊',  // Улыбающееся лицо
													'😄',  // Широко улыбающееся лицо
													'😃',  // Радостное лицо
													'😁',  // Сияющее лицо
													'🤩',  // Звёздные глаза
													'🥰',  // Влюблённое лицо
													'😍',  // Влюблённые глаза
													'🤗',  // Обнимающее лицо
													'😘',  // Воздушный поцелуй
													'😇',  // Лицо с нимбом
													'😉',  // Подмигивающее лицо
													'😜',  // Подмигивающее лицо с языком
													'🥳',  // Лицо с праздничным колпаком
													'💦',  // Брызги (splash)
													'😈',
													'💓',
													'💌',
												];

												while (/%emoji/.test(message)) {
													shuffle(emojis);

													const emoji = emojis[0];

													message = message.replace(/%emoji/, emoji);
												}

												const hasToBeSent = /%send/.test(message);
												const hasToBeAnswered = /%answer/.test(message);
												const hasToBeLiked = /%like/.test(message);
												const hasToBeClosed = /%close/.test(message);

												message = message.replace(/\%\w+/g, '');

												setText({ text: `${$this.stripTags(currentText)} ${message.trim()}` });

												if (hasToBeAnswered || hasToBeLiked) {
													if (userId) {
														const int__userId = parseInt(userId);

														const messages: Map<number, any> = (() => {
															const chat_messages = <NodeListOf<HTMLElement | any>>document.querySelectorAll('[at-attr="chat_message"]');

															const messages = new Map();

															chat_messages.forEach(chat_message => {
																const { __vue__: vue } = chat_message;

																const { message } = vue;

																const { id: messageId } = message;

																messages.set(messageId, message);
															});

															return messages;
														})();

														const fromUser = [...messages.values()].reverse().filter((message: any) => {
															const { fromUser: userId_ } = message;

															return userId_ == int__userId;
														});

														fromUser.map((message: any) => {
															$this.likeMessage(message);
														});

														const message = fromUser[0];

														if (message) {
															const { id: messageId } = message;

															if (!$parent.replyToMessageId) {
																$parent.replyToMessageId = messageId;
															}
														}
													}
												}

												if (hasToBeSent) {
													makeSubmitMessage();
												}
											}
										}
									}

									return true;
								};
							}
						}
					}
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		vaultHandler() {
			const $this = this;

			const observer = async () => {
				const { name } = $this.app.route.to;

				if ('Chat' == name) {
					const { currentChat } = $this.app.$store.state.chats;

					const userId = parseInt(currentChat);

					if (userId && userId == $this.currentChatId) {
						await $this.fetchChatsUsersMedia(userId);

						setTimeout(observer, 1 * 60 * 1000);

						return;
					}
				} else {
					const { vault } = $this.app.$store.state.mediaVault;

					Object.values(vault).map((media: any) => {
						const { id: mediaId, files } = media;

						const { drm, full } = files;

						const { url } = full;

						if (!drm) {
							// debugger;
						}
					});
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		fetchChatsUsersMedia(userId: number) {
			const $this = this;

			return new Promise<void>((resolve, reject) => {
				if (!$this.vault.has(userId)) {
					$this.vault.set(userId, new Map());
				}

				const vault = $this.vault.get(userId);

				if (vault) {
					const BASE_PATH = `/api2/v2/chats/${userId}/media/`;

					const PARAMS = `limit=20&skip_users=all`;

					let last_id = 0;

					const observer = async () => {
						if (userId != $this.currentChatId) {
							resolve();

							return;
						}

						const path = `${BASE_PATH}?${PARAMS}${last_id ? `&last_id=${last_id}` : ''}`;

						const response = await queue.add(async () => await OFSign.get(path));

						const data: any = await response.json();

						const { list, hasMore, nextLastId } = data;

						list.map(message => {
							const { id: messageId, queueId, isOpened, price, media } = message;

							media.map(media => {
								const { id: mediaId } = media;

								media.messageId = messageId;
								media.queueId = queueId;
								media.price = price;
								media.isOpened = isOpened;

								if (!vault.has(mediaId)) {
									vault.set(mediaId, media);
								}
							});
						});

						last_id = nextLastId;

						if (!hasMore) {
							resolve();

							return;
						}

						setTimeout(observer, 100);
					};

					observer();
				}
			})
		}

		stripTags(text) {
			const $this = this;

			const div = document.createElement('div');

			div.innerHTML = text;

			text = div.textContent.trim();

			return text;
		}

		getUsersByIds(users: Map<number, any>, noextra: boolean = false) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const BASE_PATH = `/api2/v2/users/list`;

				const usersIds = Array.from(users.entries())
					.filter(([key, value]) => false === value)
					.map(([key, value]) => key);

				usersIds.map(userId => {
					users.set(userId, true);
				});

				for (let i = 0; i < usersIds.length; i += 20) {
					const chunk = usersIds.slice(i, i + 20);

					const PARAMS = `x[]=${chunk.join('&x[]=')}`;

					const path = `${BASE_PATH}?${PARAMS}`;

					const response = await queue.add(async () => await OFSign.get(path));

					const data: any = await response.json();

					for (let i = 0; i < Object.keys(data).length; i++) {
						const userId = Object.keys(data)[i];

						const int__userId = parseInt(userId);

						const user = data[int__userId];

						const { subscribedOnData } = user;

						if (subscribedOnData) {
							const { totalSumm } = subscribedOnData;

							if (0 < totalSumm && !noextra) {
								const BASE_PATH = `/api2/v2/users/notifications`;

								const types = [
									'subscribed',
									'purchases',
									'tip',
								];

								const proms = types.map((type) => {
									return new Promise(async (resolve, reject) => {
										const PARAMS = `limit=1&type=${type}&related_user=${int__userId}&skip_users=all&format=infinite`;

										const path = `${BASE_PATH}?${PARAMS}`;

										const response = await queue.add(async () => await OFSign.get(path));

										const data: any = await response.json();

										const { list } = data;

										resolve(list[0] ?? false);
									})

								});

								const results = await Promise.all(proms);

								const lastTransaction = results.filter(result => result).map((transaction: any) => {
									const { type, replacePairs, createdAt } = transaction;

									const price = replacePairs['{PRICE}'];

									if ('subscribed' == type) {
										if (price) {
											return new Date(createdAt);
										} else {
											return false;
										}
									}

									return new Date(createdAt);
								}).filter((transaction: any) => transaction).sort((a: any, b: any) => b - a)[0] ?? false;

								user.lastTransaction = lastTransaction;
							}
						}

						users.set(int__userId, user);
					}
				}

				resolve(users);
			});
		}

		async fetchUsersListUsers(listId: any, offset: number = 0) {
			const $this = this;

			const BASE_PATH = `/api2/v2/lists/${listId}/users`;
			const PARAMS = `limit=100&format=infinite${offset ? `&offset=${offset}` : ''}`;

			const path = `${BASE_PATH}?${PARAMS}`;

			const response = await queue.add(async () => await OFSign.get(path));

			return await response.json();
		}

		async fetchChats(offset: number = 0, filter: string | boolean = 'priority') {
			const $this = this;

			const BASE_PATH = `/api2/v2/chats`;
			const PARAMS = `limit=10&&skip_users=all&order=recent`;

			const extra: any = {
				offset,
			};

			if (filter) {
				extra.filter = filter;
			}

			const path = `${BASE_PATH}?${PARAMS}&${new URLSearchParams(extra).toString()}`;

			const response = await queue.add(async () => await OFSign.get(path));

			const chats = await response.json();

			return chats;
		}

		async recentChats() {
			const $this = this;

			return new Promise((resolve, reject) => {
				const listChats = new Map();

				let offset = 0;

				const observer = async () => {
					const chats = await $this.fetchChats(offset);

					const { hasMore, list, nextOffset } = chats;

					list.map((chat: any) => {
						const { withUser } = chat;

						const { id: userId } = withUser;

						listChats.set(userId, chat)
					});

					offset += 10;

					if (!hasMore || 100 < offset) {
						resolve(listChats);

						return;
					}

					setTimeout(observer, 100);
				};

				observer();
			});
		}

		async likeMessage(message) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const { id: messageId, fromUser, isLiked } = message;

				if (isLiked) {
					resolve(isLiked);

					return;
				}

				const { id: userId } = fromUser;

				const BASE_PATH = `/api2/v2/messages/${messageId}/like`;

				const path = `${BASE_PATH}`;

				const response = await queue.add(async () => await OFSign.post(path, {
					withUserId: userId,
				}));

				const result = await response.json();

				resolve(result);
			});
		}

		async fetchMessages(int__userId: number = 0, fromId: number = 0, limit: number = 10) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const BASE_PATH = `/api2/v2/chats/${int__userId}/messages`;

				const PARAMS = `limit=${limit}&order=desc&skip_users=all${fromId ? `&id=${fromId}` : ''}`;

				const path = `${BASE_PATH}?${PARAMS}`;

				const messages = new Map();

				const response = await queue.add(async () => await OFSign.get(path));

				const data: any = await response.json();

				const { list, hasMore } = data;

				const length = list.length;

				list.map(message => {
					const { id: messageId } = message;

					messages.set(messageId, message);
				});

				resolve(messages);
			});
		}

		async fetchMessagesExt(int__userId: number = 0) {
			const $this = this;

			return new Promise((resolve, reject) => {
				const BASE_PATH = `/api2/v2/chats/${int__userId}/messages`;

				const PARAMS = `order=desc&skip_users=all`;

				const path = `${BASE_PATH}?${PARAMS}`;

				let limit = 10;

				let firstId = 0;

				let count = 0;

				const messages = new Map();

				const observer = async () => {
					const path_ = `${path}&limit=${limit}${firstId ? `&firstId=${firstId}` : ''}`;

					const response = await queue.add(async () => await OFSign.get(path_));

					const data: any = await response.json();

					const { list, hasMore } = data;

					const length = list.length;

					list.map(message => {
						const { id: messageId } = message;

						messages.set(messageId, message);
					});

					count += list.length;

					const message = list.pop();

					const { id: messageId, createdAt } = message;

					const createdAt__date = new Date(createdAt);

					const diff = Math.abs(new Date().getTime() - createdAt__date.getTime());

					const days = diff / (1000 * 60 * 60 * 24);

					if (firstId == messageId || 200 < count || 31 < days || 200 < count) {
						resolve(messages);

						return;
					}

					limit = 100;

					firstId = messageId;

					setTimeout(observer, 1000);
				};

				observer();
			});
		}
	}

	const observer = () => {
		const app: any = document.querySelector('[id="app"]');

		if (app) {
			const { __vue__: vue } = app;

			if (vue) {
				window['ofc'] = new OFCombine(vue);

				return;
			}
		}

		setTimeout(observer, 100);
	};

	observer();

	window.addEventListener('keydown', (e: KeyboardEvent) => {
		const { shiftKey } = e;

		window['shiftKey'] = shiftKey;
	});

	window.addEventListener('keyup', (e: KeyboardEvent) => {
		const { shiftKey } = e;

		window['shiftKey'] = shiftKey;
	});

	{
		const observer = () => {
			const export_chat = document.querySelector('[id="export_chat"]');

			if (export_chat) {
				if (window['shiftKey']) {
					export_chat.classList.add('show');
				} else {
					export_chat.classList.remove('show');
				}
			}

			setTimeout(observer, 100);
		};

		observer();
	}

	{
		return;

		const funcs = {};

		const observer = () => {
			const els = document.querySelectorAll('*');

			els.forEach((el: any) => {
				const { __vue__: vue } = el;

				if (vue) {
					const collect = (vue) => {
						Object.keys(vue).map(key => {
							const value = vue[key];

							if (typeof value === 'function') {
								funcs[key] = {
									vue,
									f: value
								};
							}
						});

						const { $children } = vue;

						$children.map(collect);
					};

					collect(vue);

					debugger;
				}
			});

			setTimeout(observer, 100);
		};

		observer();
	}
}

function tools() {
	if (window['hasBeenToolsInjected']) return;

	window['hasBeenToolsInjected'] = true;

	console.log('[TOOLS] OFCombine v7');

	class WorkerTimeout {
		worker: any = null;
		constructor(callback, timeout) {
			const $this = this;
			const blob = new Blob([`setTimeout(() => postMessage(0), ${timeout});`]);
			const workerScript = URL.createObjectURL(blob);
			$this.worker = new Worker(workerScript);
			$this.worker.onmessage = () => {
				callback();
				$this.worker.terminate();
			};
		}
		stop() {
			const $this = this;
			$this.worker.terminate();
		}
	}

	window['retryRequests'] = [];

	const observer = () => {
		const xhr: any = retryRequests.shift();

		if (xhr) {
			const { requestHeaders, openArgs, sendArgs } = xhr;

			const { method, url, async, user, password } = openArgs;

			xhr.open(method, url, async, user, password);

			Object.keys(requestHeaders).map(header => {
				const { [header]: value } = requestHeaders;

				xhr.setRequestHeader(header, value);
			});

			const { body } = sendArgs;

			xhr.send(body);
		};

		new WorkerTimeout(observer, 1000 + Math.round(100 * Math.random()));
	};

	observer();

	XMLHttpRequest = new Proxy(XMLHttpRequest, {
		construct(target) {
			const $this = this;

			const xhr: any = new target();

			((
				open,
				setRequestHeader,
				send,
			) => {
				xhr.open = function () {
					const [method, url, async, user, password] = [...arguments];

					xhr.openArgs = {
						method,
						url,
						async,
						user,
						password
					};

					return open.apply(this, arguments);
				};
				xhr.setRequestHeader = function () {
					const [header, value] = [...arguments];

					if (!xhr.requestHeaders) xhr.requestHeaders = {};

					xhr.requestHeaders[header] = value;

					return setRequestHeader.apply(this, arguments);
				};
				xhr.send = function () {
					const [body] = [...arguments];

					const { onreadystatechange, onloadend } = xhr;

					xhr.sendArgs = {
						body
					}

					xhr.onreadystatechange = function () {
						const [event] = [...arguments];

						const responseHeadersRAW = xhr.getAllResponseHeaders();

						if ('' != responseHeadersRAW) {
							const responseHeaders = responseHeadersRAW.split("\r\n").filter((row: any) => row).map((row: any) => {
								const split = row.split(': ');
								const name = split[0];
								const value = split[1].trim();
								const header: any = {};

								header[name] = value;
								return header;
							}).reduce((acc: any, next: any) => {
								return Object.assign(acc, next);
							});

							xhr.responseHeaders = responseHeaders;
						}

						if (429 === xhr.status) {
							// TODO: сделать ретрай
						}

						if (200 === xhr.status && 4 === xhr.readyState) {
							const responseJSON = (() => {
								try {
									return JSON.parse(xhr.response);
								} catch (error) {
									return {};
								}
							})();

							const url = new URL(xhr.responseURL);

							xhr.capturedResponse = {
								responseJSON,
								url
							};

							const response = xhr.response;
							const responseText = xhr.responseText;

							Object.defineProperty(xhr, "response", {
								writable: true
							});

							Object.defineProperty(xhr, "responseText", {
								writable: true
							});

							xhr.response = response;
							xhr.responseText = responseText;

							xhr.onloadend = onloadend;
						}

						return onreadystatechange ? onreadystatechange.apply(this, arguments) : null;
					};

					xhr.onloadend = function () {
						const [event] = [...arguments];

						if (
							429 === xhr.status ||
							400 === xhr.status
						) {
							const { response } = xhr;

							const json = (() => {
								try {
									const json = JSON.parse(response);

									return json;
								} catch (error) {
								}

								return false;
							})();

							if (json) {
								const { error } = json;

								if (error) {
									const { code, message } = error;

									if ('User not found' == message) {
										return onloadend ? onloadend.apply(this, arguments) : null;
									}
								}
							}

							retryRequests.push(xhr);

							return;
						}

						return onloadend ? onloadend.apply(this, arguments) : null;
					};

					return send.apply(this, arguments);
				};
			})(
				xhr.open,
				xhr.setRequestHeader,
				xhr.send,
			);

			return xhr;
		}
	});
}

async function injector() {
	const tabs = await chrome.tabs.query({
		url: [
			"*://onlyfans.com/*"
		]
	});

	tabs.map((tab: any) => {
		const { id: tabId } = tab;

		chrome.scripting.executeScript({
			injectImmediately: true,
			target: { tabId: tabId, allFrames: false },
			func: inject,
			args: [
				chrome.runtime.getURL('/'),
			],
			world: "MAIN"
		});

		chrome.scripting.executeScript({
			injectImmediately: true,
			target: { tabId: tabId, allFrames: false },
			func: tools,
			args: [],
			world: "MAIN"
		});
	});
}

chrome.runtime.onMessage.addListener((message: any, sender: MessageSender, sendResponse: Function) => {
	sendResponse({ pong: true });

	injector();
});

// Генерация уникального ID
function generateId() {
	return `separator_${crypto.randomUUID()}`;
}

// Рекурсивная функция создания меню
function createMenuFromConfig(item, parentId = null) {
	const isSeparator = item.type === "separator";

	// Для сепаратора генерируем ID автоматически
	const itemId = item.id || (isSeparator ? generateId() : null);

	// Если нет ID и это не сепаратор — ошибка конфигурации
	if (!itemId) {
		console.error("Ошибка: у пункта меню отсутствует id", item);
		return;
	}

	const menuProps: any = {
		id: itemId,
		contexts: ["all"]
	};

	// Если это разделитель
	if (isSeparator) {
		menuProps.type = "separator";
	} else {
		menuProps.title = item.title;
	}

	// Если есть родитель — привязываем
	if (parentId) {
		menuProps.parentId = parentId;
	}

	// documentUrlPatterns — только если указано
	if (item.documentUrlPatterns) {
		menuProps.documentUrlPatterns = item.documentUrlPatterns;
	}

	chrome.contextMenus.create(menuProps, () => {
		if (chrome.runtime.lastError) {
			console.error(
				`Ошибка при создании меню "${itemId}":`,
				chrome.runtime.lastError.message
			);
		} else {
			const typeLabel = isSeparator ? "(separator)" : "";
			console.log(`Меню создано: "${itemId}" ${typeLabel}`);
		}
	});

	// Если есть подменю — рекурсивно создаём дочерние элементы
	if (!isSeparator && item.submenu && item.submenu.length > 0) {
		for (const child of item.submenu) {
			createMenuFromConfig(child, itemId);
		}
	}
}

// Загрузка JSON и построение меню
async function loadMenu() {
	try {
		const url = chrome.runtime.getURL("menu.json");
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const menuConfig = await response.json();

		// Сначала удаляем старое меню (на случай обновления)
		chrome.contextMenus.removeAll(() => {
			createMenuFromConfig(menuConfig);
			console.log("Меню успешно загружено из menu.json");
		});
	} catch (error) {
		console.error("Не удалось загрузить menu.json:", error);
	}
}

chrome.runtime.onInstalled.addListener((details: any) => {
	loadMenu();
});

function setdate(scheduleDate: string) {
	debugger;

	const app: any = document.querySelector('.m-chat-footer');

	if (app) {
		const { __vue__: vue } = app;

		if (vue) {
			vue.scheduleDate = scheduleDate;

			document.title = 'Date set';
		}
	}
}

function save() {
	const app: any = document.querySelector('.m-chat-footer');

	if (app) {
		const { __vue__: vue } = app;

		if (vue) {
			const { handleMessageSubmit } = vue;

			handleMessageSubmit();

			document.title = 'Saving...';
		}
	}
}

function sendmessage(mode) {
	debugger;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	const { id: tabId } = tab;

	const tabs = await chrome.tabs.query({
		url: [
			"*://onlyfans.com/*"
		]
	});

	// Inbox && Notifications
	{
		const modes = {
			// Inbox
			sendmessage_inbox: 'inbox',
			sendmessage_spenders: 'spenders',
			sendmessage_freebies: 'freebies',

			// Notifications
			sendmessage_all: 'all',
			sendmessage_subscribers: 'subscribers',
			sendmessage_purchases: 'purchases',
			sendmessage_tips: 'tips',
		};

		const mode = modes[info.menuItemId];

		if (mode) {
			chrome.scripting.executeScript({
				injectImmediately: true,
				target: { tabId: tabId, allFrames: false },
				func: sendmessage,
				args: [mode],
				world: "MAIN"
			});
		}
	}

	// Queue
	{
		const tabs = await chrome.tabs.query({
			url: [
				"*://onlyfans.com/my/chats/send*"
			]
		});

		if (info.menuItemId === "setdate") {
			const date = new Date();

			date.setDate(date.getDate() + 1);

			date.setHours(1);
			date.setMinutes(6);
			date.setSeconds(0);

			tabs.map((tab: any) => {
				const iso = date.toISOString();

				const { id: tabId } = tab;
				chrome.scripting.executeScript({
					injectImmediately: true,
					target: { tabId: tabId, allFrames: false },
					func: setdate,
					args: [iso],
					world: "MAIN"
				});

				date.setHours(date.getHours() + 3);
			});
		}

		if (info.menuItemId === "setdateext") {
			const url = tab.url;

			const match = url.match(/\d{4}-\d{2}-\d{2}/)?.[0];

			const date = new Date(match);

			date.setDate(date.getDate() + 1);

			date.setHours(1);
			date.setMinutes(6);
			date.setSeconds(0);

			tabs.map((tab: any) => {
				const iso = date.toISOString();

				const { id: tabId } = tab;
				chrome.scripting.executeScript({
					injectImmediately: true,
					target: { tabId: tabId, allFrames: false },
					func: setdate,
					args: [iso],
					world: "MAIN"
				});

				date.setHours(date.getHours() + 3);
			});
		}

		if (info.menuItemId === "save") {
			tabs.map((tab: any) => {
				const { id: tabId } = tab;
				chrome.scripting.executeScript({
					injectImmediately: true,
					target: { tabId: tabId, allFrames: false },
					func: save,
					args: [],
					world: "MAIN"
				});
			});
		}

		if (info.menuItemId === "close") {
			const tabs = await chrome.tabs.query({
				pinned: false,
				url: 'https://*.onlyfans.com/my/queue*'
			});

			chrome.tabs.remove(tabs.slice(0, -1).map((tab: any) => {
				const { id: tabId } = tab;

				return tabId;
			}));
		}
	}
});