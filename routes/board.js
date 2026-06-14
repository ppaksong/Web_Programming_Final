const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });


// 1. 게시글 목록 (정렬 기준 반영)
router.get('/', (req, res) => {
    db.all(`
        SELECT * FROM posts ORDER BY 
        COALESCE(parent_id, id) DESC, id ASC
    `, [], (err, posts) => {
        if (err) return res.send('목록 불러오기 실패');
        // 세션 정보(req.session.user)를 함께 넘겨주어 화면에서 로그인 여부를 알 수 있게 합니다.
        res.render('board', { title: '고객센터 게시판', posts, user: req.session.user });
    });
});

// 2. 글쓰기 폼
router.get('/new', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }
    res.render('post', { post: null, parentId: null });
});

// 3. 새 글쓰기 처리 (주석 해제 및 세션 연동 완료)
router.post('/new', upload.single('file'), (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    const { title, content } = req.body;
    const author = req.session.user.username; // 세션에서 로그인한 유저 아이디 가져오기
    const file_path = req.file ? '/uploads/' + req.file.filename : null; // 파일 첨부 처리

    db.run(
        'INSERT INTO posts (title, content, author, file_path, parent_id) VALUES (?, ?, ?, ?, NULL)',
        [title, content, author, file_path],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.send('등록 실패');
            }
            res.redirect('/board');
        }
    );
});

// 4. 글 상세보기
router.get('/detail/:id', (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.send('글을 찾을 수 없습니다.');
        // 본인 글 확인을 위해 user 세션을 같이 보냅니다.
        res.render('detail', { post, user: req.session.user });
    });
});

// 5. 답변 달기 폼
router.get('/reply/:parentId', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }
    const parentId = req.params.parentId;
    db.get("SELECT title FROM posts WHERE id = ?", [parentId], (err, row) => {
        if (err || !row) return res.send("원글 없음");
        res.render('reply', { parentId, parentTitle: row.title });
    });
});

// 6. 답변 달기 처리 (세션 작성자 연동)
router.post('/create', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    const { title, content, parent_id } = req.body;
    const author = req.session.user.username; // 세션에서 아이디 가져오기

    db.run(
        'INSERT INTO posts (author, title, content, parent_id) VALUES (?, ?, ?, ?)',
        [author, title, content, parent_id || null],
        function (err) {
            if (err) return res.send('등록 실패');
            res.redirect('/board');
        }
    );
});

// 7. 수정 폼 (작성자 본인 확인 권한 추가)
router.get('/edit/:id', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.send('글 없음');

        // 권한 체크: 로그인한 사람과 작성자가 같은지 검사
        if (post.author !== req.session.user.username) {
            return res.send("<script>alert('본인 글만 수정할 수 있습니다.'); history.back();</script>");
        }

        res.render('edit', { post });
    });
});

// 8. 수정 처리 (작성자 본인 확인 권한 추가)
router.post('/edit/:id', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    const { title, content } = req.body;
    const postId = req.params.id;

    // 수정 전 본인 확인 한 번 더 실행
    db.get('SELECT author FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.send('글 없음');

        if (post.author !== req.session.user.username) {
            return res.send("<script>alert('본인 글만 수정할 수 있습니다.'); history.back();</script>");
        }

        db.run(
            'UPDATE posts SET title = ?, content = ? WHERE id = ?',
            [title, content, postId],
            (err) => {
                if (err) return res.send('수정 실패');
                res.redirect('/board/detail/' + postId);
            }
        );
    });
});

// 9. 삭제 처리 (본인 확인 권한 추가)
router.post('/delete/:id', (req, res) => {
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/user/login';</script>");
    }

    const postId = req.params.id;

    db.get('SELECT author FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.send('글 없음');

        // 권한 체크: 작성자 본인이거나 관리자(admin)인 경우만 삭제 허용
        if (post.author === req.session.user.username || req.session.user.role === 'admin') {
            db.run('DELETE FROM posts WHERE id = ?', [postId], (err) => {
                if (err) return res.send('삭제 실패');
                res.redirect('/board');
            });
        } else {
            return res.send("<script>alert('본인 글만 삭제할 수 있습니다.'); history.back();</script>");
        }
    });
});

// 📢 관리자 마이페이지에서 보낸 공지사항 데이터 처리 라우터
router.post('/write', (req, res) => {
    // 1. 세션에서 관리자 로그인 상태 확인 및 안전장치
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("권한이 없습니다. 관리자만 작성 가능합니다.");
    }

    // 2. 폼에서 넘어온 제목과 내용 구조분해 할당
    const { title, content } = req.body;
    const author = req.session.user.username || 'admin'; // 작성자 이름은 로그인한 관리자 ID

    // 3. 데이터베이스(posts 테이블)에 공지사항 삽입
    // (만약 board.js 상단에 db 정의가 다르게 되어 있다면 그 변수명을 따르세요. 보통 db 또는 sqliteInstance)
    const query = `INSERT INTO posts (title, content, author) VALUES (?, ?, ?)`;

    db.run(query, [title, content, author], function(err) {
        if (err) {
            console.error("💥 공지사항 등록 중 DB 에러 발생:", err);
            return res.status(500).send("공지사항을 저장하는 중에 오류가 발생했습니다.");
        }

        console.log(`✨ 새 공지사항 등록 완료 (ID: ${this.lastID})`);
        // 4. 성공 시 마이페이지로 깔끔하게 리다이렉트(새로고침 효과)
        res.redirect('/mypage');
    });
});

module.exports = router;