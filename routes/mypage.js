const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// ====================================================================
// 📋 [조회] 마이페이지 대시보드 종합 데이터 바인딩
// ====================================================================
router.get('/', (req, res) => {
    const user = req.session.user;
    // 🌟 [교정]: 로그인 튕길 때 배포 고정 경로로 안전하게 리다이렉트
    if (!user) return res.send("<script>alert('로그인 세션이 존재하지 않습니다.'); location.href='/stud7/user/login';</script>");

    db.get("SELECT * FROM users WHERE id = ?", [user.id], (err1, userInfo) => {
        if (err1 || !userInfo) {
            console.error("마이페이지 유저 조회 실패:", err1);
            return res.send("<script>alert('회원 정보를 불러오지 못했습니다.'); history.back();</script>");
        }

        db.all(`
            SELECT w.id as wish_id, p.* FROM wishlist w
                                                 JOIN products p ON w.product_id = p.id WHERE w.user_id = ?
        `, [user.id], (err2, wishItems) => {
            if (err2) console.error("위시리스트 조회 에러:", err2);

            db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [user.id], (err3, orders) => {
                if (err3) console.error("주문내역 조회 에러:", err3);

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
// 💾 회원 정보 수정 트랜잭션 파이프라인 (🚨 오류 발생했던 부분)
// ====================================================================
router.post('/update', (req, res) => {
    const user = req.session.user;
    // 🌟 [교정]: 세션 만료 시 로그인 경로 보정
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/stud7/user/login';</script>");

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
        // 🌟 [교정 핵심]: 수정 성공 완료 후 주소에서 /stud7이 유실되지 않도록 꽉 묶어줍니다.
        res.send("<script>alert('👤 회원 정보가 성공적으로 변경되었습니다!'); location.href='/stud7/mypage';</script>");
    });
});

// ====================================================================
// ❌ [주문 취소] 처리 파이프라인
// ====================================================================
router.post('/order/cancel', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/stud7/user/login';</script>");

    const { order_id } = req.body;

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

        if (this.changes === 0) {
            return res.send("<script>alert('취소 가능한 상태가 아니거나 취소 권한이 없습니다.'); history.back();</script>");
        }

        // 🌟 [교정]: 취소 처리 완료 후 리다이렉트 주소 보정
        res.send("<script>alert('선택하신 주문의 취소 처리가 완료되었습니다.'); location.href='/stud7/mypage';</script>");
    });
});

// ====================================================================
// 🚛 [반품 신청] 처리 파이프라인
// ====================================================================
router.post('/order/return', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인이 만료되었습니다.'); location.href='/stud7/user/login';</script>");

    const { order_id } = req.body;

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

        if (this.changes === 0) {
            return res.send("<script>alert('반품 신청이 가능한 상태가 아니거나 권한이 없습니다.'); history.back();</script>");
        }

        // 🌟 [교정]: 반품 처리 완료 후 리다이렉트 주소 보정
        res.send("<script>alert('반품 신청서가 정상 접수되었습니다. 수거 진행을 도와드리겠습니다.'); location.href='/stud7/mypage';</script>");
    });
});

// ====================================================================
// ❤️ 관심 상품 추가/해제 제어
// ====================================================================
router.post('/wish/add', (req, res) => {
    const user = req.session.user;
    if (!user) return res.send("<script>alert('로그인 후 이용할 수 있는 기능입니다.'); location.href='/stud7/user/login';</script>");
    const { product_id } = req.body;

    db.run("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)", [user.id, product_id], (err) => {
        res.send("<script>alert('❤️ 관심 상품 위시리스트에 등록되었습니다.'); history.back();</script>");
    });
});

router.post('/wish/delete', (req, res) => {
    const { wish_id } = req.body;
    // 🌟 [교정]: 관심상품 삭제 후 복귀 주소 고정 처리
    db.run("DELETE FROM wishlist WHERE id = ?", [wish_id], () => res.redirect('/stud7/mypage'));
});

module.exports = router;