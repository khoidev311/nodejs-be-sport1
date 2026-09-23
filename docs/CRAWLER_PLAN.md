# Kế hoạch crawler dữ liệu từ bongda.com.vn

> **Trạng thái (22/09/2026):** bước 1–3 đã xong — schema, `scripts/crawl/`, test offline
> (11 test) và PoC crawl Ngoại hạng Anh: 380 trận / 20 đội / 50 kết quả / 20 dòng BXH
> trong 38 s, chạy lại idempotent. Bước 4 xong: `.github/workflows/crawl.yml` chạy
> `crawl daily` 04:00 giờ VN (cần secret `MONGODB_URI`, `ACCESS_TOKEN_SECRET`,
> `REFRESH_TOKEN_SECRET`; tuỳ chọn variable `DAILY_LEAGUES`). Đã dry-run 7 giải trên site
> thật (LaLiga, Serie A, Bundesliga, Ligue 1, UCL 36 đội, V-League) — parser dùng chung.
> Còn lại: bước 5 (docs cho RN).
>
> ```bash
> npm run crawl -- leagues                              # 124 giải nguồn biết
> npm run crawl -- league ngoai-hang-anh                # full 38 vòng
> npm run crawl -- league ngoai-hang-anh --rounds current --dry-run
> npm run crawl -- daily                                # 7 giải mặc định, vòng hiện tại ±1
> ```

Mục tiêu: đổ dữ liệu thật (giải đấu, đội bóng, lịch thi đấu, kết quả, bảng xếp hạng) vào
MongoDB của Sport1 API, chạy lại được hằng ngày để cập nhật.

---

## 1. Kết quả khảo sát (22/09/2026)

### 1.1. robots.txt

```
User-agent: *
Allow: /
Disallow: /tim-kiem
Disallow: /*?q=
Disallow: /*?recommId=
Disallow: /result
```

Các đường dẫn ta cần (`/giai-dau/...`, `/doi-bong/...`, `/api/...`) **không bị cấm**.
`/result` bị cấm là trang kết quả tổng hợp ở root, khác với `/giai-dau/{id}/result/...`.

### 1.2. Cách site tải dữ liệu

Trang HTML render server-side (jQuery + select2), **phần dữ liệu thể thao tải bằng
`fetch()` tới API nội bộ** trả JSON dạng `{ "status": "success", "html": "<fragment>" }`.
Vì vậy crawler **không cần headless browser** — chỉ cần gọi API + parse HTML fragment.

| Dữ liệu                   | Nguồn                                                                                                         | Ghi chú                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Danh sách giải            | HTML trang chủ: `href="/giai-dau/{id}/summary/{slug}"` (151 giải)                                             | Có sẵn logo trong biến JS `templates`                                                                                                                                    |
| Danh sách đội của giải    | HTML `/giai-dau/{id}/teams/{slug}` (server-rendered)                                                          | Parse trong vùng nội dung, bỏ nav                                                                                                                                        |
| Thông tin đội             | HTML `/doi-bong/{id}/overview/{slug}`                                                                         | Chỉ cần khi thiếu logo                                                                                                                                                   |
| Vòng đấu                  | HTML `/giai-dau/{id}/fixtures/{slug}` → `<select id="league-round"><option value="{roundId}">Vòng N</option>` | roundId **không** = số vòng (PL: Vòng 1 = 38). Thuộc tính `selected` **không đáng tin** (Ligue 1 trỏ vòng 1 giữa mùa) → crawler binary-search vòng đầu tiên chưa đá xong |
| Lịch thi đấu theo vòng    | `GET /api/fixtures/group-by-round?round_type={roundId}&tournament_id={id}`                                    | 10 trận / vòng, đúng 100% với PL                                                                                                                                         |
| Kết quả theo vòng         | `GET /api/fixtures/group-by-round?round_type={roundId}&tournament_id={id}&sort=desc&isResult=True`            | Cùng fragment, có tỉ số + nhãn `KT`                                                                                                                                      |
| Bảng xếp hạng             | `GET /api/league-table/home?tournament_id={id}&is_detail=True&team_ids=`                                      | 20 dòng `.leaderboard-item#team_{id}`                                                                                                                                    |
| Lịch / kết quả trong ngày | `GET /api/fixtures/daily-schedule`, `GET /api/fixtures/daily-result`                                          | Dùng cho cron hằng ngày                                                                                                                                                  |

