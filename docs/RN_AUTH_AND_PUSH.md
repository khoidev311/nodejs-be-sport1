# Sport1 — Hướng dẫn implement Auth, Đội yêu thích & Push trên React Native

Dành cho app `~/football-infomation` (Expo SDK 57, expo-router, React Query 5, zustand, token lưu bằng
`expo-sqlite/kv-store`). Phần chung (base URL, envelope `{ data, meta }`, mã lỗi) xem
[API_FOR_REACT_NATIVE.md](API_FOR_REACT_NATIVE.md).

Tên file bên dưới là đường dẫn **trong app RN**. File đã có thì ghi **(sửa)**, file mới thì ghi **(mới)**.

---

## 0. Tổng quan

```
Khách (chưa login)                    Đã login
──────────────────                    ────────
Xem mọi dữ liệu public                Như khách, cộng thêm:
Đội yêu thích lưu local               Đội yêu thích lưu trên server (đồng bộ nhiều máy)
Không nhận push                       Feed "tin đội yêu thích" + push khi có tin mới
```

- **Auth**: JWT. Access token sống **8h**, refresh token sống **7 ngày**. Mỗi lần refresh, server cấp **cặp token mới**.
- **Push**: dùng Expo Push, **không dùng socket**. Server crawl tin **6 giờ một lần**, sau đó gửi cho mỗi thiết bị
  **tối đa 1 thông báo** gộp các tin mới, ví dụ "3 tin mới về Arsenal, Chelsea".
- Server không có session, nên logout chỉ gồm 2 việc: **huỷ push token trên server** rồi **xoá token ở máy**.

### Endpoint dùng trong tài liệu này

| Method | Path                               | Auth | Body                                                      | Trả về                                      |
| ------ | ---------------------------------- | ---- | --------------------------------------------------------- | ------------------------------------------- |
| POST   | `/auth/register`                   | —    | `{ username, password, fullname, email }`                 | 201 `{ access_token, refresh_token }`       |
| POST   | `/auth/login`                      | —    | `{ username, password }`                                  | 200 `{ access_token, refresh_token }`       |
| POST   | `/auth/refresh`                    | —    | `{ refresh_token }`                                       | 200 cặp token **mới**                       |
| GET    | `/auth/me`                         | ✔    | —                                                         | `User` (kèm `role` populated)               |
| GET    | `/me/favorite-teams`               | ✔    | —                                                         | `{ data: Team[] }`                          |
| PUT    | `/me/favorite-teams`               | ✔    | `{ teams: string[] }`, tối đa 20, **ghi đè** cả danh sách | `{ data: Team[] }`                          |
| GET    | `/me/feed?page=&per_page=`         | ✔    | —                                                         | `{ data: Article[], meta }`, mới nhất trước |
| POST   | `/me/push-tokens`                  | ✔    | `{ token, platform?: "ios" \| "android" }`                | 204                                         |
| DELETE | `/me/push-tokens`                  | ✔    | `{ token }`                                               | 204                                         |
| GET    | `/articles?filter[teams]=<teamId>` | —    | —                                                         | Tin của một đội (public)                    |

### Lỗi cần xử lý

| Tình huống                                                           | Mã                                    |
| -------------------------------------------------------------------- | ------------------------------------- |
| Body sai (username 3–50 ký tự `[a-zA-Z0-9_.-]`, password ≥ 6, email) | 400, `message` liệt kê mọi lỗi        |
| Trùng username khi register                                          | **422** `Username already exists`     |
| Sai username/password                                                | **401** `Invalid credentials`         |
| Access token hết hạn                                                 | 401, `request()` tự refresh (mục 1.1) |
| Refresh token hết hạn / user bị xoá                                  | 401 ở `/auth/refresh`, coi như logout |
| `PUT /me/favorite-teams` có id đội không tồn tại                     | 400 `Unknown team id`                 |
| Push token sai định dạng                                             | 400                                   |

Chưa có quên mật khẩu, đổi mật khẩu hay đăng nhập mạng xã hội. Register **không** kiểm tra trùng email.

---

