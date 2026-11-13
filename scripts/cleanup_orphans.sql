-- ============================================================================
-- SCRIPT: cleanup_orphans.sql
-- SPRINT 4 (Task 4-24): Don dep va kiem tra ban ghi mo coi (orphan records) trong PostgreSQL
-- He thong Thu vien So Thong minh (University Digital Library)
-- ============================================================================
-- Cac loai ban ghi mo coi duoc xu ly:
--   1. Ban sao khong co dau sach: book_copies khong ton tai trong books
--   2. Khoan muon khong co nguoi dung: loans khong ton tai trong users
--   3. Giao dich vi khong co tai khoan: wallet_txns khong ton tai trong users/accounts
--   4. Phieu phat khong co khoan muon: fines khong ton tai trong loans
-- ============================================================================

-- 1. Tao bang ghi log lich su don dep ban ghi mo coi (neu chua co)
CREATE TABLE IF NOT EXISTS orphan_cleanup_audit_log (
    id SERIAL PRIMARY KEY,
    cleaned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    target_table VARCHAR(100) NOT NULL,
    orphan_type VARCHAR(150) NOT NULL,
    records_detected INT NOT NULL,
    records_cleaned INT NOT NULL,
    action_taken VARCHAR(50) NOT NULL,
    details TEXT
);

