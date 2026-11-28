"""Build the 100-book sample catalog from Open Library (2B-30.a).

Every record (title, author, publisher, year, ISBN, cover) is taken from ONE
real Open Library *edition*, so the cover image always belongs to the book that
is listed. Vietnamese editions are preferred whenever Open Library has one with
a cover; otherwise the original edition is used.

Run from the repository root (needs network access):
    python back_fast_api/scripts/build_books_from_openlibrary.py

Outputs:
    data/books_seed.csv, data/books_seed.json        (+ copies in back_fast_api/data)
    mocks/books_mock.json, back_fast_api/mocks/books_mock.json
    back_fast_api/static/covers/book_001.jpg .. book_100.jpg
"""

import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COVERS_DIR = os.path.join(ROOT, "back_fast_api", "static", "covers")
CACHE_DIR = os.path.join(ROOT, "back_fast_api", "scripts", ".ol_cache")
UA = {"User-Agent": "UniversityDigitalLibrary-seed/1.0 (student project)"}

CATEGORY = {
    "IT": "Công nghệ thông tin", "MATH": "Khoa học", "PHYS": "Khoa học",
    "LIT": "Văn học", "ECO": "Kinh tế", "ENG": "Ngoại ngữ",
}
CATEGORY_ID = {"Công nghệ thông tin": 1, "Khoa học": 2, "Văn học": 3, "Kinh tế": 4, "Ngoại ngữ": 5}
QUOTA = {"IT": 22, "MATH": 9, "PHYS": 8, "LIT": 33, "ECO": 16, "ENG": 12}

