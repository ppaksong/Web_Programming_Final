const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ====================================================================
// 🛒 장바구니 담기 코어 로직 (파라미터 유실 예외 처리 보강 버전)
// ====================================================================
router.post('/add', (req, res) => {
    const user = req.session.user;

    // 🌟 보정 정책: 프론트엔드 양식에 따라 productId 혹은 product_id 둘 중 어떤 형식으로 들어와도 모두 수용합니다.
    const productId = req.body.productId || req.body.product_id;

    if (!user) {
        return res.send("<script>alert('장바구니를 이용하시려면 로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    // 🚨 [핵심 보안] 상품 ID가 비어있거나 올바르지 않은 경우 데이터베이스 조회를 차단하고 안전하게 튕겨냅니다.
    if (!productId || productId === 'undefined' || productId === '') {
        console.error("❌ [SYSTEM ERROR] 장바구니 담기 실패: 전송된 상품 ID(productId)가 누락되었습니다.");
        return res.send("<script>alert('⚠️ 상품 정보가 올바르지 않습니다. 새로고침 후 다시 시도해주세요.'); history.back();</script>");
    }

    // UNIQUE 제약조건 충족 시 수량만 증가시키는 스마트 인서트 업서트(Upsert) 쿼리
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
    if (!user) return res.send("<script>alert('로그인이 필요한 서비스입니다.'); location.href='/user/login';</script>");

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
    if (!req.session.user) return res.redirect('/user/login');
    const userId = req.session.user.id;
    const { productId, action } = req.body;

    db.get(`SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], (err, row) => {
        if (!row) return res.redirect('/cart');

        let newQuantity = row.quantity;
        if (action === 'increase') newQuantity += 1;
        else if (action === 'decrease') newQuantity -= 1;

        if (newQuantity <= 0) {
            db.run(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`, [userId, productId], () => res.redirect('/cart'));
        } else {
            db.run(`UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`, [newQuantity, userId, productId], () => res.redirect('/cart'));
        }
    });
});

// ====================================================================
// 💳 결제 및 주문 확정 (주문 내역 DB 저장 및 장바구니 비우기)
// ====================================================================
router.post('/order', (req, res) => {
    const user = req.session.user;

    // 1. 로그인 여부 확인
    if (!user) {
        return res.send("<script>alert('로그인이 필요한 서비스입니다.'); location.href='/user/login';</script>");
    }

    const userId = user.id;

    // 🌟 팁: cart.ejs의 input name 설정값(delivery_address)과 정확히 일치시킵니다.
    const { receiver_name, receiver_phone, delivery_address } = req.body;

    // 2. 현재 사용자의 장바구니 상품 목록과 각 상품의 가격(price)을 함께 조회합니다.
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

        // 장바구니가 진짜로 비어있다면 진행을 차단합니다.
        if (!cartItems || cartItems.length === 0) {
            return res.send("<script>alert('장바구니가 비어 있습니다.'); location.href='/products';</script>");
        }

        // 3. SQLite의 serialize를 사용하여 주문 데이터 저장을 대기열에 넣어 안전하게 순차 진행합니다.
        db.serialize(() => {
            // 마이페이지(index.js) 구조에 맞춘 주문 테이블(orders) 삽입 쿼리
            const insertOrderQuery = `
                INSERT INTO orders (user_id, product_id, quantity, total_price, receiver_name, receiver_phone, delivery_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const stmt = db.prepare(insertOrderQuery);

            // 장바구니에 든 상품 개수만큼 반복하며 orders 테이블에 각각 기록 생성
            cartItems.forEach(item => {
                const totalPrice = item.price * item.quantity;
                stmt.run(userId, item.product_id, item.quantity, totalPrice, receiver_name, receiver_phone, delivery_address);
            });

            stmt.finalize(); // 쿼리 실행 확정 및 종료

            // 4. 주문 내역 저장이 완벽히 끝났으므로, 해당 유저의 장바구니(cart_items)를 깨끗하게 비웁니다.
            db.run(`DELETE FROM cart_items WHERE user_id = ?`, [userId], (err) => {
                if (err) {
                    console.error("❌ 결제 후 장바구니 비우기 실패:", err);
                    return res.send("<script>alert('장바구니 비우기 중 오류가 발생했습니다.'); history.back();</script>");
                }

                // 5. 성공 팝업을 띄우고 주문 내역을 바로 확인할 수 있게 마이페이지로 이동시킵니다!
                res.send(`
                    <script>
                        alert('🎉 주문 및 결제가 성공적으로 완료되었습니다!\\n마이페이지에서 주문 내역을 확인해보세요.');
                        location.href = '/mypage';
                    </script>
                `);
            });
        });
    });
});

module.exports = router;