-- 2. Transaction kiem tra, ghi log va don dep du lieu mo coi
DO $$
DECLARE
    v_copies_count INT := 0;
    v_loans_count INT := 0;
    v_wallet_txns_count INT := 0;
    v_fines_count INT := 0;
    v_now TIMESTAMP := CURRENT_TIMESTAMP;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'BAT DAU QUY TRINH QUET VA DON DEP BAN GHI MO COI (POSTGRESQL)';
    RAISE NOTICE 'Thoi diem thuc thi: %', v_now;
    RAISE NOTICE '============================================================';

    -- ------------------------------------------------------------------------
    -- BƯỚC 1: Bản sao không có đầu sách (book_copies without books)
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_copies_count
    FROM book_copies bc
    LEFT JOIN books b ON bc.book_id = b.id
    WHERE b.id IS NULL;

    IF v_copies_count > 0 THEN
        RAISE NOTICE '[PHÁT HIỆN] Co % ban sao (book_copies) mo coi khong co dau sach tuong ung.', v_copies_count;
        
        DELETE FROM book_copies
        WHERE book_id NOT IN (SELECT id FROM books);

        INSERT INTO orphan_cleanup_audit_log (cleaned_at, target_table, orphan_type, records_detected, records_cleaned, action_taken, details)
        VALUES (v_now, 'book_copies', 'Copies without valid book_id in books', v_copies_count, v_copies_count, 'DELETED', 'Da xoa cac ban sao khong co dau sach');
        
        RAISE NOTICE '[DA XU LY] Da xoa % ban sao mo coi.', v_copies_count;
    ELSE
        RAISE NOTICE '[HOAN HAO] 0 ban sao mo coi (tat ca book_copies deu thuoc dau sach hop le).';
    END IF;

    -- ------------------------------------------------------------------------
    -- BƯỚC 2: Phiếu phạt không có khoản mượn (fines without loans)
    -- Xử lý trước khi xóa loans để tránh lỗi ràng buộc tham chiếu
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_fines_count
    FROM fines f
    LEFT JOIN loans l ON f.loan_id = l.id
    WHERE l.id IS NULL;

    IF v_fines_count > 0 THEN
        RAISE NOTICE '[PHÁT HIỆN] Co % phieu phat (fines) mo coi khong co phieu muon.', v_fines_count;

        DELETE FROM fines
        WHERE loan_id NOT IN (SELECT id FROM loans);

        INSERT INTO orphan_cleanup_audit_log (cleaned_at, target_table, orphan_type, records_detected, records_cleaned, action_taken, details)
        VALUES (v_now, 'fines', 'Fines without valid loan_id in loans', v_fines_count, v_fines_count, 'DELETED', 'Da xoa cac phieu phat khong co phieu muon');

        RAISE NOTICE '[DA XU LY] Da xoa % phieu phat mo coi.', v_fines_count;
    ELSE
        RAISE NOTICE '[HOAN HAO] 0 phieu phat mo coi (tat ca fines deu gan voi loans hop le).';
    END IF;

    -- ------------------------------------------------------------------------
    -- BƯỚC 3: Khoản mượn không có người dùng (loans without users)
    -- Trước khi xóa loans mồ côi, dọn các phụ thuộc (fines, incidents) liên quan nếu có
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_loans_count
    FROM loans l
    LEFT JOIN users u ON l.user_code = u.user_code
    WHERE u.user_code IS NULL;

    IF v_loans_count > 0 THEN
        RAISE NOTICE '[PHÁT HIỆN] Co % khoan muon (loans) mo coi khong co nguoi dung.', v_loans_count;

        -- Dọn các fines và incidents bám theo loans mồ côi này
        DELETE FROM fines WHERE loan_id IN (
            SELECT id FROM loans WHERE user_code NOT IN (SELECT user_code FROM users)
        );
        DELETE FROM incidents WHERE loan_id IN (
            SELECT id FROM loans WHERE user_code NOT IN (SELECT user_code FROM users)
        );

        -- Xóa loans mồ côi
        DELETE FROM loans
        WHERE user_code NOT IN (SELECT user_code FROM users);

        INSERT INTO orphan_cleanup_audit_log (cleaned_at, target_table, orphan_type, records_detected, records_cleaned, action_taken, details)
        VALUES (v_now, 'loans', 'Loans without valid user_code in users', v_loans_count, v_loans_count, 'DELETED', 'Da xoa cac khoan muon khong co nguoi dung va cac phat sinh lien quan');

        RAISE NOTICE '[DA XU LY] Da xoa % khoan muon mo coi.', v_loans_count;
    ELSE
        RAISE NOTICE '[HOAN HAO] 0 khoan muon mo coi (tat ca loans deu co user hop le).';
    END IF;

    -- ------------------------------------------------------------------------
    -- BƯỚC 4: Giao dịch ví không có tài khoản / người dùng (wallet_txns without users)
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_wallet_txns_count
    FROM wallet_txns wt
    LEFT JOIN users u ON wt.user_code = u.user_code
    WHERE u.user_code IS NULL;

    IF v_wallet_txns_count > 0 THEN
        RAISE NOTICE '[PHÁT HIỆN] Co % giao dich vi (wallet_txns) mo coi khong co nguoi dung.', v_wallet_txns_count;

        DELETE FROM wallet_txns
        WHERE user_code NOT IN (SELECT user_code FROM users);

        INSERT INTO orphan_cleanup_audit_log (cleaned_at, target_table, orphan_type, records_detected, records_cleaned, action_taken, details)
        VALUES (v_now, 'wallet_txns', 'Wallet transactions without valid user_code in users', v_wallet_txns_count, v_wallet_txns_count, 'DELETED', 'Da xoa cac giao dich vi mo coi');

        RAISE NOTICE '[DA XU LY] Da xoa % giao dich vi mo coi.', v_wallet_txns_count;
    ELSE
        RAISE NOTICE '[HOAN HAO] 0 giao dich vi mo coi (tat ca wallet_txns deu thuoc nguoi dung hop le).';
    END IF;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'HOAN TAT DON DEP DU LIEU MO COI THANH CONG.';
    RAISE NOTICE 'Tong hop ket qua:';
    RAISE NOTICE '  - Ban sao mo coi:      % dong', v_copies_count;
    RAISE NOTICE '  - Phieu phat mo coi:    % dong', v_fines_count;
    RAISE NOTICE '  - Khoan muon mo coi:   % dong', v_loans_count;
    RAISE NOTICE '  - Giao dich vi mo coi:  % dong', v_wallet_txns_count;
    RAISE NOTICE '============================================================';
END $$;

-- 3. Truy van kiem tra lai ket qua sau khi don dep
SELECT 'book_copies' AS table_name, COUNT(*) AS remaining_orphans
FROM book_copies bc LEFT JOIN books b ON bc.book_id = b.id WHERE b.id IS NULL
UNION ALL
SELECT 'loans' AS table_name, COUNT(*) AS remaining_orphans
FROM loans l LEFT JOIN users u ON l.user_code = u.user_code WHERE u.user_code IS NULL
UNION ALL
SELECT 'wallet_txns' AS table_name, COUNT(*) AS remaining_orphans
FROM wallet_txns wt LEFT JOIN users u ON wt.user_code = u.user_code WHERE u.user_code IS NULL
UNION ALL
SELECT 'fines' AS table_name, COUNT(*) AS remaining_orphans
FROM fines f LEFT JOIN loans l ON f.loan_id = l.id WHERE l.id IS NULL;

-- 4. Xem nhat ky kiem toan cac dot don dep
SELECT * FROM orphan_cleanup_audit_log ORDER BY id DESC LIMIT 10;

