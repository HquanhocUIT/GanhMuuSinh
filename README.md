# Chạm Vị · Street-Food Quest

**Đi một vòng, thương một chút.**

MVP WebGIS kết nối hành trình ẩm thực, giao tiếp tại gánh hàng và hộ chiếu trải nghiệm. Frontend/backend tách riêng. Không yêu cầu người bán cài app hay tạo tài khoản.

## Chạy dự án

Yêu cầu **Node.js 24+**, npm và trình duyệt hiện đại.

```powershell
cd D:\CODING\ganhmuusinh
npm install
npm run dev
```

- Website: **http://127.0.0.1:5173**
- API: **http://127.0.0.1:4000/api/health**
- Vite chuyển tiếp `/api` tới backend; không cần cấu hình CORS khi phát triển.
- SQLite tự tạo tại `be/data/ganhmuusinh.sqlite`. Không cần cài database server. Node có thể in cảnh báo API SQLite còn experimental.

## Deploy Vercel + Render

Repo có cấu hình Vercel cho Vite SPA và proxy `/api/*` sang backend.

**Vercel (Frontend):** vì repo là monorepo, ở màn import hãy chọn **Import single project** tại mục `fe/`. Root Directory khi đó là `fe`; `fe/vercel.json` đặt build output là `dist` và proxy `/api/*` sang backend. Thêm biến `BACKEND_URL` bằng URL Render, không kèm `/api`.

**Render (Backend API):** tạo **Web Service** từ cùng repo, đặt Root Directory là `be`, Build Command là `npm install` và Start Command là `npm start`. Backend Node.js không có bước biên dịch riêng. Đặt health check path `/api/health` và các biến `HOST=0.0.0.0`, `NODE_ENV=production`, `AI_PROVIDER=disabled` nếu chưa có AI cloud. Render cung cấp `PORT`.

Sau khi có URL backend Render, đặt biến môi trường `BACKEND_URL` trong Vercel thành URL đó (ví dụ `https://ten-dich-vu.onrender.com`, không thêm `/api`). Sau khi Vercel cấp domain, đặt `ALLOWED_ORIGINS` trong Render thành origin Vercel chính xác (ví dụ `https://ten-du-an.vercel.app`, không có dấu `/` cuối), rồi deploy lại hai dịch vụ. Không đặt secret trong `VITE_*` hoặc commit vào GitHub.

**Giới hạn khi dùng gói miễn phí:** Render có thể sleep backend sau 15 phút không có request và mất khoảng một phút để thức dậy. Filesystem của web service miễn phí là ephemeral, nên SQLite, tài khoản và dấu hộ chiếu có thể mất khi service sleep/restart/redeploy. Dùng persistent disk của gói phù hợp và đặt `DATABASE_PATH` vào mount path, hoặc chuyển database sang dịch vụ database bền vững trước khi dùng dữ liệu thật.

Tài khoản admin không được tạo sẵn trên dịch vụ mới. `npm run admin:create -- email` chỉ tạo tài khoản vào database tại `DATABASE_PATH` đang cấu hình trong môi trường lệnh; hãy chạy từ terminal tin cậy trỏ tới đúng database bền vững. Không bật đăng ký công khai role admin.

MVP này dùng SQLite, chưa có adapter PostgreSQL. Qwen/Ollama mặc định kết nối `127.0.0.1`, vì vậy Ollama đang chạy trên máy cá nhân **không thể** được backend Render gọi qua localhost. Đặt `AI_PROVIDER=disabled` để các luồng không AI và scan demo hoạt động trên Render; scan AI/dịch AI chỉ hoạt động khi backend được cấu hình tới một AI endpoint truy cập được từ cloud. Không cần để máy cá nhân chạy 24/24 khi backend đã deploy lên Render.

Chạy bản build trên một cổng:

```powershell
npm run build
npm start
```

Mở **http://127.0.0.1:4000**. Backend phục vụ cả API và `fe/dist`.

## Hai không gian: user và admin

