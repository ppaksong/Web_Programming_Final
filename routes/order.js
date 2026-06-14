const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// 주문 처리 완료 파이프라인 (POST /order/confirm)
router.post('/confirm', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('세션이 만료되었습니다.'); location.href='/user/login';</script>");

    const { receiver_name, receiver_phone, delivery_address } = req.body;

    // 🌟 [수정]: 장바구니 데이터를 긁어올 때 고유 회원 번호(user.id)를 기준으로 바인딩합니다.
    db.all(`
        SELECT c.quantity, p.id as product_id, p.name, p.price
        FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
    `, [user.id], (err, items) => {
        if (err || !items || items.length === 0) {
            return res.send("<script>alert('장바구니가 비어 있어 주문 진행이 불가합니다.'); location.href='/products';</script>");
        }

        let total_price = 0;
        items.forEach(i => { total_price += (i.price * i.quantity); });

        // 🌟 [수정]: orders 테이블의 user_id 필드에 고유 식별자인 user.id 번호를 매핑하여 저장합니다.
        db.run(`
            INSERT INTO orders (user_id, total_price, status, receiver_name, receiver_phone, delivery_address)
            VALUES (?, ?, '결제완료', ?, ?, ?)
        `, [user.id, total_price, receiver_name, receiver_phone, delivery_address], function(err2) {
            if (err2) {
                console.error("주문 생성 실패:", err2);
                return res.status(500).send("주문 트랜잭션 수립 실패");
            }

            const orderId = this.lastID;

            // 상세 품목 벌크 이관
            const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
            items.forEach(i => {
                stmt.run(orderId, i.product_id, i.quantity, i.price);
            });
            stmt.finalize();

            // 🌟 [수정]: 결제가 완료되었으므로 로그인한 사용자의 장바구니 항목만 안전하게 비웁니다.
            db.run("DELETE FROM cart_items WHERE user_id = ?", [user.id], (err3) => {
                res.send("<script>alert('🎉 결제 및 주문 확정이 정상적으로 완료되었습니다! 마이페이지로 이동합니다.'); location.href='/mypage';</script>");
            });
        });
    });
});

module.exports = router;