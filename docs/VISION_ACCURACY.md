# Nhận diện món: cấu hình và phạm vi đánh giá

Kết quả đánh giá đầy đủ dataset 107 ảnh và cấu hình mới nằm ở [DATASET_RESULTS.md](vision/DATASET_RESULTS.md) và [VISION_REFERENCE_SETUP.md](VISION_REFERENCE_SETUP.md). Các phần hồi quy 7 ảnh bên dưới là lịch sử chẩn đoán ban đầu. Phiên bản hiện tại dùng nhóm món rộng, bộ ảnh tham chiếu SigLIP2, Qwen và kiểm tra hình dạng riêng trên ảnh truy vấn; Ollama dự án chạy ở cổng 11435 với cache RAM giới hạn 512 MiB.

Mặc định dùng `qwen3-vl:8b-instruct-q8_0` qua Ollama local. Cấu hình này được chạy trên RTX 4060 Ti 16 GB; model chiếm khoảng 13 GB VRAM khi suy luận trong phiên đánh giá. Chọn tag cụ thể để tránh đổi ngầm sang bản Thinking hoặc mức lượng tử hóa khác.

## Cách xử lý

1. Giải mã ảnh thật, giới hạn tối đa 40 triệu pixel, từ chối ảnh nhỏ hơn 224 px ở một chiều. Xoay theo EXIF, giữ tỷ lệ và giới hạn cạnh dài 2048 px. Giữ nguyên byte ảnh đã phù hợp.
2. Qwen quan sát hình dạng trong một yêu cầu riêng, chưa thấy tên món hoặc danh mục. Ví dụ: khối cắt đặc, bánh tròn hình chén, trứng chiên thành lớp, cơm hạt, nước dùng.
3. Loại các nhóm món trái với hình dạng vừa quan sát, rồi phân loại ảnh với mô tả hình ảnh và dấu hiệu phân biệt. Bột chiên cần thấy miếng bột cắt và lớp trứng phẳng; bánh khọt cần các bánh tròn nhỏ với viền hoặc nhân rõ; phá lấu cần nước dùng và hình dạng phần cái phù hợp.
4. Đối chiếu ảnh lại với các món dễ nhầm trong một yêu cầu mới. Không đưa nhãn thắng, điểm hoặc giải thích của lượt phân loại vào lượt này. Chỉ chấp nhận khi cùng nhãn, đủ dấu hiệu bắt buộc, không có mâu thuẫn, điểm tối thiểu 0,85 và chênh với ứng viên kế tiếp tối thiểu 0,15.
5. Ghép loại món đã nhận diện với điểm dừng người dùng chọn. Hai gánh cùng bán bột chiên được coi là một loại món trong bước nhận diện; ảnh không dùng để phân biệt danh tính người bán.

Các ngưỡng là quy tắc sàng lọc, **không phải điểm accuracy hoặc xác suất đã hiệu chuẩn**. Nhiều lượt trên cùng một model vẫn có thể mắc cùng lỗi. Không suy ra nguyên liệu, dị ứng, mua hàng hoặc địa điểm từ ảnh; thông tin nguyên liệu trên giao diện lấy từ danh mục.