| Không gian | Địa chỉ khi chạy dev                | Chức năng                                                                                                              |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| User       | `http://127.0.0.1:5173/#discover`   | Khám phá, bản đồ, gọi món, scanner và hộ chiếu; không bắt buộc đăng nhập                                               |
| Tài khoản  | `http://127.0.0.1:5173/#account`    | Đăng ký/đăng nhập, giữ hộ chiếu theo tài khoản, xem phản hồi đóng góp                                                  |
| Đóng góp   | `http://127.0.0.1:5173/#contribute` | User đã đăng nhập gửi thông tin gánh hàng để admin xem xét                                                             |
| Admin      | `http://127.0.0.1:5173/#admin`      | Dashboard, biên tập gánh hàng/câu chuyện, hành trình, duyệt đóng góp, nguồn tham khảo, danh sách thành viên và nhật ký |

**Tạo tài khoản quản trị đầu tiên** bằng terminal trong thư mục dự án:

```powershell
npm run admin:create -- admin@cuaban.com
```

Công cụ tạo mật khẩu ngẫu nhiên và chỉ in một lần trong terminal. Dùng email/mật khẩu đó tại `/#admin`. Không có tài khoản hoặc mật khẩu admin mặc định; tài khoản kiểm thử chỉ tồn tại trong database E2E riêng. Không cần cấu hình thêm biến môi trường cho auth.

- Tự đăng ký luôn có role `user`; không thể gửi `role: admin` để tự nâng quyền. Từng API `/api/admin/*` kiểm tra role tại backend.
- Mật khẩu dùng scrypt với salt riêng. Phiên đăng nhập là token ngẫu nhiên, chỉ lưu hash trong SQLite; cookie HttpOnly/SameSite, hết hạn 8 giờ cho admin hoặc 7 ngày cho user. Logout thu hồi phiên.
- Hộ chiếu khách được gộp vào tài khoản khi đăng nhập/đăng ký. Đăng xuất không để khách tiếp theo đọc được hộ chiếu tài khoản. Tài khoản trên các thiết bị cùng đọc hộ chiếu từ backend; hành trình đã lưu bằng trái tim vẫn là dữ liệu riêng của từng trình duyệt.
- Gánh hàng và hành trình được lưu trong SQLite, không còn sửa mảng JavaScript để vận hành nội dung. Seed ban đầu không ghi đè nội dung đã biên tập khi khởi động lại.
- Trạng thái `draft`, `published`, `archived`. User chỉ nhận nội dung đang hiển thị. Lưu trữ gánh hàng cũng ẩn những hành trình phụ thuộc gánh đó; dấu hộ chiếu cũ vẫn được giữ.
- Duyệt đóng góp tạo **bản nháp**, không tự công khai. Admin bổ sung thông tin và chọn hiển thị sau. User xem được trạng thái và phản hồi trong trang tài khoản.
- Mỗi lần biên tập kiểm tra số phiên bản để tránh ghi đè thay đổi của phiên khác, đồng thời ghi nhật ký thao tác.

## Dữ liệu tham khảo từ ganhmuusinh.vn

