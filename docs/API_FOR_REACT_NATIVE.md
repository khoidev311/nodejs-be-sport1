# Sport1 API — Hướng dẫn tích hợp React Native (bản 2026-09)

Tài liệu cho app `football-infomation` (Expo, expo-router, React Query 5, zustand, `expo-sqlite/kv-store`).
**Auth, đội yêu thích, push thông báo** → xem [RN_AUTH_AND_PUSH.md](RN_AUTH_AND_PUSH.md) (hướng dẫn implement từng bước).
Thay thế bản cũ. Mọi mô tả dưới đây đối chiếu trực tiếp với code trên branch `stg`
(PR #3) và **đã có dữ liệu thật** của 7 giải trong DB.

---

## 0. Có gì mới so với bản cũ — đọc trước

| #   | Thay đổi                                                                            | Client cần làm                                   |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Lỗi **luôn** là `{ "message": "…" }`                                                | Bỏ `body.msg ?? body.message`, chỉ đọc `message` |
| 2   | Login sai / thiếu token → **401** (trước 400); không đủ quyền → **403**             | Đổi điều kiện xử lý                              |
| 3   | Token cũ (`{username}`) vô hiệu; có `POST /auth/refresh`                            | User login lại; thêm luồng refresh (mục 3)       |
| 4   | `GET /leagues/:id` trả **1 object** (trước trả cả list)                             | Bỏ workaround                                    |
| 5   | `per_page` mặc định **20**, tối đa **100** (vượt → 400)                             | Truyền `per_page` tường minh                     |
| 6   | `meta` = `{ total, current, per_page, pages }` **đúng**                             | Dùng `pages` để phân trang                       |
| 7   | `filter[name]` không phân biệt hoa thường, đã escape regex                          | Bỏ `escapeRegex` phía client                     |
| 8   | `filter[round]=6`, `filter[league]=<id>`, `filter[status]=finished` hoạt động       | —                                                |
| 9   | Fixtures có `?from=&to=` theo `start_time`                                          | Màn "hôm nay" / "tuần này"                       |
| 10  | **Fixture chứa luôn tỉ số**: `home_score`, `away_score`, `status`, `round`, `venue` | **Bỏ gọi `/scores`**                             |
| 11  | Rank có `goals_for`, `goals_against`, `goal_diff`, `history_match` là `W/D/L` thật  | Cập nhật UI BXH                                  |
| 12  | Team/League có `external_id`, `source`, League có `slug`, `country`                 | Dùng `slug` để route                             |
| 13  | Tất cả có `created_at` / `updated_at` đúng                                          | —                                                |
| 14  | `create` trả 201; id sai → 400; không tồn tại → 404; trùng → 409                    | Check `2xx` thay vì `=== 200`                    |
| 15  | Body bị validate (zod), field lạ bị bỏ                                              | —                                                |

---

## 1. Cấu hình

| Thông số     | Giá trị                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| Base URL     | `https://nodejs-be-sport1-g5oh.vercel.app` (sau khi merge PR #3 + set env Vercel) |
| Prefix       | `/api`                                                                            |
| Content-Type | `application/json`                                                                |
| Auth header  | `Authorization: Bearer <access_token>`                                            |
| Thời gian    | Mọi `Date` là **ISO UTC** (`2026-10-10T11:30:00.000Z`). Hiển thị giờ VN: `+7`     |
| Logo         | URL tuyệt đối (`https://media.bongda.com.vn/…`), dùng thẳng trong `<Image>`       |

### Hai dạng response

**Danh sách** — luôn có envelope:

```json
{ "data": [ … ], "meta": { "total": 380, "current": 1, "per_page": 20, "pages": 19 } }
```

**Chi tiết / tạo / sửa** — trả thẳng object. **Lỗi** — luôn `{ "message": "…" }`.

| Mã  | Ý nghĩa                                                        |
| --- | -------------------------------------------------------------- |
| 400 | Validation / id sai / JSON hỏng — `message` liệt kê tất cả lỗi |
| 401 | Thiếu / sai / hết hạn token; sai tài khoản                     |
| 403 | Đúng token nhưng không phải admin                              |
| 404 | Không tồn tại (kể cả route lạ)                                 |
| 409 | Trùng unique (`name` giải, `username`…)                        |
| 503 | DB không kết nối được (retry sau)                              |

### Query params cho endpoint danh sách

| Param           | Ví dụ                                     | Ghi chú                                                            |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `filter[field]` | `filter[name]=arsenal`                    | Chuỗi → "chứa", không phân biệt hoa thường                         |
|                 | `filter[round]=6`                         | Số nguyên → so bằng                                                |
|                 | `filter[league]=66f…`                     | ObjectId → so bằng (mọi field ref: `league`, `host_team`, `team`…) |
|                 | `filter[status]=finished`                 | Cũng là "chứa" — với enum thì tương đương khớp nguyên              |
| `sort`          | `sort=-start_time` hoặc `sort=rank,name`  | `-` = giảm dần                                                     |
| `page`          | `page=2`                                  | Từ 1                                                               |
| `per_page`      | `per_page=50`                             | 1–100, mặc định 20                                                 |
| `from` / `to`   | `from=2026-10-10&to=2026-10-10T23:59:59Z` | Chỉ **fixtures**; ISO date hoặc datetime; lọc `start_time`         |

---

## 2. API client

### `src/api/config.ts`

```ts
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://nodejs-be-sport1-g5oh.vercel.app";
export const API_PREFIX = "/api";
```

### `src/api/client.ts`

```ts
import { API_BASE_URL, API_PREFIX } from "./config";
import { authStorage } from "../store/authStorage";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | Record<string, string | number>>;

// filter: { name: "arsenal" } -> filter[name]=arsenal
export const toQueryString = (q: Query = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    if (typeof v === "object") for (const [f, fv] of Object.entries(v)) p.set(`${k}[${f}]`, String(fv));
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refresh_token = authStorage.getRefreshToken();
  if (!refresh_token) return null;
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) {
    authStorage.clear();
    return null;
  }
  const tokens = (await res.json()) as { access_token: string; refresh_token: string };
  authStorage.setTokens(tokens);
  return tokens.access_token;
};

export async function request<T>(
  path: string,
  init: RequestInit & { query?: Query; auth?: boolean } = {},
  retried = false,
): Promise<T> {
  const { query, auth = true, ...rest } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(rest.headers as object) };
  const token = auth ? authStorage.getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}${toQueryString(query)}`, { ...rest, headers });

  if (res.status === 401 && auth && !retried) {
    refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
    const fresh = await refreshing;
    if (fresh) return request<T>(path, init, true);
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* 503 từ Vercel có thể là text */
  }
  if (!res.ok) {
    const message = (body as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}
```

---

## 3. Luồng xác thực

| Method | Path             | Body                                      | Trả về                                          |
| ------ | ---------------- | ----------------------------------------- | ----------------------------------------------- |
| POST   | `/auth/register` | `{ username, password, fullname, email }` | 201 `{ access_token, refresh_token }`           |
| POST   | `/auth/login`    | `{ username, password }`                  | 200 `{ access_token, refresh_token }`           |
| POST   | `/auth/refresh`  | `{ refresh_token }`                       | 200 `{ access_token, refresh_token }` (cặp mới) |
| GET    | `/auth/me`       | — (Bearer)                                | 200 `User` kèm `role` populated                 |

- Access token sống **8h**, refresh token **7d**. Khi 401 → gọi `/auth/refresh` (client ở mục 2 tự làm). Refresh 401 → logout.
- Validation register: `username` 3–50 ký tự `[a-zA-Z0-9_.-]`, `password` ≥ 6, `email` hợp lệ. Trùng username → **422**.
- Sai tài khoản/mật khẩu → **401 `Invalid credentials`** (không phân biệt user không tồn tại).
- Không có luồng "quên mật khẩu".
- Token lưu bằng `expo-sqlite/kv-store` (`src/store/authStorage.ts` trong app — đã có, đọc đồng bộ).
- Session state (khách / đã login), màn login/register, logout (gỡ push token trước khi xoá token):
  **[RN_AUTH_AND_PUSH.md](RN_AUTH_AND_PUSH.md) mục 1**.

### Endpoint của user đã login (Bearer)

| Method     | Path                 | Ghi chú                                               |
| ---------- | -------------------- | ----------------------------------------------------- |
| GET / PUT  | `/me/favorite-teams` | PUT `{ teams: string[] }` (≤ 20, ghi đè)              |
| GET        | `/me/feed`           | Tin của các đội yêu thích, phân trang như `/articles` |
| POST / DEL | `/me/push-tokens`    | `{ token: "ExponentPushToken[…]", platform? }` → 204  |

Chi tiết: [RN_AUTH_AND_PUSH.md](RN_AUTH_AND_PUSH.md) mục 2–3.

---

## 4. Luồng public — dữ liệu cho app

Tất cả endpoint dưới đây **không cần token**. Dữ liệu được crawler cập nhật mỗi ngày 04:00.

### Endpoint

| Method | Path                                                                             | Dùng cho                                                                                                                        |
| ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/leagues`                                                                       | Danh sách giải (7 giải: `ngoai-hang-anh`, `laliga`, `serie-a`, `bundesliga`, `ligue-1`, `champions-league`, `v-league`)         |
| GET    | `/leagues/:id`                                                                   | Chi tiết giải                                                                                                                   |
| GET    | `/teams?filter[league]=<leagueId>&sort=name&per_page=40`                         | Đội của một giải                                                                                                                |
| GET    | `/teams/:id`                                                                     | Chi tiết đội (kèm `league` populated)                                                                                           |
| GET    | `/ranks/league/:leagueId?per_page=40`                                            | **Bảng xếp hạng** (mặc định sort theo `rank`)                                                                                   |
| GET    | `/fixtures/league/:leagueId?filter[status]=finished&sort=-start_time`            | **Kết quả** mới nhất                                                                                                            |
| GET    | `/fixtures/league/:leagueId?filter[status]=scheduled&sort=start_time`            | **Lịch** sắp tới                                                                                                                |
| GET    | `/fixtures/league/:leagueId?filter[round]=6&sort=start_time&per_page=20`         | Trận theo vòng                                                                                                                  |
| GET    | `/fixtures?from=2026-10-10&to=2026-10-10T23:59:59Z&sort=start_time&per_page=100` | **Trận trong ngày**, mọi giải                                                                                                   |
| GET    | `/fixtures?filter[host_team]=<teamId>` / `filter[guest_team]=`                   | Trận của đội (gọi 2 lần hoặc lọc client)                                                                                        |
| GET    | `/fixtures/:id`                                                                  | Chi tiết trận (populated `host_team`, `guest_team`, `league`)                                                                   |
| GET    | `/configs`                                                                       | Key/value cấu hình (banner, thông báo…)                                                                                         |
| GET    | `/articles?per_page=20`                                                          | **Tin tức** mới nhất (mặc định sort `-published_at`)                                                                            |
| GET    | `/articles?filter[category_slug]=tin-chuyen-nhuong`                              | Tin theo chuyên mục (`tin-chuyen-nhuong`, `v-league`, `premier-league`…) — chi tiết: [NEWS_INTEGRATION.md](NEWS_INTEGRATION.md) |
| GET    | `/articles?filter[teams]=<teamId>`                                               | Tin của một đội (gắn tự động lúc crawl)                                                                                         |
| GET    | `/articles?filter[tags]=Arsenal` / `from=`/`to=`                                 | Tin theo tag / theo khoảng `published_at`                                                                                       |
| GET    | `/articles/:id`                                                                  | Chi tiết bài (metadata)                                                                                                         |

`/scores` vẫn tồn tại nhưng **deprecated** — mọi thứ đã có trong Fixture.

**Tin tức chỉ có metadata** (tiêu đề, sapo, ảnh đại diện, chuyên mục, tag, link gốc) — không có
nội dung bài, vì bài viết của bongda.com.vn có bản quyền. Màn chi tiết hiển thị sapo + nút
"Đọc tiếp" mở `url` (WebView / in-app browser) và ghi rõ nguồn. Tin mới được crawl mỗi 6 giờ.

### `src/api/services/publicApi.ts`

```ts
import { request } from "../client";
import type { Article, Fixture, League, ListResponse, Rank, Team } from "../types";

export const publicApi = {
  leagues: () =>
    request<ListResponse<League>>("/leagues", { auth: false, query: { per_page: 50, sort: "name" } }),
  league: (id: string) => request<League>(`/leagues/${id}`, { auth: false }),

  teams: (leagueId: string) =>
    request<ListResponse<Team>>("/teams", {
      auth: false,
      query: { filter: { league: leagueId }, sort: "name", per_page: 50 },
    }),

  standings: (leagueId: string) =>
    request<ListResponse<Rank>>(`/ranks/league/${leagueId}`, { auth: false, query: { per_page: 50 } }),

  results: (leagueId: string, page = 1) =>
    request<ListResponse<Fixture>>(`/fixtures/league/${leagueId}`, {
      auth: false,
      query: { filter: { status: "finished" }, sort: "-start_time", page, per_page: 20 },
    }),

  upcoming: (leagueId: string, page = 1) =>
    request<ListResponse<Fixture>>(`/fixtures/league/${leagueId}`, {
      auth: false,
      query: { filter: { status: "scheduled" }, sort: "start_time", page, per_page: 20 },
    }),

  round: (leagueId: string, round: number) =>
    request<ListResponse<Fixture>>(`/fixtures/league/${leagueId}`, {
      auth: false,
      query: { filter: { round }, sort: "start_time", per_page: 40 },
    }),

  // Trận trong một ngày (theo giờ VN): from = 00:00 VN, to = 23:59:59 VN, quy về UTC
  byDay: (day: Date) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return request<ListResponse<Fixture>>("/fixtures", {
      auth: false,
      query: { from: start.toISOString(), to: end.toISOString(), sort: "start_time", per_page: 100 },
    });
  },

  fixture: (id: string) => request<Fixture>(`/fixtures/${id}`, { auth: false }),

  articles: (page = 1, category?: string) =>
    request<ListResponse<Article>>("/articles", {
      auth: false,
      query: { page, per_page: 20, ...(category && { filter: { category_slug: category } }) },
    }),
  article: (id: string) => request<Article>(`/articles/${id}`, { auth: false }),
};
```

### React Query hooks (gợi ý)

```ts
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { publicApi } from "../api/services/publicApi";

export const useLeagues = () =>
  useQuery({ queryKey: ["leagues"], queryFn: publicApi.leagues, staleTime: 24 * 3600_000 });

export const useStandings = (leagueId: string) =>
  useQuery({
    queryKey: ["standings", leagueId],
    queryFn: () => publicApi.standings(leagueId),
    staleTime: 3600_000,
  });

export const useResults = (leagueId: string) =>
  useInfiniteQuery({
    queryKey: ["results", leagueId],
    queryFn: ({ pageParam }) => publicApi.results(leagueId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current < last.meta.pages ? last.meta.current + 1 : undefined),
  });
```

### Ba điểm phải nhớ khi dựng UI

1. **`status`** quyết định cách render một trận: `scheduled` → giờ đá, `live` → tỉ số + nhấp nháy, `finished` → tỉ số, `postponed` → "Hoãn". `home_score`/`away_score` chỉ có khi `live`/`finished`.
2. **`history_match`** trong Rank là mảng `"W" | "D" | "L"` (crawler ghi 5 trận gần nhất, mới nhất ở cuối). Có thể rỗng khi đầu mùa.
3. **Giờ**: `start_time` là UTC. `new Date(start_time)` rồi format theo local là đủ (máy ở VN sẽ ra +7). Không tự cộng 7 giờ.

---

## 5. TypeScript types — `src/api/types.ts`

```ts
export interface ListResponse<T> {
  data: T[];
  meta: { total: number; current: number; per_page: number; pages: number };
}

export interface Article {
  _id: string;
  title: string;
  summary: string; // sapo
  thumbnail: string; // URL ảnh trên media.bongda.com.vn
  url: string; // bài gốc — mở để đọc toàn văn
  published_at: string; // ISO
  category?: string; // "Tin Chuyển Nhượng"
  category_slug?: string; // "tin-chuyen-nhuong"
  tags: string[];
  author?: string;
  teams: string[]; // id các đội bài viết nói tới (có thể rỗng)
}

export interface League {
  _id: string;
  name: string; // "Ngoại Hạng Anh"
  slug?: string; // "ngoai-hang-anh"
  logo: string;
  country?: string; // "Anh"
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  _id: string;
  name: string; // "Manchester United"
  short_name?: string;
  logo: string;
  league?: League | string; // populated ở /teams, id ở nơi khác
}

export type FixtureStatus = "scheduled" | "live" | "finished" | "postponed";

export interface Fixture {
  _id: string;
  league: League; // luôn populated ở /fixtures*
  host_team: Team;
  guest_team: Team;
  start_time: string; // ISO UTC
  round?: number;
  status: FixtureStatus;
  venue?: string;
  home_score?: number;
  away_score?: number;
}

export interface Rank {
  _id: string;
  league: League;
  team: Team;
  rank: number; // vị trí
  point: number;
  total_match: number; // số trận
  win: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  history_match: ("W" | "D" | "L")[];
  efficiency: number; // point / (total_match*3), 0..1
}

export interface User {
  _id: string;
  username: string;
  fullname: string;
  email: string;
  role?: { _id: string; name: string; slug: "admin" | "user" };
}

export interface Config {
  _id: string;
  key: string;
  value: string;
}
```

---

## 6. Luồng admin (chỉ khi làm màn quản trị)

Cần token của user có `role.slug === "admin"`. Non-admin → 403.

| Method              | Path              | Body (partial cho PUT)                                                                                                                                    |
| ------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST/PUT/DELETE     | `/leagues[/:id]`  | `{ name, logo, slug?, country? }`                                                                                                                         |
| POST/PUT/DELETE     | `/teams[/:id]`    | `{ name, logo, league?, short_name?, aliases? }`                                                                                                          |
| POST/PUT/DELETE     | `/fixtures[/:id]` | `{ host_team, guest_team, league, start_time?, round?, status?, venue?, home_score?, away_score? }`                                                       |
| POST/PUT/DELETE     | `/ranks[/:id]`    | `{ team, league, rank?, point?, win?, draw?, lost?, total_match?, goals_for?, goals_against?, goal_diff?, history_match? }` — 1 đội chỉ 1 dòng/giải (409) |
| POST/PUT/DELETE     | `/configs[/:id]`  | `{ key, value }`                                                                                                                                          |
| GET/POST/PUT/DELETE | `/users[/:id]`    | `{ username, password, fullname, email, role? }`                                                                                                          |
| GET/POST/PUT/DELETE | `/roles[/:id]`    | `{ name, slug? }`                                                                                                                                         |

Lưu ý: dữ liệu crawl có `source: "bongda"` và sẽ **bị ghi đè** mỗi đêm; sửa tay chỉ nên với bản ghi `source: "manual"` (tạo qua API).

---

## 7. Checklist chuyển đổi

- [ ] `request()` mới (mục 2) + refresh token.
- [ ] Đổi mọi `err.msg` → `err.message`; 400 → 401 cho login.
- [ ] Bỏ `escapeRegex`, bỏ workaround `/leagues/:id`.
- [ ] Bỏ service `/scores`, đọc tỉ số từ `Fixture`.
- [ ] Phân trang bằng `meta.pages`.
- [ ] BXH: dùng `goals_for/goals_against/goal_diff/history_match`.
- [ ] Route theo `league.slug` thay vì hardcode id (id đổi khi tạo lại DB).
- [ ] Màn "hôm nay": `publicApi.byDay(new Date())`.
- [ ] Xoá mock data / adapter football-data.org.
- [ ] Auth + đội yêu thích + push: checklist trong [RN_AUTH_AND_PUSH.md](RN_AUTH_AND_PUSH.md) mục 4.
