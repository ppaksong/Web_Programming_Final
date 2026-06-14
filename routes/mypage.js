const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ====================================================================
// 📋 [조회] 마이페이지 대시보드 종합 데이터 바인딩
// ====================================================================
router.get('/', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인 세션이 존재하지 않습니다.'); location.href='/user/login';</script>");

    // 세션에 기록된 고유 식별자인 id 필드로 안전하게 회원 테이블 전체 정보를 매칭합니다.
    db.get("SELECT * FROM users WHERE id = ?", [user.id], (err1, userInfo) => {
        if (err1 || !userInfo) {
            console.error("마이페이지 유저 조회 실패:", err1);
            return res.send("<script>alert('회원 정보를 불러오지 못했습니다.'); history.back();</script>");
        }

        // 고유 회원 번호(user.id)로 내 관심상품만 정확하게 조회합니다.
        db.all(`
            SELECT w.id as wish_id, p.* FROM wishlist w
                                                 JOIN products p ON w.product_id = p.id WHERE w.user_id = ?
        `, [user.id], (err2, wishItems) => {
            if (err2) console.error("위시리스트 조회 에러:", err2);

            // 고유 회원 번호(user.id)로 "내 주문 내역"만 최신순으로 정렬하여 필터링합니다.
            db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [user.id], (err3, orders) => {
                if (err3) console.error("주문내역 조회 에러:", err3);

                // 프론트엔드 EJS 템플릿과 변수명을 일치시켜 렌더링합니다.
                res.render('mypage', {
                    userInfo: userInfo,
                    wishItems: wishItems || [],
                    orders: orders || []
                });
            });
        });
    });
});

// ====================================================================
// 💾 회원 정보 수정 트랜잭션 파이프라인
// ====================================================================
router.post('/update', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/user/login';</script>");

    const { name, phone, address } = req.body;

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

        req.session.user.name = name;
        res.send("<script>alert('👤 회원 정보가 성공적으로 변경되었습니다!'); location.href='/mypage';</script>");
    });
});

// ====================================================================
// ❌ [주문 취소] 처리 파이프라인 (보안 검증 강화)
// ====================================================================
router.post('/order/cancel', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/user/login';</script>");

    const { order_id } = req.body;

    // 🔒 [보안 핵심]: 해당 주문번호(id)가 맞더라도 '로그인한 본인의 주문(user_id)'이 아니면 수정되지 않도록 방어합니다.
    const cancelQuery = `
        UPDATE orders
        SET status = '주문취소'
        WHERE id = ? AND user_id = ? AND status = '결제완료'
    `;

    db.run(cancelQuery, [order_id, user.id], function (err) {
        if (err) {
            console.error("주문 취소 DB 오류:", err);
            return res.send("<script>alert('서버 오류로 인해 취소 처리에 실패했습니다.'); history.back();</script>");
        }

        // 조건에 맞아 실제로 변경된 행(Row)이 없는 경우 (남의 주문번호를 찔렀거나 이미 상태가 바뀐 경우)
        if (this.changes === 0) {
            return res.send("<script>alert('취소 가능한 상태가 아니거나 취소 권한이 없습니다.'); history.back();</script>");
        }

        res.send("<script>alert('선택하신 주문의 취소 처리가 완료되었습니다.'); location.href='/mypage';</script>");
    });
});

// ====================================================================
// 🚛 [반품 신청] 처리 파이프라인 (신규 구현 및 검증 강화)
// ====================================================================
router.post('/order/return', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/user/login';</script>");

    const { order_id } = req.body;

    // 🔒 [보안 핵심]: 배송완료 단계의 주문이면서 동시에 현재 새션 유저의 데이터가 맞는지 철저히 체크합니다.
    const returnQuery = `
        UPDATE orders
        SET status = '반품신청'
        WHERE id = ? AND user_id = ? AND status = '배송완료'
    `;

    db.run(returnQuery, [order_id, user.id], function (err) {
        if (err) {
            console.error("반품 신청 DB 오류:", err);
            return res.send("<script>alert('서버 오류로 인해 반품 신청에 실패했습니다.'); history.back();</script>");
        }

        // 정상 유효성 검증 실패 시 예외 처리
        if (this.changes === 0) {
            return res.send("<script>alert('반품 신청이 가능한 상태가 아니거나 권한이 없습니다.'); history.back();</script>");
        }

        res.send("<script>alert('반품 신청서가 정상 접수되었습니다. 수거 진행을 도와드리겠습니다.'); location.href='/mypage';</script>");
    });
});

// ====================================================================
// ❤️ 관심 상품 추가/해제 제어
// ====================================================================
router.post('/wish/add', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인 후 이용할 수 있는 기능입니다.'); location.href='/user/login';</script>");
    const { product_id } = req.body;

    db.run("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)", [user.id, product_id], (err) => {
        res.send("<script>alert('❤️ 관심 상품 위시리스트에 등록되었습니다.'); history.back();</script>");
    });
});

router.post('/wish/delete', (req, res) => {
    const { wish_id } = req.body;
    db.run("DELETE FROM wishlist WHERE id = ?", [wish_id], () => res.redirect('/mypage'));
});

module.exports = router;