Đã đọc trang và danh mục công khai [ganhmuusinh.vn](https://ganhmuusinh.vn/) ngày **29/10/2026**. Trong admin → **Nguồn tham khảo** có 3 mẫu từ website và **127 ghim món ăn** lọc từ [danh sách Google Maps Gánh Mưu Sinh](https://www.google.com/maps/@10.7524014,106.6815481,13.33z/data=!4m3!11m2!2syL7kE4gcCEMBEYgR2UjssA!3e3): 116 TP.HCM, 4 Bình Dương, 7 Vũng Tàu. Nút nhập theo nhóm chỉ tạo bản nháp có nguồn. Địa chỉ, giá, giờ, nguyên liệu và dị ứng cần được kiểm tra; các trường chưa có được để trống.

Không sao chép toàn bộ danh mục, ảnh, câu chuyện đời, thông tin tài khoản hay số điện thoại. Không khẳng định đã khảo sát thực địa. Xem [mapping và phạm vi dữ liệu](docs/REFERENCE_DATA.md).

Trang bản đồ có thêm lớp ghim cam từ các nguồn công khai để người dùng khám phá; đây là ảnh chụp dữ liệu, không cập nhật real-time và không xác nhận gánh còn hoạt động. Ghim cam không thể lưu dấu hay đưa vào hành trình cho tới khi admin xác minh và xuất bản. Lớp nền OpenStreetMap có ghi công contributors và giấy phép ODbL.

Planner có thêm tìm theo phường: 130 ghim tham khảo được gắn vào 52 phường bằng tọa độ và ranh giới hành chính trong `be/src/data/wards-hcm.geojson`. Khi có nhiều điểm, hệ thống chia thành các tuyến 2–3 điểm riêng nhau để giảm lặp; dữ liệu ghim vẫn chưa xác minh giờ bán, giá hoặc tình trạng hoạt động. Danh sách phường hiện hành và ranh giới được lấy từ [tinhthanhpho.com](https://www.tinhthanhpho.com/api-docs), giấy phép CC BY 4.0; chi tiết nguồn nằm trong `docs/REFERENCE_DATA.md`.

Để bắt đầu một tuyến theo phường, nhập tên phường rồi bấm **Gợi ý cho mình**. Trên thẻ tuyến, bấm **Xem trước hành trình**, xem các điểm dừng rồi bấm **Bắt đầu hành trình này**. Trang tuyến có tiến độ `x/n` như hành trình mẫu, bản đồ đánh số điểm, **Voice Bridge** chọn đúng ghim để ghép lời gọi món và **Lưu dấu** mở Food X-Ray cho điểm đó. Sau khi quét có thể về tuyến hoặc mở **Hộ chiếu ẩm thực**; dấu vẫn còn sau khi tải lại trang hoặc đăng nhập cùng tài khoản. **Chỉ đường đến điểm đầu** và **Chỉ đường** tại từng điểm mở Google Maps. Nếu ghim có câu chuyện đã được công bố thì hiện **Câu chuyện**; ghim tham khảo còn thiếu chỉ có **Thông tin ghim** dẫn tới nguồn, không tự tạo câu chuyện, giá, giờ bán, nguyên liệu hay dữ liệu dị ứng. Dấu AI chỉ được cấp khi ảnh khớp một nhóm món hệ thống hỗ trợ; chế độ minh họa không phân tích ảnh. Liên kết `#ward-journey?ward=...&route=...` có thể tải lại hoặc chia sẻ. Nét đứt trên bản đồ chỉ nối tọa độ, không phải đường đi thực tế. Việc mua hàng và vị trí thực tế chưa được xác minh.

## Những luồng đã triển khai

| Luồng              | Hành vi                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khám phá           | 5 hành trình minh họa, gợi ý tuyến theo phường từ ghim tham khảo, 12 gánh hàng ở 3 vùng; tìm theo món, lọc khu vực, giờ, ngân sách và nguyên liệu cần tránh |
| Smart planner      | Chọn tối đa 4 điểm; ưu tiên số điểm nhiều nhất trong ngân sách, sau đó chọn thứ tự ngắn nhất, kiểm tra giờ đến và 20 phút ăn tại mỗi điểm                   |
| Bản đồ             | Leaflet + OpenStreetMap, ghim tương tác, danh sách điểm dừng và đường nối ước tính                                                                          |
| Hành trình         | Xem điểm dừng, ngân sách, giờ dự kiến, tiến độ theo dấu trải nghiệm; giữ hành trình qua lần tải lại                                                         |
| Đã lưu             | Lưu/bỏ lưu hành trình vào localStorage                                                                                                                      |
| Voice Bridge       | Ghép câu gọi món từ số phần và yêu cầu; đọc tiếng Việt bằng Web Speech; chế độ chữ lớn                                                                      |
| Phản hồi người bán | Nhận diện tiếng Việt bằng Web Speech Recognition khi trình duyệt hỗ trợ; nhập tay thay thế; dịch qua bộ câu mẫu hoặc AI đang cấu hình                       |
| Food X-Ray         | Chụp/chọn JPEG, PNG, WebP ≤5 MB; xem trước; gửi AI sau khi đồng ý; demo riêng không phân tích ảnh                                                           |
| Food Passport      | Dấu demo và dấu nhận diện AI tách biệt, lưu SQLite theo cookie HttpOnly; cùng món/cùng chế độ không tạo dấu trùng                                           |
| Human stories      | Đọc và nghe câu chuyện minh họa; xem nguyên liệu tham khảo và cách thưởng thức                                                                              |
| Giao diện          | Responsive, điều hướng bàn phím, dialog giữ focus, reduced motion, thông báo lỗi/tải/rỗng, nút VI/EN cho giao diện chính                                    |

## AI local với Ollama (mặc định)

Backend mặc định gọi Ollama chạy trên máy local, không cần Gemini API key. Cài Ollama, tải model Qwen3-VL và chạy Ollama trước khi quét món hoặc dịch câu tự do:

```powershell
Copy-Item be/.env.example be/.env
ollama pull qwen3-vl:8b-instruct-q8_0
```

Mặc định backend kết nối Ollama của dự án tại `http://127.0.0.1:11435` với model **`qwen3-vl:8b-instruct-q8_0`** (khoảng 9,9 GB). `npm run dev` tự mở phiên này với cache prompt RAM giới hạn 512 MiB; khi chạy bản build, mở `npm run ai:serve` rồi `npm start`. Phiên Ollama dùng chung các model đã tải. Đây là tag Instruct cụ thể; tag ngắn `qwen3-vl:8b` trên máy hiện trỏ tới bản Thinking Q4. Có thể đổi bằng `OLLAMA_BASE_URL` và `OLLAMA_MODEL` trong `be/.env`. Ảnh chỉ được gửi từ backend tới Ollama tại địa chỉ đã cấu hình; ứng dụng không lưu ảnh gốc.

Khởi động lại backend sau khi thay `.env`. Nếu muốn dùng Gemini thay cho model local, đặt `AI_PROVIDER=gemini`, thêm `GEMINI_API_KEY` và tùy chọn `GEMINI_MODEL`. Không đặt khóa trong frontend hay biến `VITE_*`.

- Ảnh được kiểm tra kích thước, xoay theo EXIF và giới hạn cạnh dài 2048 px; ảnh đã phù hợp được giữ nguyên byte để tránh nén lại không cần thiết. Ảnh dưới 224 px ở một chiều được yêu cầu chụp lại.
- Khi đã xây index ảnh mẫu, SigLIP2 tìm nhóm ảnh gần nhất rồi Qwen đối chiếu ảnh đang quét với các ví dụ đã gán nhãn. Ảnh quá khác mẫu hoặc hai bộ nhận diện bất đồng sẽ được từ chối. Các trường hợp chưa đủ điểm dùng lượt quan sát hình dạng, phân loại và đối chiếu Qwen; backend tiếp tục kiểm tra dấu hiệu bắt buộc và tính thống nhất với ảnh mẫu.
- Nhận theo nhóm món: cà phê đen/sữa, bánh bông lan thường/trứng muối và phá lấu nước/xào. Ảnh không được dùng để khẳng định biến thể hoặc nguyên liệu bị che.
- Khi so sánh tên món chưa thống nhất nhưng ảnh mẫu đủ gần, một lượt Qwen riêng chỉ đọc hình dạng trên ảnh truy vấn, không thấy tên món hoặc ví dụ. Backend đối chiếu các đặc điểm này với nhóm mẫu; chỉ nhóm có bằng chứng phù hợp duy nhất mới được nhận.
- Điểm model tự chấm **không phải xác suất đúng đã được hiệu chuẩn**. Hệ thống từ chối nếu thiếu bằng chứng, gặp món ngoài danh mục hoặc các lượt đối chiếu không thống nhất; không tăng điểm để ép nhận diện thành công.
- Gom các gánh bán cùng loại món để nhận diện món trước. Điểm dừng người dùng chọn chỉ được đối chiếu sau khi nhận diện, không đưa tên gánh hoặc điểm dừng vào prompt.
- Dịch câu tự do dùng cùng adapter; câu cố định trong phrasebook hoạt động không cần kết nối AI.
- Nếu Ollama không chạy hoặc chưa tải model, quét AI báo lỗi để người dùng thử lại; ứng dụng không tự chuyển một lần quét AI lỗi thành demo.
- Ảnh được xử lý trong bộ nhớ, không ghi vào SQLite hay ổ đĩa. Nhận diện micro do trình duyệt xử lý, có thể sử dụng dịch vụ bên ngoài của trình duyệt.
- Có timeout, kiểm tra loại/kích thước/chữ ký file, thông báo lỗi an toàn và giới hạn 30 yêu cầu AI/giờ cho mỗi phiên ẩn danh. Đây là giới hạn cho MVP cục bộ, chưa đủ chống lạm dụng khi triển khai công khai.

Tài liệu tích hợp: [Ollama chat API](https://docs.ollama.com/api/chat), [Qwen3-VL](https://ollama.com/library/qwen3-vl).

Đặc trưng hình ảnh hiện được biên soạn cho 12 món seed. Món mới cần thêm mô tả phân biệt trong `be/src/data/dish-vision.js`; ảnh không đủ để xác nhận một số cách chế biến hoặc nguyên liệu bị che khuất. Kết quả đo và cách chạy lại bộ ảnh: [VISION_ACCURACY.md](docs/VISION_ACCURACY.md).

Bộ so sánh ảnh local được cài bằng `powershell -NoProfile -ExecutionPolicy Bypass -File be/vision/setup.ps1`. Hướng dẫn, cách thêm ảnh và tách tập kiểm tra: [VISION_REFERENCE_SETUP.md](docs/VISION_REFERENCE_SETUP.md). Báo cáo toàn bộ ảnh trong dataset: [DATASET_RESULTS.md](docs/vision/DATASET_RESULTS.md), kèm trang xem từng ảnh và CSV. Index được tạo từ ảnh tham chiếu/phát triển; ảnh test được giữ ngoài index, mỗi ảnh truy vấn trong lượt đánh giá được loại cả nhóm khỏi ảnh mẫu.

## Phạm vi minh bạch

Đây là bản MVP của concept, **chưa phải dữ liệu du lịch đã xác minh hoặc hệ thống chống gian lận hoàn chỉnh**.

- 12 gánh seed ban đầu cùng câu chuyện, giá, nguyên liệu, giờ bán và vị trí là minh họa. Bản nháp tham khảo và đóng góp cộng đồng có provenance riêng; chỉ hiển thị khi admin công khai. Ảnh mặc định không đại diện cho người bán thực tế. Tên khu vực phục vụ ý tưởng, không dùng làm danh mục hành chính hiện hành.
- Planner dùng khoảng cách Haversine nhân hệ số 1.3 và vận tốc đi bộ 4 km/h. Chưa có đường đi theo mạng lưới đường, đường cấm, giao thông hay vị trí xuất phát GPS. Nét đứt trên bản đồ là đường nối minh họa.
- Nhận diện món trong ảnh **không chứng minh mua hàng, vị trí, thời điểm hoặc danh tính người bán**. Cả dấu demo lẫn dấu AI đều có `purchaseVerified: false`; không quảng bá là Proof of Taste đã xác thực.
- Nguyên liệu/cảnh báo lấy từ dữ liệu danh mục; không suy ra đầy đủ chất gây dị ứng từ ảnh, không xác nhận nguy cơ nhiễm chéo. Gánh chưa có thông tin nguyên liệu được loại khỏi planner khi bật bộ lọc dị ứng. Người dùng cần hỏi người bán.
- Giọng đọc phụ thuộc hệ điều hành; chưa có TTS giọng miền Nam chuyên dụng. Nhận diện micro phụ thuộc trình duyệt, HTTPS hoặc localhost và quyền người dùng. Luôn có nhập tay/chữ lớn thay thế.
- Nhãn giao diện chính có VI/EN; tên hành trình, câu chuyện và một số nội dung bản địa giữ tiếng Việt. Chưa phải bản dịch toàn bộ sản phẩm.
- Khách vẫn dùng hộ chiếu ẩn danh; mất cookie khách tương đương bắt đầu hộ chiếu mới. Đăng nhập cho phép đọc hộ chiếu theo tài khoản trên thiết bị khác.
- Có CMS và phân quyền cơ bản. Chưa có email verification, khôi phục mật khẩu, MFA, quy trình thu thập đồng thuận thực tế của người bán, định tuyến đường phố, xác minh giao dịch hay hạ tầng production.

## Cấu trúc

```text
ganhmuusinh/
├── fe/                         # React 19 + TypeScript + Vite
│   ├── public/images/          # Ảnh minh họa cục bộ
│   └── src/
│       ├── components/         # Modal, map, dấu hộ chiếu, nhận diện thương hiệu
│       ├── admin/              # Dashboard, form biên tập, nguồn và duyệt đóng góp
│       ├── lib/                # API client, lưu trữ, trình bao Web Speech
│       ├── pages/              # Discovery, Journey, Tools, Passport, Stories
│       ├── App.tsx             # Điều hướng hash, phiên UI và dialog
│       ├── Root.tsx            # Tách không gian user/admin
│       ├── auth.tsx            # Trạng thái tài khoản dùng chung
│       ├── styles.css          # Layout, component và responsive
│       └── readability.css     # Cỡ chữ đọc và vùng chạm
├── be/                         # Node.js + Express + Zod + SQLite
│   ├── src/data/catalog.js     # Seed minh họa
│   ├── src/services/planner.js # Thuật toán xếp điểm dừng
│   ├── src/services/ai.js      # Adapter Ollama/Gemini, không lộ khóa cho FE
│   ├── src/services/auth.js    # Tài khoản, scrypt, phiên và gộp hộ chiếu
│   ├── src/services/content.js # Lưu nội dung, seed và validation xuất bản
│   ├── src/routes/admin.js    # CRUD, duyệt, nguồn tham khảo và audit
│   ├── scripts/create-admin.js # Tạo admin bằng terminal, không qua web đăng ký
│   ├── src/db.js               # Schema và migration SQLite
│   ├── src/app.js              # Routes, validation, session, lỗi
│   ├── src/server.js           # Bootstrap, env và static production
│   └── test/                   # Kiểm thử business/API
├── e2e/                        # Playwright desktop/mobile
├── design-system/MASTER.md     # Quyết định UI/UX theo skill
└── docs/                       # Nguồn ảnh, kết quả test và screenshots
```

## API

| Method | Endpoint              | Mục đích                                                                                  |
| ------ | --------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/health`         | Trạng thái backend, AI và chế độ dữ liệu                                                  |
| GET    | `/api/catalog`        | Vùng, dị ứng, gánh hàng, hành trình                                                       |
| POST   | `/api/planner/ward`   | Gợi ý các tuyến riêng theo phường từ ghim tham khảo                                       |
| GET    | `/api/quests/:id`     | Chi tiết hành trình có sẵn                                                                |
| POST   | `/api/planner`        | `{ region, time, budget, excludeAllergens, maxStops }`                                    |
| POST   | `/api/orders/compose` | `{ vendorId, quantity, options }` → câu Việt/Anh                                          |
| POST   | `/api/translate`      | `{ text }` → bản dịch + nguồn `phrasebook`/`ai`                                           |
| GET    | `/api/passport`       | Hộ chiếu phiên hiện tại; tự cấp cookie nếu chưa có                                        |
| POST   | `/api/scans`          | `{ mode: "demo", vendorId }` hoặc `{ mode: "ai", vendorId, image: { mimeType, base64 } }` |

`region`: `saigon`, `binhduong`, `vungtau`. `time`: `morning`, `afternoon`, `night`. Đơn vị ngân sách: VND, kiểu số. Tất cả POST dùng `Content-Type: application/json`.

API tài khoản/nội dung:

| Method    | Endpoint                                                    | Quyền                                 |
| --------- | ----------------------------------------------------------- | ------------------------------------- |
| GET       | `/api/auth/me`                                              | Trạng thái tài khoản hiện tại         |
| POST      | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Cookie phiên do backend cấp           |
| GET, POST | `/api/submissions`                                          | User: chỉ đọc đóng góp của chính mình |
| GET       | `/api/admin/overview`, `/api/admin/users`                   | Admin                                 |
| GET, POST | `/api/admin/vendors`, `/api/admin/quests`                   | Admin: danh sách / tạo mới            |
| PUT       | `/api/admin/vendors/:id`, `/api/admin/quests/:id`           | Admin; cần `expectedRevision`         |
| GET       | `/api/admin/references`, `/api/admin/submissions`           | Admin                                 |
| POST      | `/api/admin/references/:id/import`                          | Admin; nhập nháp, chống trùng         |
| POST      | `/api/admin/submissions/:id/review`                         | Admin; `{ decision: "approved"        | "rejected", note }` |

Mọi request ghi dữ liệu dùng JSON và kiểm tra Origin. Thao tác lưu trữ thực hiện bằng PUT với `status: "archived"`, không xóa cứng lịch sử hộ chiếu. Các danh sách quản trị thành viên/đóng góp/nhật ký có giới hạn bản ghi; phân trang đầy đủ là bước tiếp theo khi dữ liệu tăng.

## Kiểm thử

```powershell
npm run check       # TypeScript + build + backend tests
npm run test:e2e    # Chạy sau build; hiện dùng Chrome đã cài trên máy
```

Playwright tự chạy API trên cổng 4173 với SQLite trong bộ nhớ và AI tắt; không đụng hộ chiếu phát triển. Nếu chưa có Chrome, có thể cài trình duyệt Playwright rồi bỏ `channel: 'chrome'` trong cấu hình. Không cần khóa AI để chạy test.

Xem [kết quả kiểm thử](docs/TEST_RESULTS.md) và [nguồn tài sản](docs/ASSETS.md).
