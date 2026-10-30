# Đánh giá toàn bộ dataset nhận diện món

Đã chạy 107/107 ảnh trước cải tiến và 107/107 ảnh sau cải tiến.

Model: `qwen3-vl:8b-instruct-q8_0`; pipeline: `reference-consensus-v3`. Encoder SigLIP2 cố định, index gồm ảnh đã gán nhãn; không fine-tune trọng số Qwen. Máy đánh giá: RTX 4060 Ti 16 GB VRAM, 16 GB RAM.

| Hệ thống                 | Đúng | Sai nhãn | Từ chối | Lỗi/ảnh nhỏ |
| ------------------------ | ---: | -------: | ------: | ----------: |
| Qwen + mô tả cũ          |   57 |        8 |      39 |           3 |
| SigLIP2 + ảnh mẫu + Qwen |   98 |        0 |       6 |           3 |

Thời gian trung vị trước: 15.6 giây; sau: 8.9 giây trên máy local này. Thời gian gồm toàn bộ pipeline và ảnh hưởng cache/bộ nhớ, không phải so sánh tốc độ thuần của model.

Nhãn đánh giá là nhóm món theo thư mục, theo lựa chọn của người dùng: gồm cà phê đen/sữa và bông lan thường/trứng muối. Bảng so sánh thay đổi cả mô tả nhóm món và cách đối chiếu, không phải benchmark riêng hai model.

Một nhãn đã được rà và sửa: `dataset/banh_beo/10.jpg` là bánh bột cắt miếng chiên, được ánh xạ sang nhóm bột chiên trong `be/eval/dataset-labels.json`. File gốc được giữ nguyên. Cả kết quả trước và sau được chấm theo cùng nhãn đã rà.

Mỗi ảnh truy vấn được loại khỏi bộ tham chiếu theo nhóm ảnh gốc/ảnh tương tự. Index chạy thật có 83 ảnh tham chiếu/phát triển; 21 ảnh test không nằm trong index, 3 ảnh dưới 224 px bị loại. Ảnh web có thể đã xuất hiện trong dữ liệu tiền huấn luyện của model; nguồn chụp chưa đủ thông tin để xác nhận độc lập theo người bán/buổi chụp.

Tập phát triển: 23/25 đúng, 0 sai nhãn, 2 từ chối. Tập giữ riêng: **19/21 đúng**, 0 sai nhãn, 2 từ chối. Đây là tập nhỏ trong dataset dự án, chưa phải đánh giá thực địa bên ngoài.

Similarity là độ giống đặc trưng ảnh, confidence do Qwen tự đánh giá; cả hai không phải xác suất đúng đã hiệu chuẩn. Cân nhắc đồng thời nhận sai và từ chối: không nâng accuracy bằng cách luôn chọn nhãn gần nhất.

| Nhóm món      | Ảnh | Đúng trước | Đúng sau | Sai sau | Từ chối/lỗi sau |
| ------------- | --: | ---------: | -------: | ------: | --------------: |
| Bánh bèo      |   9 |          5 |        9 |       0 |               0 |
| Bánh bông lan |   7 |          0 |        5 |       0 |               2 |
| Bánh khọt     |  10 |          8 |       10 |       0 |               0 |
| Bánh mì       |   7 |          6 |        7 |       0 |               0 |
| Bột chiên     |  11 |          7 |       11 |       0 |               0 |
| Cà phê        |   8 |          2 |        7 |       0 |               1 |
| Chè đậu xanh  |   8 |          8 |        8 |       0 |               0 |
| Tàu hũ        |  11 |          3 |       11 |       0 |               0 |
| Gỏi khô bò    |  10 |          6 |        7 |       0 |               3 |
| Gỏi măng cụt  |   8 |          2 |        8 |       0 |               0 |
| Nước mía      |   5 |          1 |        5 |       0 |               0 |
| Phá lấu       |  13 |          9 |       10 |       0 |               3 |

Xem từng ảnh ở [báo cáo ảnh](DATASET_RESULTS.html) hoặc [CSV đầy đủ](DATASET_RESULTS.csv).

## Các ảnh chưa đạt

