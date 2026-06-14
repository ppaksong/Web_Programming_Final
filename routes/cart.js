const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ====================================================================
// 🛒 장바구니 담기 코어 로직
// ====================================================================
router.post('/add', (req, res) => {
    const user = req.session.user;
    const productId = req.body.productId || req.body.product_id;

    if (!user) {
        // 🌟 [교정]: 로그인 튕김 주소 보정
        return res.send("<script>alert('장바구니를 이용하시려면 로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    if (!productId || productId === 'undefined' || productId === '') {
        console.error("❌ [SYSTEM ERROR] 장바구니 담기 실패: 상품 ID 누락");
        return res.send("<script>alert('⚠️ 상품 정보가 올바르지 않습니다. 새로고침 후 다시 시도해주세요.'); history.back();</script>");
    }

    const query = `
        INSERT INTO cart_items (user_id, product_id, quantity)
        VALUES (?, ?, 1)
            ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + 1
    `;

    db.run(query, [user.id, productId], function (err) {
        if (err) {
            console.error("❌ 장바구니 DB 반영 실패 로그:", err);
            return res.send("<script>alert('❌ 장바구니 담기 처리에 실패했습니다.'); history.back();</script>");
        }
        res.send("<script>alert('🛒 상품이 장바구니에 성공적으로 담겼습니다!'); history.back();</script>");
    });
});

// ====================================================================
// 📋 장바구니 메인 조회 라우트
// ====================================================================
router.get('/', (req, res) => {
    const user = req.session.user;
    // 🌟 [교정]: 로그인 유도 주소 보정
    if (!user) return res.send("<script>alert('로그인이 필요한 서비스입니다.'); location.href='/stud7/user/login';</script>");

    const query = `
        SELECT p.id, p.name, p.price, p.emoji, p.image, c.quantity
        FROM cart_items c
                 JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?`;

    db.all(query, [user.id], (err, rows) => {
        if (err) return res.status(500).send('장바구니 로딩 데이터 실패');
        res.render('cart', { cartItems: rows, user });
    });
});

// ====================================================================
// 🔢 수량 실시간 업데이트 엔진
// ====================================================================
router.post('/update', (req, res) => {
    // 🌟 [교정]: 로그인 만료 세션 리다이렉트 보정
    if (!req.session.user) return res.redirect('/stud7/user/login');
    const userId = req.session.user.id;
    const { productId, action } = req.body;

    db.get(`SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], (err, row) => {
        // 🌟 [교정]: 예외 발생 시 리다이렉트 보정
        if (!row) return res.redirect('/stud7/cart');

        let newQuantity = row.quantity;
        if (action === 'increase') newQuantity += 1;
        else if (action === 'decrease') newQuantity -= 1;

        // 🌟 [교정]: 내부 데이터 갱신 후 리다이렉트 경로 전면 보정
        if (newQuantity <= 0) {
            db.run(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], () => res.redirect('/stud7/cart'));
        } else {
            db.run(`UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`, [newQuantity, userId, productId], () => res.redirect('/stud7/cart'));
        }
    });
});

// ====================================================================
// 💳 결제 및 주문 확정
// ====================================================================
router.post('/order', (req, res) => {
    const user = req.session.user;

    // 🌟 [교정]: 주문 시 로그인 체크 주소 보정
    if (!user) {
        return res.send("<script>alert('로그인이 필요한 서비스입니다.'); location.href='/stud7/user/login';</script>");
    }

    const userId = user.id;
    const { receiver_name, receiver_phone, delivery_address } = req.body;

    const selectCartQuery = `
        SELECT ci.*, p.price
        FROM cart_items ci
                 JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    `;

    db.all(selectCartQuery, [userId], (err, cartItems) => {
        if (err) {
            console.error("❌ 장바구니 조회 실패:", err);
            return res.send("<script>alert('주문 처리 중 오류가 발생했습니다.'); history.back();</script>");
        }

        // 🌟 [교정]: 빈 장바구니일 때 전체 상품 화면 유도 경로 보정
        if (!cartItems || cartItems.length === 0) {
            return res.send("<script>alert('장바구니가 비어 있습니다.'); location.href='/stud7/products';</script>");
        }

        db.serialize(() => {
            const insertOrderQuery = `
                INSERT INTO orders (user_id, product_id, quantity, total_price, receiver_name, receiver_phone, delivery_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const stmt = db.prepare(insertOrderQuery);

            cartItems.forEach(item => {
                const totalPrice = item.price * item.quantity;
                stmt.run(userId, item.product_id, item.quantity, totalPrice, receiver_name, receiver_phone, delivery_address);
            });

            stmt.finalize();

            db.run(`DELETE FROM cart_items WHERE user_id = ?`, [userId], (err) => {
                if (err) {
                    console.error("❌ 결제 후 장바구니 비우기 실패:", err);
                    return res.send("<script>alert('장바구니 비우기 중 오류가 발생했습니다.'); history.back();</script>");
                }

                // 🌟 [교정 핵심]: 주문 성공 팝업 후 마이페이지로 복귀 주소 고정
                res.send(`
                    <script>
                        alert('🎉 주문 및 결제가 성공적으로 완료되었습니다!\\n마이페이지에서 주문 내역을 확인해보세요.');
                        location.href = '/stud7/mypage';
                    </script>
                `);
            });
        });
    });
});

module.exports = router;