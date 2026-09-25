# Sport1 API — Tích hợp Tin tức (React Native)

Tài liệu riêng cho flow **tin tức** trong app `football-infomation` (Expo, expo-router, React Query 5).
Phần chung (base URL, `request()`, envelope `{ data, meta }`, mã lỗi) xem
[API_FOR_REACT_NATIVE.md](API_FOR_REACT_NATIVE.md) mục 1–2.

---

## 1. Tổng quan

- Nguồn: **bongda.com.vn**. Crawler lấy tin mới **mỗi 6 giờ** (và sau lần crawl giải đấu lúc 04:00).
- **Chỉ có metadata**: tiêu đề, sapo, ảnh đại diện, chuyên mục, tag, tác giả, link gốc.
  **Không có nội dung bài** (bản quyền). Màn chi tiết hiển thị sapo + nút **"Đọc tiếp"** mở `url` gốc
  và **ghi rõ nguồn "bongda.com.vn"**.
- Tất cả endpoint tin tức **public, không cần token**.

```
Danh sách tin ──(tap)──> Chi tiết (ảnh + tiêu đề + sapo + tag) ──("Đọc tiếp")──> Mở url gốc
     │                                    │
     └─ tab chuyên mục                    └─ tap tag ──> danh sách tin theo tag
```

---

## 2. Endpoint

| Method | Path                                                    | Dùng cho                                           |
| ------ | ------------------------------------------------------- | -------------------------------------------------- |
| GET    | `/api/articles?page=1&per_page=20`                      | Tin mới nhất (mặc định `-published_at`)            |
| GET    | `/api/articles?filter[category_slug]=premier-league`    | Tin theo chuyên mục (khớp kiểu "chứa", xem mục 3)  |
| GET    | `/api/articles?filter[tags]=arsenal`                    | Tin có tag chứa chuỗi (không phân biệt hoa thường) |
| GET    | `/api/articles?filter[title]=mainoo`                    | Tìm theo tiêu đề (chứa chuỗi)                      |
| GET    | `/api/articles?from=2026-09-23&to=2026-09-23T23:59:59Z` | Tin trong khoảng `published_at`                    |
| GET    | `/api/articles/:id`                                     | Chi tiết một bài                                   |

Có thể kết hợp nhiều tham số, ví dụ `?filter[category_slug]=man-utd&filter[tags]=mainoo&page=2`.

| Param       | Ghi chú                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `page`      | Từ 1                                                                                                  |
| `per_page`  | 1–100, mặc định 20. Vượt 100 → **400**                                                                |
| `sort`      | Mặc định `-published_at`. Ít khi cần đổi                                                              |
| `from`/`to` | ISO date (`2026-09-23`) hoặc datetime có timezone (`…T23:59:59Z`, `…+07:00`). Sai định dạng → **400** |
| `filter[x]` | Chuỗi → "chứa", không phân biệt hoa thường. Giá trị chỉ gồm chữ số → so **bằng** (số)                 |

Lỗi: `/articles/:id` với id sai định dạng → **400**, không tồn tại → **404**. Body luôn `{ "message": "…" }`.

### Response mẫu — `GET /api/articles?per_page=1`

```json
{
  "data": [
    {
      "_id": "6ab37a31b781b07f6f2eddcf",
      "title": "Owen Hargreaves tiến cử bộ ba tiền vệ tốt nhất cho MU",
      "summary": "Đánh giá cao màn trình diễn của Kobbie Mainoo, cựu danh thủ Owen Hargreaves đã hiến kế cho HLV Carrick về bộ ba tiền vệ hoàn hảo nhất của Man Utd.",
      "thumbnail": "https://media.bongda.com.vn/news/editor/20260923_070330_xh82bmm8.jpg",
      "url": "https://bongda.com.vn/owen-hargreaves-tien-cu-bo-ba-tien-ve-tot-nhat-cho-mu-d848438.html",
      "published_at": "2026-09-23T06:49:00.000Z",
      "category": "Premier League",
      "category_slug": "premier-league",
      "tags": ["owen hargreaves", "kobbie mainoo", "manchester united", "ngoại hạng anh", "bóng đá anh"],
      "author": "Huỳnh Trung Phong",
      "source": "bongda",
      "external_id": "848438",
      "created_at": "2026-09-23T07:05:21.366Z",
      "updated_at": "2026-09-23T07:05:21.366Z"
    }
  ],
  "meta": { "total": 280, "current": 1, "per_page": 1, "pages": 280 }
}
```

`GET /api/articles/:id` trả thẳng object như một phần tử trong `data`.

---

## 3. Chuyên mục

