"""Build a complete, local per-photo audit from saved model responses."""

import csv
import html
import json
import statistics
import subprocess
from pathlib import Path
from urllib.parse import quote
from config import ROOT

destination = ROOT / "docs/vision"
destination.mkdir(exist_ok=True)
manifest = json.loads((ROOT / "be/eval/dataset-manifest.json").read_text(encoding="utf8"))
before = json.loads((ROOT / ".reference/dataset-baseline-all.json").read_text(encoding="utf8"))
after = json.loads((ROOT / ".reference/dataset-final-all.json").read_text(encoding="utf8"))
reviewed_labels = {row["id"]: row["expectedVendorId"] for row in manifest["records"]}
for row in before["results"]:
    row["expectedOriginal"] = row["expected"]
    row["expected"] = reviewed_labels[row["id"]]
    row["correct"] = not row.get("error") and row.get("observation", {}).get("matchedVendorId") == row["expected"]
before_by_id = {x["id"]: x for x in before["results"]}
after_by_id = {x["id"]: x for x in after["results"]}
notes = json.loads((ROOT / "be/eval/dataset-notes.json").read_text(encoding="utf8"))
names = {"banh-beo": "Bánh bèo", "banh-bong-lan": "Bánh bông lan", "banh-khot": "Bánh khọt",
         "banh-mi": "Bánh mì", "bot-chien": "Bột chiên", "ca-phe": "Cà phê", "che": "Chè đậu xanh",
         "dau-hu": "Tàu hũ", "goi-kho-bo": "Gỏi khô bò", "goi-mang-cut": "Gỏi măng cụt",
         "nuoc-mia": "Nước mía", "pha-lau": "Phá lấu"}


def outcome(row):
    if not row: return "pending"
    if row.get("error"): return "error"
    if row.get("correct"): return "correct"
    return "wrong" if row.get("observation", {}).get("matchedVendorId") else "abstained"


def totals(rows):
    return {key: sum(outcome(x) == key for x in rows) for key in ["correct", "wrong", "abstained", "error"]}


status_names = {"correct": "Đúng", "wrong": "Sai nhãn", "abstained": "Chưa chắc", "error": "Lỗi/ảnh nhỏ", "pending": "Chưa chạy"}
b, a = totals(before["results"]), totals(after["results"])
rows = []
for sample in manifest["records"]:
    old, new = before_by_id.get(sample["id"]), after_by_id.get(sample["id"])
    obs = (new or {}).get("observation", {})
    rows.append({"path": sample["path"], "family": names[sample["expectedVendorId"]], "split": sample["split"],
                 "dimensions": f"{sample['width']}x{sample['height']}", "group": sample["group"],
                 "before": outcome(old), "beforePrediction": (old or {}).get("observation", {}).get("dishName", ""),
                 "after": outcome(new), "afterPrediction": obs.get("dishName", ""),
                 "method": obs.get("method", ""), "similarity": obs.get("referenceSimilarity", ""),
                 "seconds": round((new or {}).get("elapsedMs", 0) / 1000, 2),
                 "note": (new or {}).get("error") or obs.get("explanation", ""),
                 "qualityNote": notes.get(sample["path"], "")})
with (destination / "DATASET_RESULTS.csv").open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

