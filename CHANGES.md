# Sport1 API — Nhật ký thay đổi (branch `stg`, 09/2026)

Tài liệu này mô tả toàn bộ thay đổi so với `origin/stg` (`bbd48b8`), theo đúng thứ tự
commit, để reviewer đọc PR và team client (React Native) cập nhật adapter.

```
bbd48b8  origin/stg (bản cũ)
   │
   ├─ 51a5cac  chore: bỏ track node_modules + .env, thêm .env.example        ┐
   ├─ d983afa  refactor: config từ env, cache DB connection cho serverless   │ Phase 0
   ├─ 7671175  fix(auth): jwt.verify, refresh token sạch, whitelist field    ┘
   ├─ 8429d02  refactor: CRUD factory, phân trang thật, error handler chung  — Phase 1
   ├─ 541ab23  chore: dọn deps, bcryptjs, eslint/prettier, tsx               — Phase 3
   ├─ e0391b4  feat: zod validation, index, script seed                      ┐ Phase 2
   ├─ 75bd5f1  docs: env tuỳ chọn trong .env.example                         ┘
   └─ 09325ae  test: vitest + supertest, GitHub Actions CI                   — Phase 4
```

---

## 1. Vì sao phải sửa

| Vấn đề trên bản cũ                                                                                               | Hậu quả                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cụm MongoDB Atlas đã bị xoá, connection string **hardcode** kèm mật khẩu ở `src/app.ts` và `helper/dbconnect.ts` | Mọi `/api/*` trả 500; set env trên Vercel vô tác dụng; mật khẩu lộ trên GitHub |
| `.env` và `node_modules/` (516 file) bị commit                                                                   | Secret JWT lộ; repo nặng                                                       |
| Middleware admin dùng `jwt.decode()` (không verify chữ ký)                                                       | Ai cũng tự tạo token `{username:"admin"}` và gọi được API admin                |
| Refresh token chứa **password plaintext**                                                                        | JWT chỉ là base64 — đọc được                                                   |
| `app.listen()` ở module scope, connect DB mỗi cold start                                                         | Sai mô hình serverless Vercel                                                  |
| `GET /leagues/:id` gọi `find()` thay vì `findById`                                                               | Trả cả danh sách                                                               |
| `meta.total` = số phần tử trang hiện tại                                                                         | `pages` luôn = 1, không phân trang được                                        |
| `new RegExp(value)` không escape, không flag `i`                                                                 | Gõ `(` là 500; tìm kiếm phân biệt hoa thường                                   |
| `Date.now()` gọi lúc khai báo schema                                                                             | Mọi bản ghi cùng một timestamp lúc boot                                        |
| 8 controller copy-paste, mỗi hàm bọc `try/catch` riêng                                                           | 900 dòng trùng lặp, sửa một bug phải sửa 8 chỗ                                 |
| Không validate input, `req.body` spread thẳng vào model                                                          | Client tự set `role`, ghi password chưa hash                                   |
| `tslint` deprecated, `multer`/`cookie-parser`/`mongodb`/`lodash` không dùng, `ts-node` thiếu                     | Script `dev`/`start` không chạy được                                           |

---

## 2. Luồng request: trước và sau

### Trước

```
client ─► express.json ─► router ─► [authAdminToken: jwt.decode → tìm user] ─► controller
                                                                                  │
                                                     try { Model.find(req.body…) } catch → 500
```

### Sau

```
client
  │
  ▼
express.json ─► cors
  │
  ▼
/api  ─► connectDB()            (cache connection; 503 nếu DB không lên)
  │
  ▼
router
  ├─ authenticate               (jwt.verify access token → req.user, 401)
  ├─ requireRole("admin")       (403)
  ├─ validate(schema, "params") (zod: ObjectId, 400)
  ├─ validate(schema, "query")  (zod: page/per_page/sort/filter, 400)
  ├─ validate(schema, "body")   (zod: strip field lạ, trim, coerce, 400)
  │
  ▼
controller  = createCrudController(Model, { label, populate, fields })
  │           list / getById / create / update / remove
  │           hoặc handler riêng (getFixturesByLeagueId, authLogin, …)
  │
  ▼
asyncHandler ─► errorHandler
                 HttpError        → status của nó
                 CastError        → 400  "Invalid _id: …"
                 ValidationError  → 400
                 duplicate key    → 409  "Duplicate value for name"
                 JSON hỏng        → 400
                 còn lại          → 500
                 route lạ         → 404
                 (luôn là { "message": "…" })
```