Site có **2 loại id**: `template id` (ổn định qua các mùa, trong biến JS `templates`:
PL = 8, LaLiga = 29, Serie A = 14, Bundesliga = 13, Ligue 1 = 12, V-League = 91, UCL = 4)
và `tournament_id` (**một mùa giải cụ thể**, đổi mỗi mùa). API dùng `tournament_id`.
Crawler lưu cả hai: `external_id` = template id cho League, `season_external_id` =
tournament_id để sang mùa mới chỉ cần đọc lại trang chủ.

`tournament_id` mùa 2026–27 đã xác định:

| Giải             | id    | slug               |
| ---------------- | ----- | ------------------ |
| Ngoại hạng Anh   | 36781 | `ngoai-hang-anh`   |
| La Liga          | 38843 | `laliga`           |
| Serie A          | 36072 | `serie-a`          |
| Bundesliga       | 40040 | `bundesliga`       |
| Ligue 1          | 37298 | `ligue-1`          |
| Champions League | 47760 | `champions-league` |
| V-League         | 48181 | `v-league`         |

### 1.3. Cấu trúc fragment (đã verify với PL vòng 5 & 6)

**Trận đấu** — mỗi `li.match-detail`:

```html
<p class="round">Vòng: <strong>5</strong></p>
<p class="match-time">22:30 - 20-09-2026</p>
<!-- giờ Việt Nam, UTC+7 -->
<a class="team home-team" href="/doi-bong/830/overview/fulham" title="Fulham">
  <p class="name">Fulham</p>
  <p class="logo"><img src="https://media.bongda.com.vn/tests/team-logo/….png" /></p>
</a>
<div class="status">
  <a href="/tran-dau/5795459/centre/…">
    <!-- match id = 5795459 -->
    <span>1</span> <span>-</span> <span>1</span> <span class="label">KT</span>
    <!-- đã đá -->
    <!-- hoặc -->
    <p class="vs">VS</p>
    <!-- chưa đá -->
  </a>
</div>
<a class="team away-team" href="/doi-bong/1029/overview/manchester-united" title="Manchester United">…</a>
<a class="league" href="/giai-dau/36781/summary/ngoai-hang-anh">Ngoại Hạng Anh</a>
<p class="venue">Craven Cottage</p>
```

**Bảng xếp hạng** — mỗi `div.leaderboard-item#team_{teamId}`:

```html
<div class="team">
  <span>1</span>
  <a href="/doi-bong/854/overview/manchester-city"
    ><img src="…logo…" />
    <p>Manchester City</p></a
  >
</div>
<div class="copy">
  <p>5</p>
  <p>5</p>
  <p>0</p>
  <p>0</p>
  <p>13</p>
  <p>5</p>
  <p>8</p>
  <p><strong>15</strong></p>
  <!--  Trận  Thắng  Hòa   Bại   BT     BB    HS    Điểm -->
  <p class="form"><span class="bg-green">T</span> …</p>
  <!-- T/H/B = W/D/L -->
</div>
```

Tên CLB nước ngoài là **tiếng Anh** (Manchester United, Arsenal…), khớp với dữ liệu mock
hiện tại của app RN.

---

## 2. Pháp lý & ứng xử

- bongda.com.vn là cơ quan báo chí; dữ liệu tỉ số/lịch thi đấu là **sự kiện công khai**
  (không có bản quyền trên dữ kiện), nhưng HTML/bài viết/ảnh là nội dung có bản quyền.
  Crawler **chỉ lấy dữ kiện thể thao**, không lấy nội dung bài viết, không rehost ảnh nếu
  dùng production (xem mục 4.3). Tin tức (`crawl articles`) chỉ lưu **metadata** — tiêu đề,
  sapo, URL ảnh, chuyên mục, tag, link về bài gốc — như một trang tổng hợp tin.
- Rate limit **≤ 1 request/giây**, `User-Agent` tự nhận diện (`Sport1Crawler/1.0
(+contact email)`), cache theo ngày, chạy lúc ít tải (03:00–05:00 giờ VN).
- Dùng cho **staging / phát triển app**. Nếu lên production thương mại, cân nhắc nguồn
  có giấy phép (football-data.org free tier 10 req/phút, 12 giải; API-Football…) — cùng
  một lớp `Source` adapter, đổi nguồn không đổi model.

