const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// [로그인 페이지 이동] GET: /user/login
router.get('/login', (req, res) => {
    res.render('login');
});

// [🔐 로그인 코어 핵심 엔진] POST: /user/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 👑 1. 최고 관리자 전용 마스터 치트키 로그인 처리
    if (username === 'admin' && password === 'admin') {
        db.get("SELECT * FROM users WHERE username = 'admin'", (err, adminRow) => {
            if (adminRow) {
                req.session.user = {
                    id: adminRow.id,
                    username: adminRow.username,
                    name: adminRow.name || '최고관리자',
                    role: 'admin',
                    status: adminRow.status || 'active'
                };
            } else {
                req.session.user = {
                    id: 1,
                    username: 'admin',
                    name: '최고관리자',
                    role: 'admin',
                    status: 'active'
                };
            }

            req.session.save((err) => {
                if (err) console.error(err);
                return res.send("<script>alert('👑 최고 관리자 계정으로 로그인이 완료되었습니다. 👑'); location.href='../../';</script>");
            });
        });
        return;
    }

    // 👤 2. 일반 유저 로그인 처리
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) {
            console.error("로그인 DB 에러:", err);
            return res.send("<script>alert('데이터베이스 조회 오류가 발생했습니다.'); history.back();</script>");
        }

        if (!row) {
            return res.send("<script>alert('아이디 또는 비밀번호가 일치하지 않습니다.'); history.back();</script>");
        }

        if (row.status === 'suspended') {
            return res.send("<script>alert('정지된 계정입니다. 관리자에게 문의하세요.'); history.back();</script>");
        }

        req.session.user = {
            id: row.id,
            username: row.username,
            name: row.name,
            role: row.role ? row.role.trim() : 'user',
            status: row.status
        };

        req.session.save((err) => {
            if (err) console.error(err);
            res.send("<script>alert('🔓 로그인이 성공적으로 완료되었습니다.'); location.href='../../';</script>");
        });
    });
});

// ====================================================================
// 🔍 [신설] 아이디 찾기 엔진 (이름 + 전화번호 기반)
// ====================================================================
router.get('/find-id', (req, res) => {
    res.render('find_id');
});

router.post('/find-id', (req, res) => {
    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.send("<script>alert('이름과 전화번호를 모두 입력해 주세요.'); history.back();</script>");
    }

    db.get("SELECT username FROM users WHERE name = ? AND phone = ?", [name.trim(), phone.trim()], (err, row) => {
        if (err) {
            console.error(err);
            return res.send("<script>alert('조회 중 데이터베이스 오류가 발생했습니다.'); history.back();</script>");
        }
        if (!row) {
            return res.send("<script>alert('입력하신 정보와 일치하는 아이디가 존재하지 않습니다.'); history.back();</script>");
        }
        // 찾기 성공 시 알림창으로 아이디 노출 후 로그인 창으로 이동
        return res.send(`<script>alert('🔍 회원님의 아이디는 [ ${row.username} ] 입니다.'); location.href='./login';</script>`);
    });
});

// ====================================================================
// 🔑 [신설] 비밀번호 찾기 엔진 (아이디 + 이름 기반)
// ====================================================================
router.get('/find-pw', (req, res) => {
    res.render('find_pw');
});

router.post('/find-pw', (req, res) => {
    const { username, name } = req.body;

    if (!username || !name) {
        return res.send("<script>alert('아이디와 이름을 모두 입력해 주세요.'); history.back();</script>");
    }

    db.get("SELECT password FROM users WHERE username = ? AND name = ?", [username.trim(), name.trim()], (err, row) => {
        if (err) {
            console.error(err);
            return res.send("<script>alert('조회 중 데이터베이스 오류가 발생했습니다.'); history.back();</script>");
        }
        if (!row) {
            return res.send("<script>alert('입력하신 정보와 일치하는 회원 정보가 없습니다.'); history.back();</script>");
        }
        // 비밀번호 일치 시 안내 (현재 평문 저장 구조에 맞춤형 설계)
        return res.send(`<script>alert('🔑 회원님의 비밀번호는 [ ${row.password} ] 입니다.'); location.href='./login';</script>`);
    });
});

// [🚪 로그아웃 엔진] GET: /user/logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("로그아웃 세션 파기 실패:", err);
        res.send("<script>alert('🚪 안전하게 로그아웃 되었습니다.'); location.href='../../';</script>");
    });
});

// [회원가입 1단계] 이용약관 동의 뷰 로드
router.get('/register', (req, res) => {
    res.render('register_agree');
});

// [회원가입 2단계] 약관 동의 검증 후 폼 이동
router.post('/register/form', (req, res) => {
    const { agree } = req.body;
    if (agree !== 'on') {
        return res.send("<script>alert('필수 약관 동의가 필요합니다.'); history.back();</script>");
    }
    res.render('register_form');
});

// [회원가입 3단계] 최종 정보 처리 및 DB 저장
router.post('/register', (req, res) => {
    const { username, password, name, phone, address } = req.body;

    if (username.toLowerCase().trim() === 'admin') {
        return res.send("<script>alert('❌ [admin]은 시스템 예약어이므로 일반 가입자가 사용할 수 없습니다.'); history.back();</script>");
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).send("데이터베이스 조회 오류");
        if (row) return res.send("<script>alert('이미 존재하는 아이디입니다.'); history.back();</script>");

        const query = `
            INSERT INTO users (username, password, name, phone, address, role, status)
            VALUES (?, ?, ?, ?, ?, 'user', 'active')
        `;
        db.run(query, [username, password, name, phone, address], function (err2) {
            if (err2) {
                console.error("회원 가입 트랜잭션 실패:", err2);
                return res.status(500).send("회원 등록 처리 실패");
            }
            res.send("<script>alert('🎉 회원가입이 성공적으로 완료되었습니다! 로그인해 주세요.'); location.href='./login';</script>");
        });
    });
});

module.exports = router;