Chưa có endpoint liệt kê chuyên mục — app **hardcode** danh sách tab. Các slug đang có dữ liệu
(xếp theo số bài, lấy từ DB ngày 2026-09-23, tổng 280 bài):

| Tab gợi ý      | `category_slug`      | `category`        |
| -------------- | -------------------- | ----------------- |
| Chuyển nhượng  | `tin-chuyen-nhuong`  | Tin Chuyển Nhượng |
| Việt Nam       | `viet-nam`           | Bóng đá Việt Nam  |
| V-League       | `v-league`           | V-League          |
| ĐTQG           | `doi-tuyen-quoc-gia` | Các ĐTQG          |
| Ngoại Hạng Anh | `premier-league`     | Premier League    |
| Bóng đá Anh    | `bong-da-anh`        | Bóng Đá Anh       |
| La Liga        | `la-liga`            | La Liga           |
| Serie A        | `serie-a`            | Serie A           |
| Châu Á         | `bong-da-chau-a`     | Bóng Đá Châu Á    |
| Hậu trường     | `hau-truong-san-co`  | Hậu trường        |

Ngoài ra có các chuyên mục theo CLB: `man-utd`, `real-madrid`, `arsenal`, `barcelona`, `tottenham`,
`chelsea`, `man-city`, `liverpool`, `paris-saint-germain`… và `soi-tran`, `bong-da-tbn`, `bong-da-phap`.

> ⚠️ Slug chuyên mục tin **khác** slug giải đấu: giải Ngoại Hạng Anh có `league.slug = "ngoai-hang-anh"`
> nhưng tin tương ứng có `category_slug = "premier-league"`. Nếu cần "tin của giải" trong màn giải đấu,
> map thủ công:
>
> ```ts
> export const LEAGUE_NEWS_CATEGORY: Record<string, string> = {
>   "ngoai-hang-anh": "premier-league",
>   laliga: "la-liga",
>   "serie-a": "serie-a",
>   "v-league": "v-league",
> };
> ```

> ⚠️ Filter là "chứa", không phải khớp chính xác: `filter[category_slug]=bong-da-chau-a` cũng trả về
> bài `bong-da-chau-au`. Với các slug trong bảng trên thì chỉ có cặp này bị trùng.

Chuyên mục chỉ phân loại chính; một bài MU có thể nằm ở `tin-chuyen-nhuong`. Muốn "tất cả tin về MU"
thì lọc theo tag: `filter[tags]=manchester united`.

---

## 4. Type — thêm vào `src/api/types.ts`

```ts
export interface Article {
  _id: string;
  title: string;
  summary: string; // sapo, có thể "" (hiếm)
  thumbnail: string; // URL tuyệt đối, có thể "" → dùng ảnh placeholder
  url: string; // bài gốc — mở để đọc toàn văn
  published_at: string; // ISO UTC
  category?: string; // "Premier League"
  category_slug?: string; // "premier-league"
  tags: string[]; // chữ thường, có dấu
  author?: string;
  source: "bongda" | "manual";
  created_at: string;
  updated_at: string;
}
```

---

## 5. Service — `src/api/services/newsApi.ts`

```ts
import { request } from "../client";
import type { Article, ListResponse } from "../types";

export interface NewsQuery {
  category?: string; // category_slug
  tag?: string;
  search?: string; // tìm trong tiêu đề
  from?: string;
  to?: string;
}

const PER_PAGE = 20;

export const newsApi = {
  list: (q: NewsQuery = {}, page = 1) => {
    const filter: Record<string, string> = {};
    if (q.category) filter.category_slug = q.category;
    if (q.tag) filter.tags = q.tag;
    if (q.search?.trim()) filter.title = q.search.trim();
    return request<ListResponse<Article>>("/articles", {
      auth: false,
      query: {
        page,
        per_page: PER_PAGE,
        from: q.from,
        to: q.to,
        ...(Object.keys(filter).length && { filter }),
      },
    });
  },

  detail: (id: string) => request<Article>(`/articles/${id}`, { auth: false }),
};
```

---

## 6. React Query hooks — `src/hooks/useNews.ts`

```ts
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { newsApi, type NewsQuery } from "../api/services/newsApi";
import type { Article } from "../api/types";

const STALE = 10 * 60_000; // tin mới vào mỗi 6h, 10 phút là đủ tươi

export const useNewsList = (q: NewsQuery = {}) =>
  useInfiniteQuery({
    queryKey: ["news", q],
    queryFn: ({ pageParam }) => newsApi.list(q, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current < last.meta.pages ? last.meta.current + 1 : undefined),
    staleTime: STALE,
  });

// Lấy sẵn từ cache danh sách để màn chi tiết hiện ngay, không cần chờ mạng.
export const useArticle = (id: string) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["article", id],
    queryFn: () => newsApi.detail(id),
    staleTime: STALE,
    initialData: () => {
      for (const [, data] of qc.getQueriesData<{ pages: { data: Article[] }[] }>({ queryKey: ["news"] })) {
        const hit = data?.pages.flatMap((p) => p.data).find((a) => a._id === id);
        if (hit) return hit;
      }
      return undefined;
    },
  });
};
```

