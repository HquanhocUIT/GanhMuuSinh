# Kết quả kiểm thử · 29/10/2026

Môi trường: Windows, Node.js 24.14.1, Chrome cài sẵn, Playwright. Kiểm thử trên localhost; không triển khai lên dịch vụ bên ngoài.

## Build

`npm run build`: **PASS**. TypeScript kiểm tra kiểu và Vite tạo bản production; map/các trang phụ được tách chunk. Ảnh và font được đóng gói cục bộ.

## Backend

`npm test`: **30/30 PASS** (18 bài người khám phá và 12 bài tài khoản/quản trị).

- Planner: giới hạn ngân sách, tối đa điểm dừng, vùng, dị ứng, giờ đến + thời gian ăn, thứ tự ngắn hơn và không nới điều kiện khi không có kết quả.
- API: dữ liệu minh họa, validation đầu vào, ghép câu gọi món, vendor không tồn tại, trạng thái thiếu AI key.
- Passport: cookie ẩn danh, tách trình duyệt, không tạo dấu trùng, tách dấu demo/AI.
- Scanner: từ chối ảnh giả loại, thiếu ảnh, chế độ không hợp lệ; không trao dấu khi AI không khớp hoặc độ tin cậy thấp.
- AI adapter: mock REST request, JSON/schema, xử lý lỗi upstream không lộ thông tin khóa.
- Chặn ghi dữ liệu từ Origin bên ngoài danh sách cho phép.

Kiểm thử tài khoản/quản trị mới:

- Guest nhận 401 và user nhận 403 khi gọi API admin. Tự đăng ký kèm `role: admin` vẫn chỉ có role user.
- Mật khẩu dùng scrypt với salt riêng; DTO không trả hash; email không phân biệt hoa thường. Sai mật khẩu và email không tồn tại có cùng thông báo.
- Cookie auth HttpOnly/SameSite, logout thu hồi token; phiên hết hạn hoặc giả mạo bị từ chối.
- Hộ chiếu khách gộp vào tài khoản, đọc lại từ trình duyệt khác, không lộ sau logout hoặc chuyển tài khoản.
- Draft không lộ ra catalog; xuất bản cập nhật danh mục; ghi với revision cũ trả 409.
- Nhập nguồn giữ giá/giờ bán thiếu là null, có provenance, không tự viết câu chuyện và không tạo trùng.
- Lưu trữ gánh hàng ẩn các hành trình liên quan và chặn order/scan mới; dấu hộ chiếu cũ vẫn còn.
- Hành trình từ chối điểm trùng, khác vùng, chưa công khai hoặc không phù hợp giờ bán. Ngân sách tính từ giá từng điểm.
- Đóng góp user chỉ chủ sở hữu đọc được; tiếp nhận tạo bản nháp trong transaction; không duyệt lại cùng đề xuất.
- PUT/POST kiểm tra Origin; đóng/mở lại SQLite giữ nội dung và revision, seed không ghi đè chỉnh sửa.

## Giao diện

`npm run test:e2e`: **23 PASS, 1 SKIP, 0 FAIL**. Bài SKIP là bản sao mobile của phép quét nhiều kích thước, đã chạy một lần ở project desktop.

- Chrome desktop **1440 × 1000**, mobile emulation **375 × 812**.
- Thêm các kích thước **320 × 740**, **812 × 375** (ngang), **768 × 1024**, **1024 × 768**, **1440 × 1000**; các trang khám phá, gọi món, hộ chiếu, câu chuyện, bản đồ không tràn ngang; có bật reduced motion.
- Home hiển thị ảnh thật, lọc khu vực, tìm kiếm, empty state và reset bộ lọc.
- Lưu hành trình giữ qua reload; dialog có Escape, giữ focus và trả focus đúng nút.
- Planner giữ bộ lọc dị ứng, mở dialog vừa màn hình và bắt đầu hành trình; hành trình giữ qua reload.
- Câu gọi món chứa đúng số phần và yêu cầu; câu mẫu dịch được khi AI tắt.
- Quét demo ghi rõ trạng thái minh họa, hiện nguyên liệu tham khảo, mở câu chuyện và giữ dấu hộ chiếu qua reload.
- Tải ảnh hợp lệ có preview; file không hợp lệ báo lỗi.
- Nút đổi ngôn ngữ chính và skip link dùng được bằng bàn phím.

Các luồng mới đều chạy ở desktop và mobile:

- Đăng nhập admin, điều hướng dashboard/nguồn tham khảo, tải lại giữ phiên và không tràn ngang.
- Nhập mẫu tham khảo thành nháp, giữ trống giá và chưa công khai cho user.
- Tạo/sửa gánh hàng, lưu câu chuyện và tạo hành trình nháp với thứ tự điểm dừng.
- User đăng ký → bị chặn ở admin → gửi đóng góp → admin tiếp nhận → user đăng nhập lại đọc phản hồi.

Database E2E riêng trong bộ nhớ; tài khoản admin test không tồn tại trong database phát triển. Công cụ tạo admin bằng terminal được smoke-test trên database tạm, không in thông tin đăng nhập vào kết quả kiểm thử.

Các lỗi tìm thấy và đã sửa trong quá trình kiểm tra: tên truy cập của nút lưu trên mobile, viewport dialog bị tự pan khi focus, chữ nhỏ và font tải ngoài mạng.

## Giới hạn kiểm chứng

- **Chưa gọi Gemini thật** vì không có khóa API. Adapter được kiểm thử bằng mock, không đại diện cho độ chính xác/thời gian phản hồi của mô hình thực tế.
- **Chưa kiểm chứng âm thanh thực tế, giọng miền Nam hoặc micro trên điện thoại thật**. Web Speech và quyền thiết bị phụ thuộc trình duyệt/OS; kiểm thử tự động xác nhận câu chữ và luồng nhập tay.
- Chụp ảnh thật trên thiết bị, GPS, giao dịch mua hàng và chống giả mạo chưa được xác minh. Ứng dụng không gắn nhãn dấu nào là mua hàng đã xác thực.
- Test xác nhận map component/ghim và danh sách; không khẳng định tile OpenStreetMap luôn tải được trong mọi mạng.
- Đây là kiểm thử chức năng và bố cục, chưa phải audit WCAG đầy đủ hay kiểm thử chịu tải/production.
- Auth và CMS ở phạm vi MVP, chưa có email verification, khôi phục mật khẩu hoặc MFA. Các danh sách quản trị có giới hạn bản ghi; không coi đây là đánh giá bảo mật toàn diện.

## Ảnh giao diện

- [Admin desktop](screenshots/admin-desktop.png)
- [Admin mobile](screenshots/admin-mobile.png)
- [Nguồn tham khảo](screenshots/admin-sources-desktop.png)

- [Trang chủ desktop](screenshots/home-desktop.png)
- [Trang chủ mobile](screenshots/home-mobile.png)
- [Màn hình đầu mobile](screenshots/home-mobile-fold.png)
- [Food X-Ray desktop](screenshots/scanner-desktop.png)
- [Food X-Ray mobile](screenshots/scanner-mobile.png)
- [Hộ chiếu desktop](screenshots/passport-desktop.png)
- [Hộ chiếu mobile](screenshots/passport-mobile.png)
