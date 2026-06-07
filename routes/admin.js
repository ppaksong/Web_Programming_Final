const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// 👑 1단계: 최고 권한 관리자 세션 체크 미들웨어
router.use((req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.send("<script>alert('👑 최고 권한 관리자만 접근 가능합니다.'); location.href='/';</script>");
    }
});

// 📊 2단계: 관리자 대시보드 메인 조회 (상품, 주문, 회원 목록 통합 로드)
router.get('/', (req, res) => {
    db.all("SELECT * FROM products", (err1, products) => {
        db.all("SELECT * FROM orders ORDER BY id DESC", (err2, orders) => {
            db.all("SELECT id, username, name, role, status FROM users", (err3, users) => {
                res.render('admin_dashboard', {
                    products: products || [],
                    orders: orders || [],
                    users: users || [],
                    user: req.session.user
                });
            });
        });
    });
});

// 📢 [🎯 최종 스키마 매칭 완벽 보정] 독자적 공지사항 등록 엔진
router.post('/notice/add', (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.send("<script>alert('공지사항 제목과 내용을 모두 입력해 주세요.'); history.back();</script>");
    }

    // 현재 날짜 가공 (YYYY-MM-DD HH:MM:SS 포맷)
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);

    // 🌟 [핵심 해결]: 실제 존재하는 'author'와 'created_at' 컬럼으로 안전하게 쿼리 매핑
    const query = `
        INSERT INTO posts (title, content, author, created_at)
        VALUES (?, ?, 'admin', ?)
    `;

    db.run(query, [title, content, formattedDate], function (err) {
        if (err) {
            console.error("📢 독자 공지사항 등록 실패:", err);
            return res.send("<script>alert('공지사항 저장 중 오류가 발생했습니다.'); history.back();</script>");
        }
        res.send("<script>alert('📢 중요 전역 공지사항이 성공적으로 게시되었습니다!'); location.href='/admin';</script>");
    });
});

// 👥 회원 정보/권한/상태 수정 엔진
router.post('/user/update', (req, res) => {
    const { username, role, status } = req.body;

    db.run("UPDATE users SET role = ?, status = ? WHERE username = ?", [role, status, username], (err) => {
        if (err) {
            console.error("회원 상태 변경 트랜잭션 에러:", err);
            return res.status(500).send("데이터베이스 상태 반영 실패");
        }
        res.send("<script>alert('👤 회원 등급 및 계정 제어 권한 설정이 저장되었습니다.'); location.href='/admin';</script>");
    });
});

// ❌ 회원 정보 완전 삭제 엔진
router.post('/user/delete', (req, res) => {
    const { username } = req.body;

    if (username === 'admin') {
        return res.send("<script>alert('⛔ 최고 마스터 관리자 계정은 시스템 유지보수를 위해 삭제할 수 없습니다.'); location.href='/admin';</script>");
    }

    db.run("DELETE FROM users WHERE username = ?", [username], (err) => {
        if (err) {
            console.error("회원 데이터 물리 삭제 실패:", err);
            return res.status(500).send("회원 삭제 중 오류가 발생했습니다.");
        }
        res.send("<script>alert('🗑️ 해당 회원 정보가 데이터베이스에서 영구 삭제되었습니다.'); location.href='/admin';</script>");
    });
});

// ➕ 신규 과일 상품 등록 엔진
router.post('/product/add', (req, res) => {
    const { name, price, description, emoji, image } = req.body;
    db.run("INSERT INTO products (name, price, description, emoji, image) VALUES (?, ?, ?, ?, ?)",
        [name, price, description, emoji || '🍎', image || 'default.jpg'], (err) => {
            if (err) console.error(err);
            res.send("<script>alert('✅ 상품이 정상 등록되었습니다.'); location.href='/admin';</script>");
        });
});

// 🚚 주문 배송 상태 변경 엔진
router.post('/order/status', (req, res) => {
    const { order_id, status } = req.body;
    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, order_id], (err) => {
        if (err) console.error(err);
        res.send("<script>alert('🚚 주문 배송 처리 상태가 변경되었습니다.'); location.href='/admin';</script>");
    });
});

module.exports = router;