---

## 7. Màn hình

### 7.1 Danh sách — `app/news/index.tsx`

```tsx
import { FlatList, RefreshControl } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useNewsList } from "../../src/hooks/useNews";

export default function NewsScreen() {
  const [category, setCategory] = useState<string | undefined>();
  const q = useNewsList({ category });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a._id}
      ListHeaderComponent={<CategoryTabs value={category} onChange={setCategory} />}
      renderItem={({ item }) => (
        <ArticleCard article={item} onPress={() => router.push(`/news/${item._id}`)} />
      )}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}
    />
  );
}
```

`ArticleCard`: ảnh `thumbnail` (tỉ lệ 16:9), `title` (tối đa 2–3 dòng), `category` + thời gian tương đối
từ `published_at` ("2 giờ trước").

### 7.2 Chi tiết — `app/news/[id].tsx`

```tsx
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, router } from "expo-router";
import { useArticle } from "../../src/hooks/useNews";

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: a, isLoading, error } = useArticle(id);
  if (isLoading) return <Loading />;
  if (error || !a) return <ErrorView message={(error as Error)?.message ?? "Không tìm thấy bài viết"} />;

  return (
    <ScrollView>
      <Image source={a.thumbnail ? { uri: a.thumbnail } : PLACEHOLDER} style={{ aspectRatio: 16 / 9 }} />
      <Text>{a.category}</Text>
      <Text>{a.title}</Text>
      <Text>{[a.author, formatDateTime(a.published_at)].filter(Boolean).join(" · ")}</Text>
      <Text>{a.summary}</Text>
      <Button title="Đọc tiếp trên bongda.com.vn" onPress={() => WebBrowser.openBrowserAsync(a.url)} />
      <Text>Nguồn: bongda.com.vn</Text>
      <TagList tags={a.tags} onPress={(tag) => router.push({ pathname: "/news/tag", params: { tag } })} />
    </ScrollView>
  );
}
```

- **"Đọc tiếp"**: dùng `expo-web-browser` (in-app browser) — đơn giản, không cần xử lý cookie/quảng cáo
  như `react-native-webview`. Không nhúng nội dung bài vào app.
- **Chia sẻ**: `Share.share({ message: a.url })` — chia sẻ link gốc.
- Màn `app/news/tag.tsx` dùng lại danh sách ở 7.1 với `useNewsList({ tag })`.

---

## 8. Lưu ý

1. **Thời gian**: `published_at` là UTC → `new Date(published_at)` rồi format theo local. Không tự cộng 7h.
2. **`created_at` không phải giờ đăng**: sắp xếp/hiển thị theo `published_at`, không dùng `created_at` (giờ crawl).
3. **Bài có thể bị xoá** (admin `DELETE /api/articles/:id`) → màn chi tiết xử lý 404.
4. **Thứ tự ổn định khi phân trang**: tin mới chèn vào đầu, nên trang 2 có thể lặp 1–2 bài của trang 1
   nếu người dùng cuộn lâu. Lọc trùng theo `_id` khi `flatMap`:
   ```ts
   const items = [...new Map(q.data?.pages.flatMap((p) => p.data).map((a) => [a._id, a])).values()];
   ```
5. **Tìm kiếm**: debounce 300ms trước khi đổi `search`; chuỗi rỗng → bỏ filter.
6. **Tag** được lưu chữ thường, có dấu (`"bóng đá anh"`). Filter tag là "chứa", nên `filter[tags]=arsenal`
   khớp cả `"arsenal"` lẫn `"arsenal fc"`.

---

## 9. Checklist

- [ ] Thêm `Article` vào `types.ts`, tạo `newsApi.ts`, `useNews.ts`.
- [ ] Màn danh sách: tab chuyên mục (mục 3), infinite scroll, pull-to-refresh, lọc trùng `_id`.
- [ ] Màn chi tiết: ảnh, tiêu đề, sapo, tác giả/giờ, tag, nút "Đọc tiếp" (`expo-web-browser`), dòng "Nguồn".
- [ ] Màn tin theo tag.
- [ ] Placeholder khi `thumbnail` rỗng; xử lý 404.
- [ ] (Tuỳ chọn) Tab "Tin tức" trong màn giải đấu qua `LEAGUE_NEWS_CATEGORY`.