# (subject, language, title query, author query). Order = priority inside each subject.
# language "vie" = only accept a Vietnamese edition; "eng" = original edition.
CANDIDATES = [
    # ---------------- IT ----------------
    ("IT", "eng", "Clean Code", "Robert C. Martin"),
    ("IT", "eng", "The Pragmatic Programmer", "Andrew Hunt"),
    ("IT", "eng", "Design Patterns Elements of Reusable Object-Oriented Software", "Erich Gamma"),
    ("IT", "eng", "Refactoring Improving the Design of Existing Code", "Martin Fowler"),
    ("IT", "eng", "Introduction to Algorithms", "Thomas H. Cormen"),
    ("IT", "eng", "Artificial Intelligence A Modern Approach", "Stuart Russell"),
    ("IT", "eng", "Computer Networks", "Andrew S. Tanenbaum"),
    ("IT", "eng", "Operating System Concepts", "Abraham Silberschatz"),
    ("IT", "eng", "Database System Concepts", "Abraham Silberschatz"),
    ("IT", "eng", "Computer Security Principles and Practice", "William Stallings"),
    ("IT", "eng", "Python Crash Course", "Eric Matthes"),
    ("IT", "eng", "Fluent Python", "Luciano Ramalho"),
    ("IT", "eng", "JavaScript The Good Parts", "Douglas Crockford"),
    ("IT", "eng", "Effective Java", "Joshua Bloch"),
    ("IT", "eng", "Cracking the Coding Interview", "Gayle Laakmann McDowell"),
    ("IT", "eng", "Head First Design Patterns", "Eric Freeman"),
    ("IT", "eng", "Computer Architecture A Quantitative Approach", "John L. Hennessy"),
    ("IT", "eng", "Structure and Interpretation of Computer Programs", "Harold Abelson"),
    ("IT", "eng", "Code Complete", "Steve McConnell"),
    ("IT", "eng", "Modern Operating Systems", "Andrew S. Tanenbaum"),
    ("IT", "eng", "Digital Image Processing", "Rafael C. Gonzalez"),
    ("IT", "eng", "Designing Data-Intensive Applications", "Martin Kleppmann"),
    ("IT", "eng", "The C Programming Language", "Brian W. Kernighan"),
    ("IT", "eng", "Deep Learning", "Ian Goodfellow"),
    ("IT", "eng", "The Mythical Man-Month", "Frederick P. Brooks"),
    ("IT", "eng", "Computer Networking A Top-Down Approach", "James F. Kurose"),
    ("IT", "eng", "Domain-Driven Design", "Eric Evans"),
    # ---------------- MATH ----------------
    ("MATH", "eng", "Calculus Early Transcendentals", "James Stewart"),
    ("MATH", "eng", "Thomas' Calculus", "George B. Thomas"),
    ("MATH", "eng", "Linear Algebra and Its Applications", "Gilbert Strang"),
    ("MATH", "eng", "A First Course in Probability", "Sheldon Ross"),
    ("MATH", "eng", "Discrete Mathematics and Its Applications", "Kenneth H. Rosen"),
    ("MATH", "eng", "Numerical Analysis", "Richard L. Burden"),
    ("MATH", "eng", "Elementary Differential Equations and Boundary Value Problems", "William E. Boyce"),
    ("MATH", "eng", "A History of Mathematics", "Carl B. Boyer"),
    ("MATH", "eng", "How to Solve It", "George Polya"),
    ("MATH", "eng", "Concrete Mathematics", "Ronald L. Graham"),
    ("MATH", "eng", "Introduction to Linear Optimization", "Dimitris Bertsimas"),
    # ---------------- PHYS ----------------
    ("PHYS", "vie", "Lược sử thời gian", "Stephen Hawking"),
    ("PHYS", "vie", "Bản thiết kế vĩ đại", "Stephen Hawking"),
    ("PHYS", "eng", "University Physics", "Hugh D. Young"),
    ("PHYS", "eng", "Fundamentals of Physics", "David Halliday"),
    ("PHYS", "eng", "Classical Mechanics", "John R. Taylor"),
    ("PHYS", "eng", "Introduction to Electrodynamics", "David J. Griffiths"),
    ("PHYS", "eng", "Introduction to Quantum Mechanics", "David J. Griffiths"),
    ("PHYS", "eng", "Solid State Physics", "Neil W. Ashcroft"),
    ("PHYS", "eng", "The Feynman Lectures on Physics", "Richard P. Feynman"),
    ("PHYS", "eng", "A Brief History of Time", "Stephen Hawking"),
    ("PHYS", "eng", "Cosmos", "Carl Sagan"),
    # ---------------- LIT (Vietnamese editions first) ----------------
    ("LIT", "vie", "Tuổi thơ dữ dội", "Phùng Quán"),
    ("LIT", "vie", "Dế mèn phiêu lưu ký", "Tô Hoài"),
    ("LIT", "vie", "Số đỏ", "Vũ Trọng Phụng"),
    ("LIT", "vie", "Truyện Kiều", "Nguyễn Du"),
    ("LIT", "vie", "Nỗi buồn chiến tranh", "Bảo Ninh"),
    ("LIT", "vie", "Nhật ký Đặng Thùy Trâm", "Đặng Thùy Trâm"),
    ("LIT", "vie", "Mắt biếc", "Nguyễn Nhật Ánh"),
    ("LIT", "vie", "Cho tôi xin một vé đi tuổi thơ", "Nguyễn Nhật Ánh"),
    ("LIT", "vie", "Tôi thấy hoa vàng trên cỏ xanh", "Nguyễn Nhật Ánh"),
    ("LIT", "vie", "Nhà giả kim", "Paulo Coelho"),
    ("LIT", "vie", "Hoàng tử bé", "Saint-Exupéry"),
    ("LIT", "vie", "Rừng Na Uy", "Haruki Murakami"),
    ("LIT", "vie", "Trăm năm cô đơn", "García Márquez"),
    ("LIT", "vie", "Kiêu hãnh và định kiến", "Jane Austen"),
    ("LIT", "vie", "Đồi gió hú", "Emily Brontë"),
    ("LIT", "vie", "Cuốn theo chiều gió", "Margaret Mitchell"),
    ("LIT", "vie", "Bố già", "Mario Puzo"),
    ("LIT", "vie", "Harry Potter và Hòn Đá Phù Thủy", "J. K. Rowling"),
    ("LIT", "vie", "Harry Potter và Tên Tù Nhân Ngục Azkaban", "J. K. Rowling"),
    ("LIT", "vie", "Án mạng trên chuyến tàu tốc hành Phương Đông", "Agatha Christie"),
    ("LIT", "vie", "Mười người da đen nhỏ", "Agatha Christie"),
    ("LIT", "vie", "Bữa sáng ở Tiffany's", "Truman Capote"),
    ("LIT", "vie", "Kẻ trộm sách", "Markus Zusak"),
    ("LIT", "vie", "Kẻ cắp tia chớp", "Rick Riordan"),
    ("LIT", "vie", "Húng nhại", "Suzanne Collins"),
    ("LIT", "vie", "Xa ngoài kia nơi loài tôm hát", "Delia Owens"),
    ("LIT", "vie", "Những thành phố giấy", "John Green"),
    ("LIT", "vie", "Chạng vạng", "Stephenie Meyer"),
    ("LIT", "vie", "Hừng đông", "Stephenie Meyer"),
    ("LIT", "vie", "Di sản thừa kế", "Christopher Paolini"),
    ("LIT", "vie", "Trò chơi vương quyền", "George R. R. Martin"),
    ("LIT", "vie", "Một đời không đủ", "Douglas Kennedy"),
    ("LIT", "vie", "Đợi bọn mọi", "J. M. Coetzee"),
    ("LIT", "vie", "Bức thư tình cuối", "Jojo Moyes"),
    ("LIT", "vie", "Ánh sáng trắng", "Jon Fosse"),
    ("LIT", "vie", "2666", "Roberto Bolaño"),
    ("LIT", "vie", "Lửa và băng", "Erin Hunter"),
    ("LIT", "vie", "Bí mật rừng sâu", "Erin Hunter"),
    ("LIT", "vie", "Animorphs - Người hóa thú #1: Cuộc xâm lược", "Katherine Applegate"),
    ("LIT", "vie", "Hai số phận", "Jeffrey Archer"),
    ("LIT", "vie", "Quê hương tan rã", "Chinua Achebe"),
    ("LIT", "vie", "Momo", "Michael Ende"),
    # Vietnamese literature in published English translation (fallback)
    ("LIT", "eng", "Dumb Luck", "Vũ Trọng Phụng"),
    ("LIT", "eng", "The Sorrow of War", "Bảo Ninh"),
    ("LIT", "eng", "The Tale of Kieu", "Nguyễn Du"),
    ("LIT", "eng", "Last Night I Dreamed of Peace", "Đặng Thùy Trâm"),
    ("LIT", "eng", "The Old Man and the Sea", "Ernest Hemingway"),
    ("LIT", "eng", "To Kill a Mockingbird", "Harper Lee"),
    ("LIT", "eng", "Nineteen Eighty-Four", "George Orwell"),
    # ---------------- ECO ----------------
    ("ECO", "vie", "Steve Jobs", "Walter Isaacson"),
    ("ECO", "vie", "Dấn thân", "Sheryl Sandberg"),
    ("ECO", "vie", "Cuốn sách hoàn hảo về ngôn ngữ cơ thể", "Allan Pease"),
    ("ECO", "vie", "Đắc nhân tâm", "Dale Carnegie"),
    ("ECO", "vie", "Cha giàu cha nghèo", "Robert Kiyosaki"),
    ("ECO", "vie", "Tư duy nhanh và chậm", "Daniel Kahneman"),
    ("ECO", "vie", "Tư duy tối ưu", "Stephen R. Covey"),
    ("ECO", "vie", "Sapiens", "Yuval Noah Harari"),
    ("ECO", "eng", "Principles of Economics", "N. Gregory Mankiw"),
    ("ECO", "eng", "Macroeconomics", "Olivier Blanchard"),
    ("ECO", "eng", "Principles of Marketing", "Philip Kotler"),
    ("ECO", "eng", "Competitive Strategy", "Michael E. Porter"),
    ("ECO", "eng", "Thinking, Fast and Slow", "Daniel Kahneman"),
    ("ECO", "eng", "Rich Dad Poor Dad", "Robert T. Kiyosaki"),
    ("ECO", "eng", "The Intelligent Investor", "Benjamin Graham"),
    ("ECO", "eng", "Good to Great", "Jim Collins"),
    ("ECO", "eng", "Blue Ocean Strategy", "W. Chan Kim"),
    ("ECO", "eng", "The Lean Startup", "Eric Ries"),
    ("ECO", "eng", "The Psychology of Money", "Morgan Housel"),
    ("ECO", "eng", "Freakonomics", "Steven D. Levitt"),
    ("ECO", "eng", "The Wealth of Nations", "Adam Smith"),
    ("ECO", "eng", "Getting to Yes", "Roger Fisher"),
    ("ECO", "eng", "Zero to One", "Peter Thiel"),
    # ---------------- ENG ----------------
    ("ENG", "eng", "English Grammar in Use", "Raymond Murphy"),
    ("ENG", "eng", "Advanced Grammar in Use", "Martin Hewings"),
    ("ENG", "eng", "English Vocabulary in Use", "Stuart Redman"),
    ("ENG", "eng", "English Collocations in Use", "Michael McCarthy"),
    ("ENG", "eng", "Oxford Advanced Learner's Dictionary", "A. S. Hornby"),
    ("ENG", "eng", "Cambridge Grammar of English", "Ronald Carter"),
    ("ENG", "eng", "Word Power Made Easy", "Norman Lewis"),
    ("ENG", "eng", "Practical English Usage", "Michael Swan"),
    ("ENG", "eng", "The Official Cambridge Guide to IELTS", "Pauline Cullen"),
    ("ENG", "eng", "Tuttle Vietnamese-English Dictionary", "Nguyen"),
    ("ENG", "eng", "Academic Writing for Graduate Students", "John M. Swales"),
    ("ENG", "eng", "The Speed Reading Book", "Tony Buzan"),
    ("ENG", "eng", "Grammar for IELTS", "Diana Hopkins"),
    ("ENG", "eng", "Longman Preparation Course for the TOEFL Test", "Deborah Phillips"),
    ("ENG", "eng", "The Elements of Style", "William Strunk"),
]


