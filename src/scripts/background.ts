async function inject() {
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

    class OFSignClient {
        private readonly SECRET = "Z0XSvSCtKAY7vwuMyCrNyXXMfnKTSJjE";
        private readonly TOKEN = "33d57ade8c02dbc5a333db99ff9ae26a";
        private readonly REV = "202604071359-79c40c7d89";
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
            const url = this.BASE + path;
            const signHeaders = await this.generateHeaders(path);

            return fetch(url, {
                ...options,
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    ...options.headers,
                    ...signHeaders
                }
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

    async function fetchChats(offset: number = 0, filter: string | boolean = 'priority') {
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

    const recent = await new Promise((resolve, reject) => {
        const listChats = new Map();

        let offset = 0;

        const observer = async () => {
            const chats = await fetchChats(offset);

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

    debugger;
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
            world: "MAIN"
        });
    });
}

chrome.tabs.onUpdated.addListener(injector);
chrome.tabs.onActivated.addListener(injector);