- [dataset/banh_bong_lan/6.jpg](../../dataset/banh_bong_lan/6.jpg): Chưa chắc — Đặc điểm món và ảnh mẫu chưa thống nhất. Hãy chụp cận món hơn để thấy rõ phần món chính. Phần bánh bị sốt, chà bông và topping che gần hết. Thêm góc ngang hoặc ảnh cắt bánh để nhìn thấy ruột xốp; không suy ra bánh chỉ từ trứng muối.
- [dataset/banh_bong_lan/7.jpg](../../dataset/banh_bong_lan/7.jpg): Chưa chắc — Ảnh chưa giống đủ với các nhóm món mẫu, hoặc món quá nhỏ trong khung hình. Hãy chụp cận món hoặc ly đang dùng. Ảnh có dải đen và nhiều chai/hộp ở nền; các bánh nhỏ chưa lộ ruột. Nên dùng ảnh gốc chụp cận một bánh hoặc một miếng bánh đã cắt.
- [dataset/ca_phe/5.jpg](../../dataset/ca_phe/5.jpg): Chưa chắc — Chưa thấy đủ đặc điểm để phân biệt món này với các món gần giống. Chụp rõ hình dạng phần bánh, nhân hoặc nước dùng nhé. Ly tối màu chụp ngoài trời khó phân biệt cà phê với trà đá/cola bằng một ảnh. Thêm ảnh quá trình pha hoặc góc nhìn rõ crema/lớp cà phê; hệ thống ưu tiên từ chối khi chưa chắc.
- [dataset/goi_kho_bo/6.jpg](../../dataset/goi_kho_bo/6.jpg): Lỗi/ảnh nhỏ — Ảnh quá nhỏ để phân biệt món. Chọn ảnh gốc ít nhất 224 px mỗi chiều. Ảnh 299×168 px dưới ngưỡng cạnh ngắn 224 px. Cần bản gốc lớn hơn; phóng to thumbnail không bổ sung chi tiết.
- [dataset/goi_kho_bo/7.jpg](../../dataset/goi_kho_bo/7.jpg): Lỗi/ảnh nhỏ — Ảnh quá nhỏ để phân biệt món. Chọn ảnh gốc ít nhất 224 px mỗi chiều. Ảnh 251×201 px dưới ngưỡng cạnh ngắn 224 px. Cần bản gốc lớn hơn; phóng to thumbnail không bổ sung chi tiết.
- [dataset/goi_kho_bo/9.jpg](../../dataset/goi_kho_bo/9.jpg): Lỗi/ảnh nhỏ — Ảnh quá nhỏ để phân biệt món. Chọn ảnh gốc ít nhất 224 px mỗi chiều. Ảnh 204×247 px dưới ngưỡng cạnh ngắn 224 px. Cần bản gốc lớn hơn; phóng to thumbnail không bổ sung chi tiết.
- [dataset/pha_lau/images (5).jpg](../../dataset/pha_lau/images%20%285%29.jpg): Chưa chắc — Đã nhìn thấy món ăn hoặc đồ uống, nhưng chưa đủ đặc điểm để xác định nhóm món. Hãy chụp gần phần món chính, để lộ hình dạng và kết cấu rõ hơn. Lượt kiểm tra đặc điểm xác nhận có đồ ăn và nước dùng, nhưng chưa xác nhận được hình lòng/nếp/tổ ong đủ rõ. Cần góc chụp gần phần cái; không suy ra phá lấu chỉ từ màu nước dùng.
- [dataset/pha_lau/images (8).jpg](../../dataset/pha_lau/images%20%288%29.jpg): Chưa chắc — Chưa thấy đủ đặc điểm để phân biệt món này với các món gần giống. Chụp rõ hình dạng phần bánh, nhân hoặc nước dùng nhé. Biến thể phá lấu xào mì khác xa phần lớn ảnh phá lấu nước. Cần thêm ảnh tham chiếu xào mì và cận phần lòng có nếp/tổ ong/ống rõ, thay vì gán nhãn dựa vào sợi mì.
- [dataset/pha_lau/images (9).jpg](../../dataset/pha_lau/images%20%289%29.jpg): Chưa chắc — Đã nhìn thấy món ăn hoặc đồ uống, nhưng chưa đủ đặc điểm để xác định nhóm món. Hãy chụp gần phần món chính, để lộ hình dạng và kết cấu rõ hơn. Lượt kiểm tra đặc điểm xác nhận có đồ ăn, nhưng các khối sẫm màu trong nước dùng chưa đủ để phân biệt lòng với món hầm khác. Nên bổ sung ảnh phần cái ở góc sáng và gần hơn.

## Ảnh ngoài danh mục

Từ chối đúng 7/7 ảnh đối chứng (cola, trà đá, nước chanh, bánh xèo, flan, cảnh sông và xe bán hàng). Nguồn và giấy phép theo từng trang ảnh được ghi ở `be/eval/vision-negatives.json`.

## Kiểm tra tích hợp

Backend: 60/60 kiểm thử đạt. Phép so sánh ảnh: 3 kiểm thử Python đạt.

Đã chạy ảnh thật qua `/api/scans` với model local và database trong bộ nhớ: chọn sai điểm dừng không cấp dấu; chọn đúng nhóm món cấp đúng một dấu `ai-observed`, vẫn có `purchaseVerified: false`. Không ghi ca kiểm tra vào database người dùng.

Trang báo cáo có đủ 107 thẻ ảnh; bộ lọc tên file và nhóm món đã được kiểm tra trong Chrome.

Đã phát lại 107 phản hồi Qwen thật qua pipeline để kiểm tra phần chuẩn hóa thông báo: 0 thay đổi nhãn. Hai ảnh phá lấu đã được xác nhận có đồ ăn nhưng chưa đủ đặc điểm phân nhóm được trả trạng thái chưa chắc, tránh thông báo sai rằng ảnh không có đồ ăn. Thời gian trong bảng giữ theo lượt gọi model thật.