test = [r for r in after["results"] if r.get("split") == "test"]
development = [r for r in after["results"] if r.get("split") == "development"]
test_stats, dev_stats = totals(test), totals(development)
summary = ["# Đánh giá toàn bộ dataset nhận diện món", "",
           f"Đã chạy {len(before['results'])}/107 ảnh trước cải tiến và {len(after['results'])}/107 ảnh sau cải tiến.", "",
           f"Model: `{after['model']}`; pipeline: `{after.get('pipeline', 'unknown')}`. Encoder SigLIP2 cố định, index gồm ảnh đã gán nhãn; không fine-tune trọng số Qwen. Máy đánh giá: RTX 4060 Ti 16 GB VRAM, 16 GB RAM.", "",
           "| Hệ thống | Đúng | Sai nhãn | Từ chối | Lỗi/ảnh nhỏ |",
           "|---|---:|---:|---:|---:|",
           f"| Qwen + mô tả cũ | {b['correct']} | {b['wrong']} | {b['abstained']} | {b['error']} |",
           f"| SigLIP2 + ảnh mẫu + Qwen | {a['correct']} | {a['wrong']} | {a['abstained']} | {a['error']} |", "",
           f"Thời gian trung vị trước: {statistics.median(r['elapsedMs'] for r in before['results'] if not r.get('error'))/1000:.1f} giây; sau: {statistics.median(r['elapsedMs'] for r in after['results'] if not r.get('error'))/1000:.1f} giây trên máy local này. Thời gian gồm toàn bộ pipeline và ảnh hưởng cache/bộ nhớ, không phải so sánh tốc độ thuần của model.", "",
           "Nhãn đánh giá là nhóm món theo thư mục, theo lựa chọn của người dùng: gồm cà phê đen/sữa và bông lan thường/trứng muối. Bảng so sánh thay đổi cả mô tả nhóm món và cách đối chiếu, không phải benchmark riêng hai model.", "",
           "Một nhãn đã được rà và sửa: `dataset/banh_beo/10.jpg` là bánh bột cắt miếng chiên, được ánh xạ sang nhóm bột chiên trong `be/eval/dataset-labels.json`. File gốc được giữ nguyên. Cả kết quả trước và sau được chấm theo cùng nhãn đã rà.", "",
           "Mỗi ảnh truy vấn được loại khỏi bộ tham chiếu theo nhóm ảnh gốc/ảnh tương tự. Index chạy thật có 83 ảnh tham chiếu/phát triển; 21 ảnh test không nằm trong index, 3 ảnh dưới 224 px bị loại. Ảnh web có thể đã xuất hiện trong dữ liệu tiền huấn luyện của model; nguồn chụp chưa đủ thông tin để xác nhận độc lập theo người bán/buổi chụp.", "",
           f"Tập phát triển: {dev_stats['correct']}/{len(development)} đúng, {dev_stats['wrong']} sai nhãn, {dev_stats['abstained']} từ chối. Tập giữ riêng: **{test_stats['correct']}/{len(test)} đúng**, {test_stats['wrong']} sai nhãn, {test_stats['abstained']} từ chối. Đây là tập nhỏ trong dataset dự án, chưa phải đánh giá thực địa bên ngoài.", "",
           "Similarity là độ giống đặc trưng ảnh, confidence do Qwen tự đánh giá; cả hai không phải xác suất đúng đã hiệu chuẩn. Cân nhắc đồng thời nhận sai và từ chối: không nâng accuracy bằng cách luôn chọn nhãn gần nhất.", "",
           "| Nhóm món | Ảnh | Đúng trước | Đúng sau | Sai sau | Từ chối/lỗi sau |",
           "|---|---:|---:|---:|---:|---:|"]
for key, name in names.items():
    old = [r for r in before["results"] if r["expected"] == key]
    new = [r for r in after["results"] if r["expected"] == key]
    counts = totals(new)
    summary.append(f"| {name} | {len(old)} | {totals(old)['correct']} | {counts['correct']} | {counts['wrong']} | {counts['abstained'] + counts['error']} |")
summary.extend(["", "Xem từng ảnh ở [báo cáo ảnh](DATASET_RESULTS.html) hoặc [CSV đầy đủ](DATASET_RESULTS.csv).", "", "## Các ảnh chưa đạt", ""])
for row in rows:
    if row["after"] != "correct":
        summary.append(f"- [{row['path']}](../../{quote(row['path'])}): {status_names[row['after']]} — {row['note']} {row['qualityNote']}")
negative_path = ROOT / ".reference/dataset-final-negatives.json"
if negative_path.exists():
    negatives = json.loads(negative_path.read_text(encoding="utf8"))["results"]
    summary.extend(["", "## Ảnh ngoài danh mục", "",
                    f"Từ chối đúng {sum(r['correct'] for r in negatives)}/{len(negatives)} ảnh đối chứng (cola, trà đá, nước chanh, bánh xèo, flan, cảnh sông và xe bán hàng). Nguồn và giấy phép theo từng trang ảnh được ghi ở `be/eval/vision-negatives.json`."])
verification_path = ROOT / ".reference/dataset-verification.json"
if verification_path.exists():
    verification = json.loads(verification_path.read_text(encoding="utf8"))
    summary.extend(["", "## Kiểm tra tích hợp", "",
                    f"Backend: {verification['backendPassed']}/{verification['backendTotal']} kiểm thử đạt. Phép so sánh ảnh: {verification['referenceScorerTests']} kiểm thử Python đạt.", "",
                    "Đã chạy ảnh thật qua `/api/scans` với model local và database trong bộ nhớ: chọn sai điểm dừng không cấp dấu; chọn đúng nhóm món cấp đúng một dấu `ai-observed`, vẫn có `purchaseVerified: false`. Không ghi ca kiểm tra vào database người dùng.", "",
                    "Trang báo cáo có đủ 107 thẻ ảnh; bộ lọc tên file và nhóm món đã được kiểm tra trong Chrome."])
if after.get("responseStatusReview"):
    review = after["responseStatusReview"]
    summary.extend(["", f"Đã phát lại {review['cases']} phản hồi Qwen thật qua pipeline để kiểm tra phần chuẩn hóa thông báo: {review['predictionChanges']} thay đổi nhãn. Hai ảnh phá lấu đã được xác nhận có đồ ăn nhưng chưa đủ đặc điểm phân nhóm được trả trạng thái chưa chắc, tránh thông báo sai rằng ảnh không có đồ ăn. Thời gian trong bảng giữ theo lượt gọi model thật."])