## 1. Auth

### 1.1 `src/lib/api.ts` (sửa): báo cho app khi phiên hết hạn

`request()` đã tự refresh khi gặp 401. Chỉ thiếu một việc: khi refresh thất bại, UI cần biết để chuyển về
trạng thái khách. Thêm một callback để tránh import vòng giữa `api.ts` và store:

```ts
// --- Session expiry ---
let onSessionExpired: (() => void) | null = null;
/** Called once when the refresh token is rejected; the session store resets to guest. */
export const setOnSessionExpired = (fn: () => void) => {
  onSessionExpired = fn;
};

async function refreshAccessToken(): Promise<string | null> {
  // ...giữ nguyên...
  if (!response.ok) {
    authStorage.clear();
    onSessionExpired?.(); // ← thêm dòng này
    return null;
  }
  // ...
}
```

`api.delete` hiện không nhận body. Cách gửi body cho `DELETE /me/push-tokens`:

```ts
api.delete<void>("/me/push-tokens", { body: JSON.stringify({ token }) });
```

### 1.2 `src/store/useSessionStore.ts` (mới)

```ts
import { create } from "zustand";
import type { User } from "@/features/auth";

type SessionStatus = "loading" | "guest" | "authenticated";

interface SessionState {
  status: SessionStatus;
  user: User | null;
  setAuthenticated: (user: User | null) => void;
  setGuest: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: "loading",
  user: null,
  setAuthenticated: (user) => set({ status: "authenticated", user }),
  setGuest: () => set({ status: "guest", user: null }),
}));
```

### 1.3 `src/features/auth/services/index.ts` (sửa)

Sau login hoặc register, lấy `/auth/me` rồi cập nhật session. Logout phải **huỷ push token trước khi xoá
access token**, vì `DELETE /me/push-tokens` cần access token.

```ts
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { authStorage, type AuthTokens } from "@/store/authStorage";
import { useSessionStore } from "@/store/useSessionStore";
import { notificationService } from "@/features/notifications";
import { favoriteSync } from "@/features/favorites";
// ...mapUser giữ nguyên...

async function startSession(tokens: AuthTokens): Promise<User> {
  authStorage.setTokens(tokens);
  const user = mapUser(await api.get<S1User>("/auth/me"));
  useSessionStore.getState().setAuthenticated(user);
  // Không await: chậm hoặc lỗi cũng không được chặn màn login.
  favoriteSync.mergeOnLogin().catch(() => {});
  notificationService.registerIfPermitted().catch(() => {});
  return user;
}

export const authService = {
  login: async (input: LoginInput) =>
    startSession(await api.post<AuthTokens>("/auth/login", input, { auth: false })),

  register: async (input: RegisterInput) =>
    startSession(await api.post<AuthTokens>("/auth/register", input, { auth: false })),

  me: async (): Promise<User> => mapUser(await api.get<S1User>("/auth/me")),

  logout: async () => {
    // Gỡ token trước: máy này không nhận push của tài khoản vừa logout nữa.
    await notificationService.unregister().catch(() => {});
    authStorage.clear();
    useSessionStore.getState().setGuest();
    queryClient.removeQueries({ queryKey: ["me"] }); // xoá feed và favorites của user cũ
  },

  isLoggedIn: () => authStorage.getAccessToken() !== null,
};
```

> Mọi query key riêng của user đều nên bắt đầu bằng `'me'` (ví dụ `['me', 'feed']`, `['me', 'favorite-teams']`).
> Như vậy logout chỉ cần xoá một nhánh key.

### 1.4 Khởi động app: `src/providers/AppProviders.tsx` (sửa)

