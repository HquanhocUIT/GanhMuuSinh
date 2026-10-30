# Tham khảo dữ liệu Gánh Mưu Sinh · 29/10/2026

Nguồn: [ganhmuusinh.vn](https://ganhmuusinh.vn/). Trang chính và đường đọc danh mục công khai mà giao diện website sử dụng được truy cập chỉ để đọc. Không đăng nhập, không thay đổi dữ liệu website gốc và không vượt quyền truy cập.

Trang có cấu trúc địa điểm với tên gánh, món bán, nhóm món, địa chỉ/mốc nhận biết, tọa độ, giá, giờ bán, câu chuyện và nguồn tham khảo. Giá/giờ bán có thể trống; tọa độ trên nguồn chưa tương đương với xác minh thực địa trong dự án này.

## Mẫu nhỏ đã đưa vào khu admin

| Tên theo nguồn       | Món tóm tắt  | Vị trí theo nguồn                                  | Giá / giờ |
| -------------------- | ------------ | -------------------------------------------------- | --------- |
| Gánh chè cụ Mai      | Chè          | Khaivan Building, Bến Thành, Hồ Chí Minh           | Chưa có   |
| Sữa Đậu Nành- chú Kỳ | Sữa đậu nành | VQ23+FQF, Linh Xuân, Hồ Chí Minh                   | Chưa có   |
| Hot Dog- chú Thông   | Hot dog      | 196-222 Đ.Nguyễn Văn Nghi, Hạnh Thông, Hồ Chí Minh | Chưa có   |

Đây là thông tin theo nguồn tại ngày đọc, không phải khuyến nghị đi đến một địa chỉ đã kiểm chứng. Có đường Google Maps gốc trong thẻ nguồn để admin đối chiếu. Nếu nguồn khác mâu thuẫn, cần khảo sát hoặc hỏi người bán trước khi sửa/công khai.

## Mapping

## Ranh giới phường và tuyến tham khảo

Danh sách 168 phường hiện hành và ranh giới tại `be/src/data/wards-hcm.geojson` lấy từ [tinhthanhpho.com](https://www.tinhthanhpho.com/api-docs), mục dữ liệu mở “Ranh giới xã theo tỉnh” (mã tỉnh 79). Trang nguồn ghi giấy phép CC BY 4.0. Ranh giới được dùng để xác định tên phường chứa tọa độ của 130 ghim tham khảo; 130 ghim hiện rơi vào 52 phường. Đây là phép gán theo tọa độ nguồn, chưa phải xác minh thực địa.

Planner tạo các tuyến tách biệt trong một lần gợi ý, tối đa 3 ghim mỗi tuyến, ưu tiên điểm gần nhau. Giá, giờ hoạt động, tình trạng còn bán, thành phần và dị ứng vẫn chưa được xác minh; tuyến chỉ giúp khám phá vị trí và cần mở nguồn bản đồ/kiểm tra trước khi đi.

| Trường nguồn            | Trường dự án                 | Xử lý                                           |
| ----------------------- | ---------------------------- | ----------------------------------------------- |
| `id`                    | `sourceRecordId`             | Giữ ID nguồn để đối chiếu/chống nhập trùng      |
| `name`                  | `name`                       | Giữ tên địa điểm theo nguồn                     |
| `food`                  | `dish`                       | Tóm tắt tên mặt hàng; không tự suy ra công thức |
| `spot`                  | `address`                    | Giữ địa chỉ/mốc nhận biết theo nguồn            |
| `latitude`, `longitude` | `lat`, `lng`                 | Tọa độ tham khảo, gắn trạng thái chưa kiểm tra  |
| `price`, `hours` trống  | `price: null`, `hours: null` | Không chuyển thành 0đ hoặc giả định mở cả ngày  |
| Website gốc             | `sourceUrl`                  | Đường dẫn HTTPS để đối chiếu                    |
| Ngày đọc                | `sourceRetrievedAt`          | `2026-10-29`                                    |
| Nội dung tham khảo      | `dataType`                   | `reference`, tách khỏi seed `illustrative`      |
| Chưa khảo sát           | `verification`               | `unverified`                                    |

Các trường ảnh, câu chuyện đời, số điện thoại và ID tài khoản nguồn không được nhập. Không lưu bundle JavaScript hoặc toàn bộ dữ liệu nguồn trong repo. Không đặt publishable key của website gốc trong ứng dụng.

## Luồng biên tập

1. Admin mở **Nguồn tham khảo** → nhập mẫu vào bản nháp. Nhập lại cùng mẫu mở bản đã có.
2. Giá, giờ bán, nguyên liệu và câu chuyện chưa có được giữ nguyên trạng thái thiếu. `allergensKnown: false`.
3. Admin đối chiếu nguồn, bổ sung thông tin đã kiểm tra, chỉ chia sẻ câu chuyện khi được đồng ý.
4. Muốn công khai phải có địa chỉ, khu vực, tọa độ, giá, giờ bán và nguồn. Đây là kiểm tra độ đầy đủ dữ liệu, không phải chứng nhận vệ sinh hoặc xác minh giao dịch.
5. User chỉ thấy bản công khai; nội dung lấy từ cộng đồng có đường dẫn nguồn riêng. Gánh chưa rõ nguyên liệu không được dùng trong lộ trình đang bật bộ lọc dị ứng.

Đóng góp user có luồng tương tự: chờ duyệt → tiếp nhận vào bản nháp → biên tập → công khai. Chỉ thay trạng thái khi có thao tác admin; không tự đồng bộ hay tự xuất bản theo website nguồn.

## Danh sách Google Maps

Nguồn tham khảo bổ sung: [Gánh Mưu Sinh – Toàn quốc](https://www.google.com/maps/@10.7524014,106.6815481,13.33z/data=!4m3!11m2!2syL7kE4gcCEMBEYgR2UjssA!3e3), được đọc ngày 29/10/2026. Danh sách hiển thị 359 ghim. Dự án giữ 127 mục có món ăn và tọa độ thuộc TP.HCM mới: 116 TP.HCM, 4 Bình Dương, 7 Vũng Tàu. Lọc theo ranh giới hành chính công khai và mô tả loại món; các mục không phải đồ ăn, ngoài khu vực, thiếu món rõ ràng hoặc lặp lại ghim đã có bị loại.

Tệp [references-google-maps.js](../be/src/data/references-google-maps.js) chỉ lưu ID ghim trong danh sách, tên món rút gọn, tọa độ và liên kết đối chiếu. Không chép tên/tuổi/câu chuyện cá nhân, số điện thoại, ảnh, ghi chú riêng, giá hay giờ bán. Địa chỉ để trống khi nguồn chỉ có ghim; nguyên liệu và dị ứng chưa xác định.

Admin có thể nhập nhóm này vào **Nguồn tham khảo**. Mỗi mục chỉ thành bản nháp, mang `verification: unverified`, `price: null` và `hours: null`; user chỉ thấy ghim cam tham khảo có nhãn chưa xác minh trên trang bản đồ, không thấy chúng như gánh đã xuất bản. Muốn đưa vào danh bạ/hành trình chính thức, admin cần đối chiếu địa chỉ, món, giá, giờ, nguyên liệu và chủ động xuất bản. Mục tương ứng với ba gánh đã có từ ganhmuusinh.vn được bỏ khỏi nhóm để tránh nhập trùng. Tệp là ảnh chụp dữ liệu tại ngày trên, không tự cập nhật theo Google Maps.

Riêng trang **Bản đồ**, các mục tham khảo được trả thêm trong `mapCandidates` và vẽ bằng ghim màu cam có nhãn **chưa xác minh**. Đây là lớp khám phá nguồn công khai, không khẳng định người bán còn hoạt động; các ghim này không có giá/giờ, không vào hành trình, không có nút lưu dấu và không được dùng để lọc dị ứng. Gánh đã biên tập/xuất bản tiếp tục dùng ghim xanh. Danh mục không đồng bộ real-time.

OpenStreetMap chỉ cung cấp lớp bản đồ nền, không cung cấp dữ liệu gánh hàng trong danh sách này. Bản đồ ghi công [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) và liên kết giấy phép dữ liệu [ODbL](https://opendatacommons.org/licenses/odbl/); dữ liệu nền và danh sách gánh là hai nguồn độc lập.
