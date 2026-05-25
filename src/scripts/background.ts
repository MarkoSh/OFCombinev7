async function inject(extensionRootUrl) {
	if (window['hasBeenInjected']) return;

	window['hasBeenInjected'] = true;

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

		async json<T = unknown>(path: string): Promise<T> {
			const resp = await this.get(path);
			return resp.json();
		}
	}

	const OFSign = new OFSignClient();

	class OFCombine {
		users: Map<number, any> = new Map();

		constructor() {
			const $this = this;

			window['OFCombine'] = $this;

			console.log('OFCombine v7');

			$this.init();
		}

		init() {
			const $this = this;

			$this.applyStyle();

			$this.handler();
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

		handler() {
			const $this = this;

			const observer = async () => {
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
								const { totalSumm } = subscribedOnData;

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
							}
						}
					});

					$this.getUsersByIds($this.users);
				}

				const card = <HTMLElement>document.querySelector('[id="card"]');

				const isChat = document.querySelector('.m-chat-title .b-username-row');

				if (isChat) {
					const userId = location.pathname.match(/(\d+)/)?.[1] || null;

					if (userId) {
						const int__userId = parseInt(userId);

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

											const last_read_date = document.querySelector('[id="last_read_date"]');

											if (isRead) {
												const { createdAt } = isRead;

												const createdAt__date = new Date(createdAt);

												const lastReadDate = formatter.format(createdAt__date);

												if (last_read_date) last_read_date.textContent = lastReadDate;

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

												if (last_read_date) last_read_date.textContent = lastReadDate;

												resolve(lastReadDate);

												return;
											}

											if (31 < days) {
												const lastReadDate = '>1month';

												if (last_read_date) last_read_date.textContent = lastReadDate;

												resolve(lastReadDate);

												return;
											}

											if (firstId == messageId) {
												const lastReadDate = '>1month';

												if (last_read_date) last_read_date.textContent = lastReadDate;

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
										<li>Last transaction: ${lastTransaction ? formatter.format(lastTransaction) : 'no'}</li>
										<li>Last read: <span id="last_read_date">...</span></li>
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

								const clickedBind: any = currentBinds[i];

								if (clickedBind) {
									const { hint } = clickedBind;

									bind.title = hint;

									bind.classList.add('bound');
								}

								bind.onclick = async (e) => {
									e.preventDefault();

									const currentBinds = (() => {
										const item = localStorage.getItem('binds');

										if (item) {
											const json = JSON.parse(item);

											return json;
										}

										return [];
									})();

									const clickedBind: any = currentBinds[i];

									if (clickedBind) {
										const { data } = clickedBind;

										shuffle(data);

										let message = data[0];

										const chat_footer: any = document.querySelector('.m-chat-footer');

										if (chat_footer) {
											const { __vue__: vue } = chat_footer;

											if (vue) {
												const { $parent, makeSubmitMessage, setText } = vue;

												if (userId) {
													const int__userId = parseInt(userId);

													if ('object' === typeof $this.users.get(int__userId)) {
														const user = $this.users.get(int__userId);

														const { displayName } = user;

														if (displayName) {
															message = message.replace(/\%name/g, displayName);
														}
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

												setText({ text: message });

												if (hasToBeAnswered || hasToBeLiked) {
													if (userId) {
														const int__userId = parseInt(userId);

														const messages = <Map<number, any>>await $this.fetchMessages(int__userId);

														const fromUser = [...messages.values()].filter((message: any) => {
															const { fromUser } = message;

															const { id: userId_ } = fromUser;

															return userId_ == int__userId;
														});

														fromUser.map((message: any) => {
															$this.likeMessage(message);
														});

														const message = fromUser[0];

														if (message) {
															const { id: messageId } = message;

															$parent.replyToMessageId = messageId;
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
				} else {
					card?.remove();
				}

				setTimeout(observer, 100);
			};

			observer();
		}

		getUsersByIds(users: Map<number, any>) {
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

					Object.keys(data).map(async (userId: string) => {
						const int__userId = parseInt(userId);

						const user = data[int__userId];

						const { subscribedOnData } = user;

						if (subscribedOnData) {
							const { totalSumm } = subscribedOnData;

							if (0 < totalSumm) {
								const BASE_PATH = `/api2/v2/users/notifications`;

								const types = [
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
									const { createdAt } = transaction;

									return new Date(createdAt);
								}).sort((a: any, b: any) => b - a)[0] ?? false;

								user.lastTransaction = lastTransaction;
							}
						}

						users.set(int__userId, user);
					});
				}

				resolve(users);
			});
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

		async fetchMessages(int__userId: number = 0) {
			const $this = this;

			return new Promise(async (resolve, reject) => {
				const BASE_PATH = `/api2/v2/chats/${int__userId}/messages`;

				const PARAMS = `limit=10&order=desc&skip_users=all`;

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

	const ofc = new OFCombine();
}

function injector() {
	const observer = async () => {
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
		});

		setTimeout(observer, 100);
	};

	observer();
}

injector();

chrome.runtime.onInstalled.addListener(() => {
	chrome.alarms.create("keepAliveAlarm", {
		periodInMinutes: 1,
	});
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === "keepAliveAlarm") {
		console.log("Воркер проснулся в:", new Date().toLocaleTimeString());

		// injector();
	}
});