```ts
import { useEffect } from "react";
import { ApiError, setOnSessionExpired } from "@/lib/api";
import { authService } from "@/features/auth";
import { authStorage } from "@/store/authStorage";
import { useSessionStore } from "@/store/useSessionStore";
import { notificationService } from "@/features/notifications";

function useBootstrapSession() {
  useEffect(() => {
    const session = useSessionStore.getState();
    setOnSessionExpired(() => useSessionStore.getState().setGuest());

    if (!authStorage.getRefreshToken()) return session.setGuest();
    authService
      .me() // access token hết hạn thì request() tự refresh
      .then((user) => {
        session.setAuthenticated(user);
        notificationService.registerIfPermitted().catch(() => {});
      })
      .catch((err) => {
        // 401 nghĩa là refresh cũng hỏng, setOnSessionExpired đã chuyển về guest.
        // Lỗi mạng: giữ token, coi như vẫn login (chưa có thông tin user).
        if (!(err instanceof ApiError && err.status === 401)) session.setAuthenticated(null);
      });
  }, []);
}
```

Gọi `useBootstrapSession()` trong `AppProviders`. Khi `status === 'loading'`, các màn **public** vẫn render
bình thường. Chỉ các phần cần login (feed, nút logout) mới chờ.

### 1.5 Màn login và register: `src/app/login.tsx`, `src/app/register.tsx` (mới)

- Khai báo trong `src/app/_layout.tsx`:
  `<Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />`, register làm tương tự.
- Dùng `useMutation({ mutationFn: authService.login })`. Thành công thì `router.back()`.
- Hiển thị `error.message` từ `ApiError`. Server đã trả message rõ ràng (400, 401, 422).
- Kiểm tra phía client trước khi gửi, theo đúng rule server: username `^[a-zA-Z0-9_.-]{3,50}$`, password 6–128 ký tự, email hợp lệ.
- Chỗ mở màn login: tab **Yêu thích** (banner "Đăng nhập để nhận thông báo tin mới"), trang Giới thiệu hoặc Cài đặt.

---

## 2. Đội yêu thích

Hiện `useAppStore.favoriteTeamIds` chỉ lưu ở máy. Quy tắc mới:

| Trạng thái | Nguồn dữ liệu               | Khi toggle                                                                             |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Khách      | Local (như hiện tại)        | Chỉ cập nhật local                                                                     |
| Đã login   | **Server**, local làm cache | Cập nhật local ngay (optimistic), rồi `PUT` cả danh sách. Lỗi thì trả lại danh sách cũ |
| Vừa login  | Gộp local với server        | `mergeOnLogin()`: hợp hai danh sách, `PUT` nếu khác danh sách server                   |
| Logout     | Giữ local                   | Khách vẫn thấy danh sách của mình                                                      |

### `src/features/favorites/index.ts` (mới)

```ts
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAppStore } from "@/store/useAppStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { S1Team } from "@/types/sport1";

const MAX_FAVORITES = 20;

const putFavorites = (ids: string[]) => api.put<{ data: S1Team[] }>("/me/favorite-teams", { teams: ids });

export const favoriteSync = {
  async mergeOnLogin() {
    const server = (await api.get<{ data: S1Team[] }>("/me/favorite-teams")).data.map((t) => t._id);
    const local = useAppStore.getState().favoriteTeamIds;
    const merged = [...new Set([...server, ...local])].slice(0, MAX_FAVORITES);
    let final = merged;
    if (merged.length !== server.length) {
      try {
        await putFavorites(merged);
      } catch (e) {
        // Id local có thể đã cũ (DB backend được tạo lại): lấy danh sách server.
        if (e instanceof ApiError && e.status === 400) final = server;
        else throw e;
      }
    }
    useAppStore.getState().setFavoriteTeams(final);
    queryClient.invalidateQueries({ queryKey: ["me"] });
  },

  /** Thay cho useAppStore.toggleFavoriteTeam ở mọi nơi trong UI. */
  async toggle(teamId: string) {
    const store = useAppStore.getState();
    const before = store.favoriteTeamIds;
    const after = before.includes(teamId) ? before.filter((id) => id !== teamId) : [...before, teamId];
    if (after.length > MAX_FAVORITES) throw new Error(`Tối đa ${MAX_FAVORITES} đội`);
    store.setFavoriteTeams(after);
    if (useSessionStore.getState().status !== "authenticated") return;
    try {
      await putFavorites(after);
      queryClient.invalidateQueries({ queryKey: ["me", "feed"] });
    } catch (e) {
      store.setFavoriteTeams(before);
      throw e;
    }
  },
};
```

