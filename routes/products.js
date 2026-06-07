const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ==========================================
// 🍏 전체 상품 목록 조회 라우트 (고유 ID 전송 보정)
// ==========================================
router.get('/', (req, res) => {
    // 상품 고유 식별자인 id 컬럼이 확실히 포함되도록 테이블 전체 조회 수행
    db.all("SELECT id, name, price, description, emoji, image FROM products", (err, rows) => {
        if (err) {
            console.error("상품 목록 조회 중 DB 에러:", err);
            return res.status(500).send("상품 목록을 불러오는 중 오류가 발생했습니다.");
        }

        // 세션에 로그인된 유저 정보를 함께 템플릿 엔진으로 전달
        res.render('products', {
            products: rows || [],
            user: req.session.user || null
        });
    });
});

module.exports = router;