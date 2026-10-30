# Nhận diện nhóm món bằng ảnh mẫu và Qwen local

Backend dùng hai nguồn bằng chứng: đặc trưng ảnh của SigLIP2 tìm nhóm ảnh mẫu gần nhất, sau đó Qwen3-VL so sánh ảnh đang quét với các ví dụ đã gán nhãn. Chỉ trả nhóm món khi chúng thống nhất và Qwen thấy dấu hiệu phù hợp trong ảnh truy vấn. Tên gánh hoặc điểm dừng đang chọn không được gửi cho hai bộ nhận diện.

Nếu Qwen chưa thống nhất về tên món nhưng ảnh mẫu có độ giống đủ cao, một lượt Qwen mới chỉ quan sát **riêng ảnh truy vấn**, không thấy tên món hay các ảnh ví dụ. Lượt này ghi các đặc điểm nhìn thấy như khối cắt, trứng phẳng, bánh tròn chiên, đĩa bánh trắng hấp, múi trắng dạng hoa trong gỏi, nếp tàu hũ, hình lòng/tổ ong hoặc ly nước. Backend chỉ chấp nhận khi một nhóm món gần trong index có bộ đặc điểm phù hợp duy nhất. Đây là cách xử lý trường hợp model gọi sai tên dù nhìn được hình dạng; không dùng similarity đơn lẻ để cấp dấu.

Nhóm món gồm cả biến thể: cà phê đen/sữa, bông lan thường/trứng muối, phá lấu nước/xào. Kết quả không xác nhận công thức, chất gây dị ứng, người bán hay giao dịch; chi tiết món trên giao diện vẫn lấy từ danh mục của gánh.

## Cài trên Windows

Chạy tại thư mục `ganhmuusinh` với Python 3.12 trở lên và Node 24:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File be/vision/setup.ps1
npm run dev
```

Script tạo `.venv-vision`, cài bản PyTorch CPU riêng, tải một lần bộ mã hóa ảnh SigLIP2 khoảng 372 MB, trích đặc trưng ảnh, giữ bộ chia dữ liệu và tạo index. Môi trường riêng tránh xung đột OpenMP với Python/Conda có sẵn trên máy. Chạy lại backend sau khi xây index. Worker Python tự khởi động khi quét và nghỉ sau hai phút không dùng, không mở cổng mạng riêng. Những lần quét sau dùng model đã cache, không gọi dịch vụ tính phí.

`npm run dev` mở Ollama dành cho dự án tại `127.0.0.1:11435`, với `LLAMA_ARG_CACHE_RAM=512`, một model và một lượt suy luận đồng thời. Khi chạy bản build, mở `npm run ai:serve` rồi `npm start`. Phiên này dùng model đã tải sẵn. Log ở `.reference/ollama-local.log`. Lượt chạy dài đã phát hiện Ollama mặc định giữ gần 8 GiB cache prompt trong RAM, gây `std::bad_alloc` trên máy 16 GB RAM và trả phản hồi rỗng. Giới hạn cache này áp dụng cho phiên dự án, theo [tham số cache RAM của llama-server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md); không làm giảm trọng số hay chất lượng ảnh đầu vào.

Model ảnh là [SigLIP2 image encoder của timm](https://huggingface.co/timm/vit_base_patch16_siglip_224.v2_webli), revision `4c3661e5ac879a276ddc5ddc6d3f0ecc78fd5d82`, dùng trọng số safetensors. Qwen vẫn chạy qua Ollama với `qwen3-vl:8b-instruct-q8_0`. Trọng số của cả hai model không được fine-tune bằng dataset này; ảnh mẫu tạo thành bộ tham chiếu.

`GET /api/health` có `visionPipeline: reference-consensus-v3` và `referenceVisionConfigured: true` khi index/môi trường đã sẵn sàng. Nếu worker không chạy được, backend dùng lượt quan sát và đối chiếu Qwen, đồng thời health chuyển trạng thái ảnh mẫu sang false. Kiểm tra log backend và chạy lại script setup khi cần. Có thể cấu hình `VISION_PYTHON` và `VISION_INDEX_PATH` trong `be/.env`.

## Bổ sung ảnh

Đặt ảnh vào các thư mục nhóm món có sẵn trong `dataset/`. Ưu tiên ảnh gốc có cạnh ngắn từ 400 px, nhiều góc chụp, ánh sáng và cách trình bày. Pipeline từ chối ảnh có cạnh dưới 224 px; phóng to thumbnail không tạo thêm chi tiết.

Khi thay đổi dataset, trích đặc trưng và rà lại bộ chia:

```powershell
.\.venv-vision\Scripts\python.exe be/vision/extract_features.py
.\.venv-vision\Scripts\python.exe be/vision/prepare_dataset.py --reset-splits
.\.venv-vision\Scripts\python.exe be/vision/build_index.py
```

Chỉ dùng `--reset-splits` sau khi rà ảnh mới/thay thế; nó tạo phiên bản bộ chia mới và cần đánh giá lại. Script mặc định giữ bộ chia đã ghi, từ chối âm thầm chuyển ảnh test sang tham chiếu. Không xóa ảnh khó chỉ vì model nhận sai. Hãy thêm ví dụ cùng biến thể để model có dữ liệu đối chiếu, nhất là phá lấu xào mì, bánh bị phủ topping, đồ uống trong cốc và gỏi có nguyên liệu bị che.

## Chạy đánh giá

```powershell
# Toàn bộ dataset; luôn loại nhóm của chính ảnh truy vấn khỏi index.
node be/scripts/evaluate-vision.js be/eval/dataset-manifest.json --references --trace --quiet --output=.reference/dataset-final-all.json

# Chỉ tập test đã được giữ riêng.
node be/scripts/evaluate-vision.js be/eval/dataset-manifest.json --references --split=test --quiet --output=.reference/dataset-test.json

# Ảnh ngoài danh mục, kiểm tra nhận nhầm.
node be/scripts/download-vision-samples.js be/eval/vision-negatives.json
node be/scripts/evaluate-vision.js be/eval/vision-negatives.json --references --trace --quiet --output=.reference/dataset-final-negatives.json

# Tạo CSV, Markdown và trang xem từng ảnh từ các kết quả đã lưu.
.\.venv-vision\Scripts\python.exe be/vision/report.py

# Kiểm thử API/nhận diện và phép so sánh ảnh.
npm test
.\.venv-vision\Scripts\python.exe -m unittest discover -s be/vision -p test_*.py
```

`--resume` tiếp tục lượt đánh giá bị ngắt nếu hash của dataset, model, code và index không đổi. Mỗi ảnh lưu kết quả ngay sau khi chạy. Ảnh test không nằm trong index; các ảnh thuộc cùng nhóm ảnh gốc/ảnh tương tự được loại cùng nhau. Cần thu thêm ảnh thực tế từ các lần chụp/người bán khác nhau và ảnh ngoài danh mục để đánh giá khả năng tổng quát, vì bộ ảnh web nhỏ chưa đại diện cho camera người dùng.

Similarity và confidence không phải xác suất đúng đã được hiệu chuẩn. Báo cáo phải giữ riêng số nhận đúng, sai nhãn, từ chối và lỗi dữ liệu. Xem [kết quả từng ảnh](vision/DATASET_RESULTS.md) sau khi hoàn thành lượt đánh giá.
