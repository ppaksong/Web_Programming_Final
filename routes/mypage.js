const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ====================================================================
// 📋 [조회] 마이페이지 허브 종합 조회 데이터 바인딩
// ====================================================================
router.get('/', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인 세션이 존재하지 않습니다.'); location.href='/user/login';</script>");

    // 🌟 세션에 기록된 고유 식별자인 id 필드로 안전하게 회원 테이블 전체 정보를 매칭합니다.
    db.get("SELECT * FROM users WHERE id = ?", [user.id], (err1, userInfo) => {
        if (err1 || !userInfo) {
            console.error("마이페이지 유저 조회 실패:", err1);
            return res.send("<script>alert('회원 정보를 불러오지 못했습니다.'); history.back();</script>");
        }

        // 2. 관심 상품 목록(위시리스트) 바인딩
        db.all(`
            SELECT w.id as wish_id, p.* FROM wishlist w
            JOIN products p ON w.product_id = p.id WHERE w.user_id = ?
        `, [user.username], (err2, wishItems) => {
            if (err2) console.error("위시리스트 조회 에러:", err2);

            // 3. 주문 내역 연동
            db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [user.username], (err3, orders) => {
                if (err3) console.error("주문내역 조회 에러:", err3);

                // userInfo, wishItems, orders 데이터를 템플릿에 주입합니다.
                res.render('mypage', {
                    user: userInfo, // 🌟 DB의 최신 확장 스키마 데이터전송 (phone, address 포함)
                    wishItems: wishItems || [],
                    orders: orders || []
                });
            });
        });
    });
});

// ====================================================================
// 💾 [🔥신설: 수정 완료] 일반 회원 정보 수정 트랜잭션 파이프라인
// ====================================================================
router.post('/update', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/user/login';</script>");

    const { name, phone, address } = req.body;

    // 1. 데이터베이스 회원 테이블 갱신 쿼리 실행
    const updateQuery = `
        UPDATE users 
        SET name = ?, phone = ?, address = ? 
        WHERE id = ?
    `;

    db.run(updateQuery, [name, phone, address, user.id], function (err) {
        if (err) {
            console.error("회원 정보 수정 중 DB 오류 발생:", err);
            return res.send("<script>alert('❌ 회원 정보 수정 처리에 실패했습니다.'); history.back();</script>");
        }

        // 2. 🌟 [핵심] 수정 성공 시 동기화를 위해 현재 세션 정보의 유저 닉네임/성명 등도 업데이트합니다.
        req.session.user.name = name;

        res.send("<script>alert('👤 회원 정보가 성공적으로 변경되었습니다!'); location.href='/mypage';</script>");
    });
});

// ====================================================================
// ❤️ 관심 상품 추가/해제 및 주문 제어 액션들
// ====================================================================
router.post('/wish/add', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인 후 이용할 수 있는 기능입니다.'); location.href='/user/login';</script>");
    const { product_id } = req.body;

    db.run("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)", [user.username, product_id], (err) => {
        res.send("<script>alert('❤️ 관심 상품 위시리스트에 등록되었습니다.'); history.back();</script>");
    });
});

router.post('/wish/delete', (req, res) => {
    const { wish_id } = req.body;
    db.run("DELETE FROM wishlist WHERE id = ?", [wish_id], () => res.redirect('/mypage'));
});

router.post('/order/cancel', (req, res) => {
    const { order_id } = req.body;
    db.run("UPDATE orders SET status = '주문취소' WHERE id = ? AND status = '결제완료'", [order_id], (err) => {
        res.send("<script>alert('선택하신 주문의 취소 처리가 완료되었습니다.'); location.href='/mypage';</script>");
    });
});

router.post('/order/return', (req, res) => {
    const { order_id } = req.body;
    db.run("UPDATE orders SET status = '반품신청' WHERE id = ? AND status = '배송완료'", [order_id], (err) => {
        res.send("<script>alert('반품 신청서가 정상 접수되었습니다.'); location.href='/mypage';</script>");
    });
});

module.exports = router;