(destination / "DATASET_RESULTS.md").write_text("\n".join(summary) + "\n", encoding="utf8")

cards = []
for row in rows:
    path = quote(row["path"], safe="/")
    cards.append(f'''<article data-family="{html.escape(row['family'])}" data-state="{row['after']}" data-search="{html.escape(row['path'])}">
<a href="../../{path}" target="_blank" rel="noopener"><img loading="lazy" src="../../{path}" alt="{html.escape(row['family'] + ' — ' + row['path'])}"></a>
<div class="body"><h2>{html.escape(row['family'])}</h2><code>{html.escape(row['path'])}</code>
<p class="meta">{row['dimensions']} · {row['split']} · {row['seconds']}s</p>
<p>Trước: <b>{status_names[row['before']]}</b> · Sau: <b class="{row['after']}">{status_names[row['after']]}</b></p>
<p>{html.escape(row['afterPrediction'])} · {html.escape(row['method'])}</p>
<p class="note">{html.escape(row['note'])}</p><p class="note">{html.escape(row['qualityNote'])}</p></div></article>''')
options = ''.join(f'<option>{html.escape(name)}</option>' for name in names.values())
document = '''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chạm Vị — kiểm tra 107 ảnh</title>
<style>body{margin:0;background:#f6f5ee;color:#173d34;font:16px/1.5 system-ui}main{max-width:1400px;margin:auto;padding:28px}h1{font-size:30px;margin-bottom:6px}h2{font-size:18px;margin:0}header p{max-width:1000px}label{display:grid;gap:5px;font-size:14px}.filters{display:flex;gap:18px;flex-wrap:wrap;margin:24px 0}select,input{font:inherit;padding:10px;border:1px solid #becbc3;border-radius:7px;background:white}#grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}article{background:white;border:1px solid #d8dfd8;border-radius:12px;overflow:hidden}article img{height:210px;width:100%;object-fit:contain;background:#eceee5}article[hidden]{display:none}.body{padding:16px}.body code{font-size:12px;overflow-wrap:anywhere}.meta,.note{font-size:13px;color:#54675f}.correct{color:#17633d}.wrong,.error{color:#ab2929}.abstained{color:#885214}p{margin:8px 0}a{color:inherit}input{min-width:240px}</style>
<main><header><h1>Chạm Vị · Đánh giá 107 ảnh</h1><p>Trước: BEFORE. Sau: AFTER. Ảnh truy vấn được loại khỏi bộ ảnh mẫu; 21 ảnh test không nằm trong index. Similarity/confidence không phải accuracy đã hiệu chuẩn.</p><p><a href="DATASET_RESULTS.md">Báo cáo và giới hạn</a> · <a href="DATASET_RESULTS.csv">CSV đầy đủ</a></p></header>
<div class="filters"><label>Nhóm món<select id="family"><option value="">Tất cả</option>OPTIONS</select></label><label>Kết quả sau<select id="state"><option value="">Tất cả</option><option value="correct">Đúng</option><option value="wrong">Sai nhãn</option><option value="abstained">Chưa chắc</option><option value="error">Lỗi/ảnh nhỏ</option></select></label><label>Tìm tên ảnh<input id="search" placeholder="Ví dụ: goi_kho_bo/1.jpg"></label></div><p id="count" aria-live="polite"></p><section id="grid">CARDS</section></main>
<script>const controls=['family','state','search'].map(x=>document.getElementById(x));function filter(){const[f,s,q]=controls.map(x=>x.value.toLowerCase());let n=0;for(const card of document.querySelectorAll('article')){card.hidden=!!((f&&card.dataset.family.toLowerCase()!==f)||(s&&card.dataset.state!==s)||(q&&!card.dataset.search.toLowerCase().includes(q)));if(!card.hidden)n++}document.getElementById('count').textContent=n+' ảnh đang hiển thị'}controls.forEach(x=>x.addEventListener('input',filter));filter()</script></html>'''
document = document.replace('BEFORE', f"{b['correct']} đúng, {b['wrong']} sai nhãn, {b['abstained']} từ chối, {b['error']} lỗi/ảnh nhỏ")
document = document.replace('AFTER', f"đã chạy {len(after['results'])}/107 ảnh — {a['correct']} đúng, {a['wrong']} sai nhãn, {a['abstained']} từ chối, {a['error']} lỗi/ảnh nhỏ")
(destination / "DATASET_RESULTS.html").write_text(document.replace('OPTIONS', options).replace('CARDS', '\n'.join(cards)), encoding="utf8")
prettier = ROOT / "node_modules/prettier/bin/prettier.cjs"
if prettier.exists():
    subprocess.run(["node", str(prettier), "--write", str(destination / "DATASET_RESULTS.md"),
                    str(destination / "DATASET_RESULTS.html")], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
print("Reports:", destination)