Trong `useAppStore`, thêm `setFavoriteTeams(ids)`: ghi `favoriteTeamIds` vào storage và state, cùng cách
`toggleFavoriteTeam` đang làm.

### Feed tin đội yêu thích: `src/features/news/hooks` (sửa)

```ts
export const useFavoriteFeed = () => {
  const status = useSessionStore((s) => s.status);
  return useInfiniteQuery({
    queryKey: ["me", "feed"],
    queryFn: ({ pageParam }) =>
      api.get<ListResponse<S1Article>>("/me/feed", { query: { page: pageParam, per_page: 20 } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current < last.meta.pages ? last.meta.current + 1 : undefined),
    enabled: status === "authenticated",
  });
};
```

Tab **Yêu thích** (`src/app/(tabs)/favorites.tsx`) gồm danh sách đội ở trên và feed ở dưới. Với khách, thay feed
bằng banner mời đăng nhập. Muốn xem tin của một đội (cả khách) thì dùng `GET /articles?filter[teams]=<teamId>`.

---

## 3. Push notification

### 3.1 Cài đặt (một lần)

```bash
npx expo install expo-notifications
```

`app.json` → `plugins`: thêm `"expo-notifications"`. `extra.eas.projectId` đã có sẵn.

- **Không test được trên Expo Go với Android.** Phải dùng development build: `eas build --profile development`.
- Android: `eas credentials`, chọn Android, rồi Google Service Account Key for **FCM V1**. Cần một Firebase project, gói free là đủ.
- iOS: cần Apple Developer account trả phí, EAS sẽ tự tạo APNs key. Chưa có tài khoản thì làm Android trước.
- Push chỉ chạy trên **máy thật**, không chạy trên simulator hay emulator không có Google Play.

### 3.2 `src/features/notifications/index.ts` (mới)

```ts
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Storage from "expo-sqlite/kv-store";
import { Platform } from "react-native";
import { api } from "@/lib/api";

const TOKEN_KEY = "push.token"; // token đã đăng ký, dùng để gỡ khi logout

// Khi app đang mở vẫn hiện banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoToken(askPermission: boolean): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === "web") return null;
  if (Platform.OS === "android") {
    // Server không gửi channelId, nên Android dùng kênh "default".
    await Notifications.setNotificationChannelAsync("default", {
      name: "Tin tức",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted && askPermission) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function register(askPermission: boolean) {
  const token = await getExpoToken(askPermission);
  if (!token) return false;
  // Gọi lặp lại cũng được: server bỏ qua (không ghi DB) nếu token đã đăng ký trong 24h.
  await api.post<void>("/me/push-tokens", { token, platform: Platform.OS });
  Storage.setItemSync(TOKEN_KEY, token);
  return true;
}

export const notificationService = {
  /** Lúc khởi động hoặc sau login: chỉ đăng ký khi user đã cho phép, không hiện hộp thoại xin quyền. */
  registerIfPermitted: () => register(false),

  /** Gọi từ UI khi user chủ động bật thông báo, ví dụ lần đầu thêm đội yêu thích hoặc bật trong Cài đặt. */
  enable: () => register(true),

  /** Gọi trong logout, trước khi xoá access token. */
  async unregister() {
    const token = Storage.getItemSync(TOKEN_KEY);
    if (!token) return;
    await api.delete<void>("/me/push-tokens", { body: JSON.stringify({ token }) });
    Storage.removeItemSync(TOKEN_KEY);
  },
};
```

**Khi nào xin quyền:** không xin ngay lúc mở app. Nên xin khi user đã login **và** vừa thêm đội yêu thích đầu tiên,
hoặc khi bấm "Bật thông báo". Trên iOS, user bấm từ chối một lần thì chỉ bật lại được trong Settings của máy.

### 3.3 Xử lý khi nhận push và khi bấm vào push

Payload server gửi:

```ts
interface TeamNewsPushData {
  type: "team_news";
  article_id: string; // tin mới nhất trong nhóm
  count: number; // số tin mới trong lần gửi này
}
```