---

## 3. Chi tiết từng phase

### Phase 0 — Hồi sinh & khoá bảo mật

**`51a5cac`**

- `git rm --cached node_modules .env`; `.gitignore` mới ignore `.env`, `dist/`, `.vercel/`.
- Thêm [`.env.example`](.env.example) liệt kê mọi biến.

**`d983afa`**

- [`config/env.ts`](config/env.ts): nơi duy nhất đọc env. `MONGODB_URI`, `ACCESS_TOKEN_SECRET`,
  `REFRESH_TOKEN_SECRET` là **bắt buộc** — thiếu là throw ngay lúc boot, **không còn fallback**
  `"khoidev311"`.
- [`helper/dbconnect.ts`](helper/dbconnect.ts): cache promise connection ở module scope;
  request warm dùng lại, lỗi thì reset để retry.
- [`src/app.ts`](src/app.ts): bỏ URI hardcode; middleware `/api` gọi `connectDB()` trước;
  chỉ `app.listen()` khi `require.main === module` (local). Trên Vercel `api/index.ts`
  export app như cũ.

**`7671175`**

- [`helper/token.ts`](helper/token.ts): access token `{sub, username, type:"access"}`,
  refresh token `{sub, type:"refresh"}` ký bằng **secret riêng**; `verifyAccessToken` /
  `verifyRefreshToken` kiểm tra cả chữ ký lẫn `type`.
- [`middleware/authToken.ts`](middleware/authToken.ts): tách `authenticate` (401) và
  `requireRole(slug)` (403). `authAdminToken` giữ tên cũ = `[authenticate, requireRole("admin")]`.
- [`modules/Auth`](modules/Auth): thêm `POST /auth/refresh`; login trả cùng 401 cho sai user
  và sai password; `/auth/me` đi qua `authenticate`.
- [`modules/User`](modules/User): whitelist field, hash password khi update, không cho set
  `role` khi tự đăng ký.

### Phase 1 — Sửa bug logic, gộp code trùng (`8429d02`)

- [`helper/http.ts`](helper/http.ts): `asyncHandler`, `HttpError`, `errorHandler`, `notFoundHandler`.
- [`helper/commonHelper.ts`](helper/commonHelper.ts): `queryBuilder` escape regex + flag `i`,
  `per_page` mặc định 20 (max 100), `page ≥ 1`; `paginate()` dùng `countDocuments`.
- [`helper/crud.ts`](helper/crud.ts): `createCrudController(Model, opts)` → mỗi module còn 5–25 dòng.
- `GET /leagues/:id` → `findById`; `getById` trả 404 thay vì `200 null`; `create` trả 201;
  `update` một query với `{ new: true, runValidators: true }`.
- `/fixtures|scores|ranks/league/:id` → `find({ league: id })` + phân trang (trước: load
  toàn bộ collection rồi lọc bằng JS).
- Model: `timestamps: { createdAt: "created_at", updatedAt: "updated_at" }`; `start_time`
  default `Date.now` (hàm); `rank.history_match` default `[]`; ref `host_team/guest_team/league/team`
  thành `required`.

### Phase 3 — Tooling & dependencies (`541ab23`)

- Gỡ: `multer`, `cookie-parser`, `mongodb`, `lodash`, `tslint`, `nodemon`, `ts-node`.
- `bcrypt` → `bcryptjs`: không cần native build trên Vercel, bỏ chuỗi `node-pre-gyp → tar`
  (4 CVE). Hash `$2b$` tương thích — user cũ login bình thường. `npm audit`: 0.
- Update minor: express 4.22, mongoose 8.24, typescript 5.9.
- ESLint flat config + Prettier; script: `dev` (tsx watch), `build`, `start`, `typecheck`,
  `lint`, `format`.