---

## 3. Thay đổi schema cần thiết

Thêm vào các model để upsert idempotent và truy vết nguồn:

```ts
// mọi model được crawl
source:      { type: String, enum: ["manual", "bongda"], default: "manual" },
external_id: { type: String },            // index { source, external_id } unique sparse
```

| Model   | Thêm field                                                                                                            | Lý do                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| League  | `slug`, `country?`                                                                                                    | link ngược, lọc                                                          |
| Team    | `short_name?`                                                                                                         | hiển thị mobile                                                          |
| Fixture | `round: Number`, `status: "scheduled" \| "live" \| "finished" \| "postponed"`, `venue?`, `home_score?`, `away_score?` | site trả tỉ số ngay trong fixture → **không cần collection Score riêng** |
| Rank    | `played` (= total_match), `goals_for`, `goals_against`, `goal_diff`                                                   | site có đủ; `goal` hiện tại mơ hồ                                        |

Đề xuất: **giữ Score để tương thích API cũ** nhưng crawler ghi tỉ số vào `Fixture` và
đồng thời tạo/cập nhật Score cho trận `finished`. Sau khi app RN chuyển sang đọc
`fixture.home_score/away_score`, bỏ Score (đã ghi ở `docs/DATA_MODEL.md` mục 8.2).

Bỏ `unique` trên `Team.logo` / `League.logo` (nhiều đội có thể dùng logo placeholder
của site).

---

## 4. Kiến trúc crawler

```
scripts/crawl/
├── client.ts          fetch có UA, rate-limit 1 rps, retry + backoff, cache file theo ngày
├── sources/bongda/
│   ├── urls.ts        buildLeagueUrl(), buildRoundApi(), …
│   ├── parsers/
│   │   ├── leagues.ts     trang chủ  → [{ external_id, name, slug, logo }]
│   │   ├── rounds.ts      trang fixtures → [{ roundId, number }]
│   │   ├── matches.ts     fragment  → [{ external_id, round, start_time, home, away, score?, status, venue }]
│   │   └── standings.ts   fragment  → [{ team, position, played, win, draw, lost, gf, ga, gd, points, form }]
│   └── index.ts       BongdaSource implements Source
├── source.ts          interface Source { leagues(); teams(league); rounds(league); matches(league, round); standings(league) }
├── sync.ts            upsert theo { source, external_id }; map team/league sang ObjectId
└── cli.ts             crawl leagues | crawl league <id> [--rounds all|current] | crawl daily
```

### 4.1. Luồng đồng bộ một giải

```
1. leagues()      → upsert League                         (1 request, cache 7 ngày)
2. rounds(L)      → [{roundId, number}]                    (1 request)
3. standings(L)   → upsert Team (name, logo, external_id) (1 request)
                  → upsert Rank { league, team } unique
4. for round in rounds:
     matches(L, round)  → upsert Fixture theo external_id (= id trong /tran-dau/{id}/)
                        → nếu status = finished: upsert Score
   (PL: 38 requests; với --rounds current chỉ lấy vòng hiện tại ±1 → 3 requests)
```

Một giải full ≈ 41 request ≈ 45 giây ở 1 rps. 6 giải ≈ 5 phút. Cron hằng ngày dùng
`--rounds current` + `standings` ≈ 5 request/giải.

### 4.2. Parse & chuẩn hoá

- `cheerio` để parse fragment (nhẹ, không cần browser).
- Thời gian: `"22:30 - 20-09-2026"` → `dayjs.tz("2026-09-20 22:30", "Asia/Ho_Chi_Minh")`
  → lưu UTC. **Không** dùng `new Date(string)` (sẽ hiểu theo timezone server).
- Trạng thái: có `.label` = `KT` → `finished`; có `.vs` → `scheduled`; nhãn khác
  (`H1`, `H2`, `HP`, `Hoãn`) → `live` / `postponed` — cần quan sát thêm khi có trận live.
- Form: `T→W`, `H→D`, `B→L`.
- Team: khoá theo `external_id` (số trong `/doi-bong/{id}/`), **không** theo tên.

### 4.3. Logo / ảnh

Giai đoạn staging: lưu thẳng URL `media.bongda.com.vn/...` vào `logo` (hotlink). Nếu lên
production: tải về 1 lần → upload S3/Cloudinary → lưu URL của mình (tránh hotlink và phụ
thuộc).