Hook đặt trong `src/app/_layout.tsx`, bên trong `AppProviders`:

```ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function useNotificationRouting() {
  // Bắt được cả trường hợp app đang tắt, user bấm vào push để mở app.
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const data = response?.notification.request.content.data as Partial<TeamNewsPushData> | undefined;
    if (data?.type !== "team_news") return;
    queryClient.invalidateQueries({ queryKey: ["me", "feed"] });
    if (data.count === 1 && data.article_id) router.push(`/news/${data.article_id}`);
    else router.push("/(tabs)/favorites");
  }, [response]);

  // App đang mở mà nhận push: làm mới feed.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() =>
      queryClient.invalidateQueries({ queryKey: ["me", "feed"] }),
    );
    return () => sub.remove();
  }, []);
}
```

### 3.4 Kiểm thử

1. Chạy dev build trên máy thật, login, thêm một đội yêu thích, rồi bấm "Bật thông báo".
2. Lấy token: `Storage.getItemSync('push.token')` (log ra console).
3. Gửi thử bằng công cụ của Expo: <https://expo.dev/notifications>, với data
   `{"type":"team_news","article_id":"<id bài bất kỳ>","count":1}`. Bấm vào push thì phải mở đúng bài.
4. Logout rồi gửi lại: server không còn token này. Nếu dùng công cụ Expo gửi thẳng thì vẫn nhận, vì công cụ đó không đi qua server.
5. Push thật từ server: backend chạy `npm run crawl -- notify --dry-run` để xem sẽ gửi những gì.

---

## 4. Checklist

- [ ] `api.ts`: `setOnSessionExpired`.
- [ ] `useSessionStore` + `useBootstrapSession` trong `AppProviders`.
- [ ] `authService`: `startSession`, `logout` async (gỡ push token trước, rồi xoá query `['me']`).
- [ ] Màn `login` / `register` (modal) + lối vào từ tab Yêu thích.
- [ ] `useAppStore.setFavoriteTeams`; mọi chỗ toggle đổi sang `favoriteSync.toggle`.
- [ ] `useFavoriteFeed` + UI tab Yêu thích (khách thì hiện banner mời login).
- [ ] `expo-notifications` + plugin, dev build, FCM V1 credential.
- [ ] `notificationService` + `useNotificationRouting`.
- [ ] Type `S1Article` thêm `teams: string[]`.

## 5. Giới hạn hiện tại

- Tin đến chậm **tối đa khoảng 6 giờ**, theo lịch crawl.
- Bài được gắn với đội tự động dựa trên tag và tiêu đề, nên có thể sót hoặc nhầm. Bài tổng hợp (ví dụ "Tin đồn chuyển nhượng")
  có thể gắn với nhiều đội. Admin thêm alias bằng `PUT /api/teams/:id` với `{ aliases: [...] }`.
- Server chưa thu hồi được token. Logout chỉ xoá token ở máy và gỡ push token. Token bị lộ vẫn dùng được đến khi hết hạn.
- Mỗi tài khoản tối đa 5 thiết bị nhận push. Một thiết bị chỉ thuộc **một** tài khoản: login tài khoản khác thì token chuyển sang tài khoản mới.

---

## Phụ lục: vận hành phía backend

1. Deploy code.
2. Chạy **một lần**: `npm run crawl -- article-teams`. Lệnh này gắn đội cho toàn bộ bài cũ và đánh dấu tất cả đã gửi, để không spam bài cũ.
   Thêm `--dry-run` để xem thống kê trước.
3. Chạy thử: `npm run crawl -- notify --dry-run`.
4. Bật: GitHub repo, Settings, Variables, đặt `PUSH_ENABLED = 1`. Muốn tắt thì xoá biến hoặc đổi sang giá trị khác.
5. Không bắt buộc: thêm secret `EXPO_ACCESS_TOKEN` nếu bật "enhanced security" cho push trên Expo.
6. Sau khi sửa alias: chạy lại `article-teams`. Lệnh này không gửi push.