Model nhận schema JSON, dùng temperature 0, seed 42 và repeat penalty 1,1 để giảm biến động và lặp văn bản. JSON schema chỉ bảo đảm định dạng, không bảo đảm nội dung đúng. Tham khảo [structured outputs của Ollama](https://docs.ollama.com/capabilities/structured-outputs), [API ảnh](https://docs.ollama.com/capabilities/vision) và [model Instruct Q8](https://ollama.com/library/qwen3-vl:8b-instruct-q8_0).

## Chạy lại đánh giá

```powershell
npm run vision:download -w be
npm run vision:eval -w be
node --test be/test/vision.test.js
```

`be/eval/vision-samples.json` chứa các ảnh công khai và nhãn mong đợi. Script tải ảnh vào `.reference/vision-images/`, không đưa ảnh vào danh mục du lịch hoặc tập huấn luyện. Kết quả được ghi vào `.reference/vision-evaluation.json`. Có thể truyền manifest riêng:

```powershell
node be/scripts/evaluate-vision.js my-cases.json --model=qwen3-vl:8b-instruct-q8_0 --output=.reference/my-results.json
```

Mỗi mục gồm `id`, `path` hoặc `url`, `expectedVendorId` (null cho món ngoài danh mục/ảnh không có món), và `selectedVendorId`. Tùy chọn `--case=id` chạy một ảnh; `--trace` ghi nội dung trả về của model để xem nguyên nhân sai. Script trả mã lỗi nếu có ca không đạt.

Nguồn ảnh công khai: [Botchien in Vietnam](https://commons.wikimedia.org/wiki/File:Botchien_in_Vietnam.jpg), [Bột chiên tại Sài Gòn](https://commons.wikimedia.org/wiki/File:Bột_chiên_tại_Sài_Gòn.JPG), [Bánh khọt 2020](<https://commons.wikimedia.org/wiki/File:Bánh_khọt_(2020-3-28).jpg>), [Bánh khọt by Baoothersks](https://commons.wikimedia.org/wiki/File:Bánh_khọt_by_Baoothersks.jpg). Tác giả và giấy phép được ghi tại từng trang nguồn; các bản tải cục bộ chỉ phục vụ đánh giá. Hai ảnh người dùng thử được đọc từ máy cục bộ trong phiên này và không chép vào source hoặc danh mục.

## Kết quả hồi quy ngày 30/10/2026

So sánh toàn bộ cấu hình cũ (Thinking Q4, tên món và một lượt đoán) với cấu hình mới (Instruct Q8, chuẩn hóa ảnh, đặc trưng hình ảnh và ba lượt đối chiếu). Đây không phải benchmark riêng của hai model.

| Ca kiểm tra                     | Kết quả cũ            | Kết quả cuối                  |
| ------------------------------- | --------------------- | ----------------------------- |
| Đúng ảnh bột chiên được báo lỗi | Nhầm bánh khọt        | Bột chiên                     |
| Bột chiên tại chợ               | Nhầm bánh khọt        | Bột chiên                     |
| Bột chiên Sài Gòn               | Nhầm bánh khọt        | Bột chiên                     |
| Bánh khọt trên chảo             | Nhầm bánh bèo         | Bánh khọt                     |
| Bánh khọt trong hộp             | Lỗi xử lý ảnh/model   | Bánh khọt                     |
| Cơm tấm ngoài danh mục          | Nhầm phá lấu          | Từ chối đúng: ngoài danh mục  |
| Ảnh sông không có món ăn        | Lỗi định dạng kết quả | Từ chối đúng: không có món ăn |

Lượt cuối đạt **7/7 ca hồi quy**, gồm 5 ảnh món được nhận đúng và 2 ảnh cần từ chối được từ chối đúng. Trên GPU đã nêu, ảnh món mất khoảng **15–21 giây** khi model đã tải vào bộ nhớ; hai ảnh từ chối mất khoảng **3–6 giây**. Kết quả chi tiết của phiên làm việc nằm trong `.reference/vision-before.json` và `.reference/vision-final.json`.

Cùng bộ ảnh này đã được dùng để tìm lỗi và chỉnh prompt; **chưa phải tập kiểm tra độc lập**. Một bản trung gian còn từ chối nhầm ảnh rõ vì model nhầm “không biết tên món” với “ảnh mờ”; định nghĩa chất lượng ảnh đã được tách rõ trong prompt cuối. Số 7/7 chỉ xác nhận các lỗi hồi quy đã xử lý, không đo độ chính xác với ảnh mới.

Các kiểm tra tự động của bộ nhận diện kiểm tra từ chối kết quả thiếu bằng chứng, các lượt bất đồng, nhãn hoặc cue không tồn tại, món ngoài danh mục, nhiều người bán cùng món, không đưa điểm dừng vào prompt, schema Ollama, ảnh nhỏ và xoay EXIF. 17 test nhận diện/ảnh và 6 test API liên quan đều đạt. Build frontend và xử lý ảnh trong Chrome đã chạy thành công. Ảnh được báo lỗi đã đi qua chuẩn hóa ảnh trong Chrome → `/api/scans` → dấu `ai-observed` trong database bộ nhớ, trả HTTP 200 và món `bot-chien` sau khoảng 19 giây; không ghi dữ liệu kiểm thử vào database người dùng.

Toàn bộ backend đạt **45/47 test**. Hai lỗi dữ liệu tham khảo tồn tại từ trước: số bản ghi mong đợi 3 trong khi thực tế 130, và `dataMode` mong đợi `illustrative` trong khi catalog hiện là `mixed`.

## Bộ ảnh người dùng trong `dataset/`

Ngày 30/10/2026, thư mục có 107 ảnh thuộc 12 nhóm món. Số lượng thực tế là 5–13 ảnh mỗi nhóm, chưa đồng đều 8–10; có 3 ảnh gỏi khô bò nhỏ hơn ngưỡng 224 px. Xem nhanh contact sheet cho thấy một vài ảnh có thể lệch khỏi nhãn hẹp của thư mục, đáng chú ý `pha_lau` và `banh_bong_lan`, nên cần xác minh nhãn trước khi dùng huấn luyện.

Baseline ban đầu trên 2 ảnh chọn ngẫu nhiên mỗi nhóm đạt 10/24 ảnh khớp nhãn. Phần lớn lỗi là từ chối do thiếu dấu hiệu hoặc ảnh có dấu hiệu nhãn chưa chuẩn. Đây là mẫu phát triển nhỏ, không đại diện accuracy. Sau khi điều chỉnh cue salad bào cho gỏi khô bò và bộ lọc hình học bánh khọt, ảnh gỏi khô bò trong ảnh chụp màn hình cùng hai ca gỏi khô bò/bánh khọt từng bị từ chối đều được nhận diện đúng khi chạy lại. Chưa chạy lại toàn bộ 24 ca nên không báo một điểm số sau chỉnh sửa.

Các ảnh hiện được dùng để rà nhãn và đánh giá thủ công; chưa fine-tune Qwen. Trước khi tạo tập train, cần rà từng ảnh, cân bằng số lượng và giữ ảnh chụp khác nhau giữa tập phát triển và tập kiểm tra độc lập.

## Giới hạn

Đây là bộ ảnh hồi quy nhỏ, tập trung vào lỗi bột chiên/bánh khọt và từ chối đúng. Chưa đại diện cho ảnh thực tế của tất cả 12 món. Kết quả đạt trên bộ này không thể được quảng bá là accuracy chung hoặc bảo đảm 100%.

Để đo và nâng độ chính xác tiếp, cần tập ảnh đã gán nhãn riêng cho từng món, có nhiều ánh sáng, góc chụp, món bị che, biến thể địa phương và các món gần giống ngoài danh mục. Giữ một tập kiểm tra tách biệt trước khi chỉnh prompt hoặc fine-tune, đo riêng nhận sai và từ chối nhầm. Bổ sung ảnh của từng món và đánh giá trước khi mở rộng đặc trưng nhận diện.