### Phase 2 — Validation, index, seed (`e0391b4`, `75bd5f1`)

- [`middleware/validate.ts`](middleware/validate.ts) + [`helper/schemas.ts`](helper/schemas.ts):
  mọi route validate `params`, `query`, `body`. Lỗi 400 liệt kê **tất cả** issue.
- Index: `fixture(league, start_time)`, `score(league)`, `rank(league, rank)`,
  `rank(league, team)` **unique**, `team(league)`, `role(slug)` unique.
- [`scripts/seed.ts`](scripts/seed.ts): `npm run seed` upsert role `admin`/`user`, tạo admin
  từ `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`. Chạy lại an toàn.

### Phase 4 — Test & CI (`09325ae`)

- 20 test tích hợp ([`tests/`](tests/)) với `mongodb-memory-server`, mỗi file test một
  process + một DB riêng, wipe collection sau mỗi test.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): typecheck → lint → prettier →
  test → build trên push/PR vào `master`/`stg`.

---

## 4. Breaking change cho client (React Native)

| #   | Thay đổi                  | Trước                                    | Sau                                                                                                                           | Client cần làm                                                       |
| --- | ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Shape lỗi                 | `{ msg }` (auth) và `{ message }` (CRUD) | **luôn** `{ message }`                                                                                                        | Bỏ `body.msg ?? body.message`, chỉ đọc `message`                     |
| 2   | Login sai                 | 400                                      | **401**                                                                                                                       | Đổi điều kiện hiển thị "sai tài khoản"                               |
| 3   | `/auth/me` không token    | 400                                      | **401**                                                                                                                       | —                                                                    |
| 4   | Token cũ                  | payload `{username}`                     | payload `{sub, username, type}`                                                                                               | User phải **login lại** sau deploy                                   |
| 5   | Refresh token             | chứa password                            | `{sub, type}`                                                                                                                 | Dùng `POST /auth/refresh { refresh_token }` khi access token hết hạn |
| 6   | `GET /leagues/:id`        | trả `{ data: [...] }`                    | trả **1 object**                                                                                                              | Bỏ workaround "lấy list rồi tìm"                                     |
| 7   | `per_page`                | mặc định 99, không giới hạn              | mặc định **20**, max **100**, vượt → 400                                                                                      | Truyền `per_page` tường minh                                         |
| 8   | `meta`                    | `total` sai, `pages` luôn 1              | `{ total, current, per_page, pages }` đúng                                                                                    | Có thể dùng `pages` để phân trang thay vì so `data.length`           |
| 9   | `page=abc`, `sort=name;x` | im lặng                                  | 400                                                                                                                           | —                                                                    |
| 10  | `filter[name]`            | phân biệt hoa thường                     | không phân biệt, escape regex                                                                                                 | Bỏ `escapeRegex` phía client (giữ cũng không sao)                    |
| 11  | `create`                  | 200                                      | **201**                                                                                                                       | Nếu check `status === 200` thì đổi thành `2xx`                       |
| 12  | Id sai / không tồn tại    | 500 / `200 null`                         | **400** / **404**                                                                                                             | —                                                                    |
| 13  | Trùng `name`/`logo`/`key` | 500                                      | **409**                                                                                                                       | —                                                                    |
| 14  | Body validation           | không                                    | 400 nếu sai: `score` phải `"2-1"`; `history_match` chỉ `W/D/L`; `username` ≥3 `[a-zA-Z0-9_.-]`; `password` ≥6; `email` hợp lệ | Validate phía client cho khớp                                        |
| 15  | Field lạ trong body       | lưu vào DB                               | bị **bỏ**                                                                                                                     | —                                                                    |
| 16  | `/fixtures                | scores                                   | ranks/league/:id`                                                                                                             | chỉ có `meta.total`                                                  | có `current/per_page/pages`, nhận `page`/`per_page`/`sort` | —   |
| 17  | Rank                      | nhiều rank cùng team+league              | **unique** team/league                                                                                                        | Dùng PUT để cập nhật thay vì POST lại                                |

Không đổi: base URL, prefix `/api`, `Authorization: Bearer`, envelope `{ data, meta }`
cho danh sách, object thẳng cho chi tiết, tên field trong model, route public/admin.