def norm(text):
    text = unicodedata.normalize("NFD", str(text or "")).replace("đ", "d").replace("Đ", "D")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


STOP = {"the", "a", "an", "and", "of", "in", "to", "for", "its", "va", "cua"}


def title_ok(query, *titles):
    want = [w for w in norm(query).split() if w not in STOP]
    have = set(" ".join(norm(t) for t in titles if t).split())
    return all(w in have for w in want)


def author_ok(query, authors):
    last = norm(query).split()[-1]
    joined = " ".join(norm(a) for a in (authors or []))
    return last in joined.split()


def get_json(url):
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = re.sub(r"[^A-Za-z0-9]+", "_", url)[-180:]
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    for attempt in range(4):
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            time.sleep(0.4)
            return data
        except Exception:
            time.sleep(2 + attempt * 3)
    return None


def get_bytes(url):
    for attempt in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            time.sleep(2 + attempt * 3)
        except Exception:
            time.sleep(2 + attempt * 3)
    return None


def isbn10_to_13(isbn10):
    core = "978" + isbn10[:9]
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(core))
    return core + str((10 - total % 10) % 10)


def isbn13_valid(isbn):
    if not re.fullmatch(r"97[89]\d{10}", isbn):
        return False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(isbn[:12]))
    return (10 - total % 10) % 10 == int(isbn[12])


