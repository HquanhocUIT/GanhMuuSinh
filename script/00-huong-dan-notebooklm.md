# Dùng các kịch bản món ăn với NotebookLM

## Cách làm

1. Tạo một notebook riêng cho mỗi món để nội dung các câu chuyện không trộn lẫn.
2. Thêm file Markdown của món đó làm nguồn.
3. Chọn **Tóm tắt**, **Tiếng Việt**, **Ngắn**, giữ **1 nguồn**. Trong phần hướng dẫn tùy chỉnh Audio Overview, dán prompt ở cuối file này.
4. Nghe lại toàn bộ audio. Nếu NotebookLM thêm chi tiết ngoài kịch bản, hãy tạo lại hoặc chỉ dùng phần lời dẫn đã kiểm tra.
5. Khi tải audio, đặt tên file theo mã món trong web, ví dụ `bot-chien.mp3`, rồi đưa vào `fe/public/audio/stories/`.

## Prompt dùng chung

> Chỉ dùng mục “Kịch bản lời dẫn”. Đọc thẳng từ câu đầu tiên; không chào hỏi, dẫn nhập, tóm tắt hay kết luận thêm. Tạo audio ngắn bằng một giọng tiếng Việt tự nhiên, rõ chữ, nhịp vừa phải. Đọc sát nội dung, giữ nguyên nhắc nhở dị ứng; không thêm chi tiết hoặc lời thoại, không đọc tiêu đề, mã món hay ghi chú biên tập. Không tự kể chuyện về người bán hoặc khẳng định nguyên liệu chưa được xác minh. Tránh giọng quảng cáo hoặc diễn cảm quá mức.

## Tạo audio cục bộ bằng KorvaTTS

Các file lời dẫn có thể được đọc bằng giọng Ngọc Huyền trên máy, không cần API key. Từ thư mục `ganhmuusinh`, tạo môi trường một lần:

```powershell
python -m venv local-audio-test/.venv
local-audio-test/.venv/Scripts/python.exe -m pip install -r script/requirements-tts.txt
$env:HF_HOME = (Resolve-Path local-audio-test/hf-cache).Path
local-audio-test/.venv/Scripts/python.exe script/generate-audio.py
local-audio-test/.venv/Scripts/python.exe script/generate-audio-en.py
node be/scripts/update-demo-audio.js
```

Lần đầu cần mạng để tải model. Bản tiếng Việt và tiếng Anh được ghi vào `fe/public/audio/stories/`; lệnh cuối nối hai bản audio và lời kể vào 12 gánh minh họa trong cơ sở dữ liệu cục bộ. Bản tiếng Anh dùng giọng Ngọc Huyền; chất lượng phát âm tiếng Anh có thể khác tiếng Việt.

## Lưu ý

Các nhân vật, câu chuyện, vị trí và thông tin món trong thư mục này lấy từ dữ liệu seed minh họa của prototype. Đây không phải lời chứng thực hay hồ sơ của người bán thật. Nguyên liệu và cách ăn cũng cần được xác minh trước khi dùng như thông tin thực tế.

Thư mục hiện có 12 món mẫu đang dùng cho phần câu chuyện trong website. Mình chưa tạo kịch bản cho các ghim Google Maps chưa xác minh vì chúng không có câu chuyện người bán đủ tin cậy; không nên để AI tự dựng tiểu sử cho các gánh đó.