### 4.4. Chạy định kỳ

Vercel Hobby giới hạn function 10s → **không** chạy crawler trong API. Dùng
**GitHub Actions schedule** (đã có CI):

```yaml
on:
  schedule:
    - cron: "0 21 * * *"   # 04:00 giờ VN
  workflow_dispatch:
jobs:
  crawl:
    steps:
      - run: npm ci
      - run: npm run crawl -- daily
        env: { MONGODB_URI: ${{ secrets.MONGODB_URI }} }
```

Tuỳ chọn thêm endpoint `POST /api/admin/sync` (admin token) gọi `sync` cho một giải nhỏ
khi cần cập nhật tay.

### 4.5. Chống vỡ khi site đổi HTML

- Lưu fragment mẫu vào `tests/fixtures/bongda/*.html`; unit test parser chạy offline.
- Sau mỗi lần crawl, `sanity check`: số trận/vòng ∈ [1, 20], BXH có ≥ 2 đội, mọi trận có
  đủ 2 team id. Sai → log + không ghi DB + fail workflow để có thông báo.
- Không xoá dữ liệu cũ khi crawl fail; chỉ upsert.

---

## 5. Lộ trình

| Bước | Việc                                                                                                                         | Ước lượng |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1    | Schema: `source`, `external_id`, Fixture `round/status/score/venue`, Rank cột mới; migration nhẹ                             | 0.5 ngày  |
| 2    | `client.ts` + parsers + unit test với fragment đã lưu (PL vòng 5, vòng 6, BXH)                                               | 1 ngày    |
| 3    | `sync.ts` + CLI; chạy PoC với PL (36781) vào DB staging; đối chiếu tay 3 trận + top 5 BXH                                    | 0.5 ngày  |
| 4    | Mở rộng 6 giải; `crawl daily`; GitHub Actions schedule; sanity check                                                         | 0.5 ngày  |
| 5    | Cập nhật API: `GET /fixtures?league=&round=&status=`, `GET /ranks/league/:id` trả cột mới; cập nhật `CHANGES.md` cho team RN | 0.5 ngày  |

Tổng ≈ 3 ngày. Bước 2–3 có thể làm ngay trên fragment đã tải ở phiên khảo sát.

---

## 6. Rủi ro

| Rủi ro                                   | Xử lý                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Site đổi markup / API nội bộ             | Parser test offline + sanity check; adapter `Source` cho phép thay nguồn     |
| Bị chặn IP / rate limit                  | 1 rps, UA rõ ràng, cache; retry backoff; chạy từ GitHub Actions IP khác nhau |
| `roundId` thay đổi giữa mùa              | Luôn đọc lại `<select id="league-round">` mỗi lần crawl, không hardcode      |
| Trận hoãn / đổi giờ                      | Upsert theo `external_id` nên tự cập nhật `start_time`; status `postponed`   |
| Tên đội tiếng Việt cho CLB VN (V-League) | Dùng `external_id` làm khoá; tên chỉ để hiển thị                             |
| Vấn đề bản quyền khi lên production      | Chỉ lấy dữ kiện; thay bằng nguồn có giấy phép qua cùng interface             |

---

## Phụ lục: Tin tức (`npm run crawl -- articles`)

- **Phát hiện bài mới:** `/news-sitemap.xml` (~250 bài, ~2 ngày gần nhất). Sitemap theo ngày
  (`sitemap-article-day-*.xml`) đã ngừng cập nhật từ 2025-10, không dùng.
- **Backfill:** `/<chuyên-mục>?page=N` — 25 bài/trang trong `ul.news-list li.card-horizontal`
  (JSON-LD `ItemList` chỉ có 10 bài, dùng làm dự phòng).
  `npm run crawl -- articles --category tin-chuyen-nhuong --pages 5`
- **Chi tiết:** mỗi bài 1 request, chỉ đọc `<head>`: `og:*`, `article:published_time`,
  `news_keywords`, JSON-LD `NewsArticle` (tác giả) + `BreadcrumbList` (chuyên mục).
- Bài đã có trong DB thì bỏ qua (`--refresh` để lấy lại). `--limit N` giới hạn số bài/lần.
- GitHub Actions: chạy mỗi 6 giờ (`30 */6 * * *`) và sau crawl giải đấu lúc 04:00.