def edition_isbn13(ed):
    for raw in ed.get("isbn_13", []):
        isbn = re.sub(r"[^0-9X]", "", raw)
        if isbn13_valid(isbn):
            return isbn
    for raw in ed.get("isbn_10", []):
        isbn = re.sub(r"[^0-9X]", "", raw.upper())
        if re.fullmatch(r"\d{9}[\dX]", isbn):
            isbn = isbn10_to_13(isbn)
            if isbn13_valid(isbn):
                return isbn
    return None


def fmt_isbn(isbn):
    return f"{isbn[:3]}-{isbn[3:4]}-{isbn[4:8]}-{isbn[8:12]}-{isbn[12]}"


def find_book(subject, lang, title, author):
    q = urllib.parse.urlencode({
        "title": title, "author": author, "limit": 10,
        "fields": "key,title,author_name,cover_i,number_of_pages_median",
    })
    res = get_json("https://openlibrary.org/search.json?" + q)
    if not res:
        return None
    for work in res.get("docs", []):
        if not author_ok(author, work.get("author_name")):
            continue
        eds = get_json(f"https://openlibrary.org{work['key']}/editions.json?limit=200")
        if not eds:
            continue
        options = []
        for ed in eds.get("entries", []):
            langs = [l.get("key", "").split("/")[-1] for l in ed.get("languages", [])]
            if lang == "vie" and "vie" not in langs:
                continue
            if lang == "eng" and "eng" not in langs:
                continue
            if lang == "eng" and re.search(r"\((\w+) edition\)", ed.get("title", ""), re.I):
                continue
            covers = [c for c in ed.get("covers", []) if c and c > 0]
            isbn = edition_isbn13(ed)
            if not covers or not isbn or not ed.get("publishers"):
                continue
            year = re.findall(r"(1[4-9]\d\d|20\d\d)", ed.get("publish_date", ""))
            if not year:
                continue
            ed_title = ed.get("title", "")
            if not title_ok(title, ed_title, ed.get("subtitle"), work.get("title")):
                continue
            if lang == "vie" and not title_ok(title, ed_title, ed.get("subtitle")):
                continue
            canonical = 1 if work.get("cover_i") in covers else 0
            options.append((canonical, int(year[0]), ed, covers, isbn))
        options.sort(key=lambda o: (o[0], o[1]), reverse=True)
        for canonical, year, ed, covers, isbn in options:
            for cover_id in covers[:2]:
                blob = get_bytes(f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg?default=false")
                if not blob or len(blob) < 6000:
                    continue
                try:
                    img = Image.open(io.BytesIO(blob))
                    w, h = img.size
                except Exception:
                    continue
                if w < 180 or h < 240 or not (1.1 <= h / w <= 1.9):
                    continue
                title_full = ed["title"].strip().rstrip(" =/:")
                if ed.get("subtitle") and lang == "eng":
                    title_full = f"{title_full}: {ed['subtitle'].strip()}"
                return {
                    "subject": subject, "lang": lang, "title": title_full,
                    "author": ", ".join(work.get("author_name", [])[:3]),
                    "publisher": ed["publishers"][0].strip(), "year": year,
                    "isbn": isbn, "pages": ed.get("number_of_pages") or work.get("number_of_pages_median"),
                    "olid": ed["key"].split("/")[-1], "work": work["key"],
                    "cover_id": cover_id, "blob": blob,
                }
    return None


def describe(b):
    cat = CATEGORY[b["subject"]].lower()
    if b["lang"] == "vie":
        return (f"Ấn bản tiếng Việt do {b['publisher']} phát hành năm {b['year']}; "
                f"tài liệu tham khảo nhóm {cat} của thư viện.")
    return (f"Ấn bản gốc do {b['publisher']} phát hành năm {b['year']}; "
            f"giáo trình/tài liệu tham khảo nhóm {cat} của thư viện.")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    picked = {k: [] for k in QUOTA}
    seen_isbn, seen_cover, seen_work = set(), set(), set()
    for subject, lang, title, author in CANDIDATES:
        if len(picked[subject]) >= QUOTA[subject]:
            continue
        book = find_book(subject, lang, title, author)
        if not book or book["isbn"] in seen_isbn or book["cover_id"] in seen_cover or book["work"] in seen_work:
            print(f"  SKIP  [{subject}] {title}")
            continue
        seen_isbn.add(book["isbn"]); seen_cover.add(book["cover_id"]); seen_work.add(book["work"])
        picked[subject].append(book)
        print(f"  OK    [{subject}] {book['title']} | {book['publisher']} {book['year']} | {book['olid']}")

    short = {k: QUOTA[k] - len(v) for k, v in picked.items() if len(v) < QUOTA[k]}
    if short:
        raise SystemExit(f"Not enough verified books: {short}")

    os.makedirs(COVERS_DIR, exist_ok=True)
    for f in os.listdir(COVERS_DIR):
        if re.fullmatch(r"book_\d{3}\.jpg", f):
            os.remove(os.path.join(COVERS_DIR, f))

    records, order = [], ["IT", "MATH", "PHYS", "LIT", "ECO", "ENG"]
    for subject in order:
        for b in picked[subject]:
            i = len(records) + 1
            name = f"book_{i:03d}.jpg"
            Image.open(io.BytesIO(b["blob"])).convert("RGB").save(os.path.join(COVERS_DIR, name), "JPEG", quality=92)
            pages = int(b["pages"]) if b["pages"] else 0
            records.append({
                "id": i, "title": b["title"], "author": b["author"], "publisher": b["publisher"],
                "publication_year": b["year"], "isbn": fmt_isbn(b["isbn"]), "subject_code": subject,
                "category_name": CATEGORY[subject],
                "book_type": "BOTH" if subject in ("IT", "ENG") else "PRINTED",
                "price": max(60000, min(650000, (pages or 300) * 400 // 1000 * 1000)),
                "num_pages": pages or "",
                "cover_image_path": f"/static/covers/{name}",
                "copies_count": (i % 3) + 1,
                "reference_source": (f"Open Library API - edition {b['olid']} "
                                     f"(https://openlibrary.org/books/{b['olid']}); "
                                     f"cover https://covers.openlibrary.org/b/id/{b['cover_id']}-L.jpg"),
                "description": describe(b),
            })

    fields = list(records[0].keys())
    for p in ("data/books_seed.csv", "back_fast_api/data/books_seed.csv"):
        with open(os.path.join(ROOT, p), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(records)
    for p in ("data/books_seed.json", "back_fast_api/data/books_seed.json"):
        with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    mocks = [{
        "id": r["id"], "title": r["title"], "author": r["author"], "publisher": r["publisher"],
        "publication_year": r["publication_year"], "isbn": r["isbn"], "description": r["description"],
        "keywords": f"{r['subject_code']}, {r['category_name']}", "num_pages": r["num_pages"] or None,
        "book_type": r["book_type"], "available_stock": r["copies_count"],
        "cover_image_path": r["cover_image_path"], "category_id": CATEGORY_ID[r["category_name"]],
        "subject_code": r["subject_code"], "reference_source": r["reference_source"],
        "created_at": "2026-10-28T00:00:00Z",
    } for r in records]
    for p in ("mocks/books_mock.json", "back_fast_api/mocks/books_mock.json"):
        with open(os.path.join(ROOT, p), "w", encoding="utf-8") as f:
            json.dump(mocks, f, ensure_ascii=False, indent=2)

    vie = sum(1 for s in order for b in picked[s] if b["lang"] == "vie")
    print(f"DONE: {len(records)} books, {vie} Vietnamese editions")


if __name__ == "__main__":
    main()