---

## 5. Endpoint sau thay đổi

| Method | Path                                                 | Auth           | Validate                          |
| ------ | ---------------------------------------------------- | -------------- | --------------------------------- |
| POST   | `/api/auth/register`                                 | —              | `registerBody`                    |
| POST   | `/api/auth/login`                                    | —              | `loginBody`                       |
| POST   | `/api/auth/refresh`                                  | —              | `refreshBody` **(mới)**           |
| GET    | `/api/auth/me`                                       | user           | —                                 |
| GET    | `/api/{leagues,teams,fixtures,scores,ranks,configs}` | —              | `listQuery`                       |
| GET    | `/api/{…}/:id`                                       | —              | `idParam`                         |
| GET    | `/api/{fixtures,scores,ranks}/league/:id`            | —              | `idParam` + `listQuery`           |
| POST   | `/api/{…}`                                           | admin          | `xxxCreate`                       |
| PUT    | `/api/{…}/:id`                                       | admin          | `idParam` + `xxxUpdate` (partial) |
| DELETE | `/api/{…}/:id`                                       | admin          | `idParam`                         |
| \*     | `/api/users`, `/api/roles`                           | admin (cả đọc) | như trên                          |

---

## 6. Checklist deploy

1. Tạo cụm MongoDB Atlas mới, mật khẩu mới, Network Access `0.0.0.0/0`.
2. Vercel → Environment Variables:
   - `MONGODB_URI`
   - `ACCESS_TOKEN_SECRET` — **giá trị mới** (giá trị cũ đã nằm trong git history)
   - `REFRESH_TOKEN_SECRET`
   - (tuỳ chọn) `ACCESS_TOKEN_TTL=8h`, `REFRESH_TOKEN_TTL=7d`
3. Seed DB mới từ máy local:
   ```bash
   MONGODB_URI=… ACCESS_TOKEN_SECRET=… REFRESH_TOKEN_SECRET=… \
   SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='…' npm run seed
   ```
4. Nếu migrate dữ liệu cũ: kiểm tra không có 2 rank cùng `team + league` (index unique sẽ
   fail khi build), và các Fixture/Score/Rank có đủ ref (`required`).
5. `git push origin stg` → mở PR `stg → master`; CI phải xanh.
6. Báo team RN cập nhật theo mục 4; user phải login lại.

---

## 7. Chạy local

```bash
cp .env.example .env      # điền MONGODB_URI và 2 secret
npm install
npm run seed              # tuỳ chọn, cần SEED_ADMIN_*
npm run dev               # http://localhost:3000, tsx watch
npm test                  # vitest, tự tải mongod lần đầu
npm run lint && npm run typecheck && npm run build
```

---

## 8. Crawler dữ liệu thật (22/09)

- Models có thêm `source` + `external_id` (index unique partial), League `slug/country/
season_external_id`, Team `short_name`, Fixture `round/status/venue/home_score/away_score`,
  Rank `goals_for/goals_against/goal_diff`. Bỏ `unique` trên `Team.name`/`logo`,
  `League.logo`. Client không thể set `source`/`external_id` qua API.
- `scripts/crawl/` — nguồn `bongda.com.vn` (xem `docs/CRAWLER_PLAN.md`): `npm run crawl --
league <slug> [--rounds all|current|5,6] [--dry-run]`, `npm run crawl -- daily`.
- **Client RN:** Fixture giờ có tỉ số ngay trong document (`home_score`, `away_score`,
  `status`); có thể bỏ gọi `/scores`. `GET /fixtures/league/:id?filter[status]=finished&sort=-start_time`
  = kết quả mới nhất; `filter[status]=scheduled&sort=start_time` = lịch sắp tới.

## 9. Chưa làm

- **Express 5 / Mongoose 9** (major, có breaking change) — để PR riêng sau khi bản này chạy
  ổn trên production.
- Rate limit cho `/auth/login`, `/auth/register`.
- Tài liệu API cho client (`API_FOR_REACT_NATIVE.md` cũ đã mất; cần viết lại theo mục 4–5).
