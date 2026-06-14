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


// 1. 게시글 목록
router.get('/', (req, res) => {
    db.all(`
        SELECT * FROM posts ORDER BY
                                COALESCE(parent_id, id) DESC, id ASC
    `, [], (err, posts) => {
        if (err) return res.send('목록 불러오기 실패');
        res.render('board', { title: '고객센터 게시판', posts, user: req.session.user });
    });
});

// 2. 글쓰기 폼
router.get('/new', (req, res) => {
    // 🌟 [교정]: 비로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }
    res.render('post', { post: null, parentId: null });
});

// 3. 새 글쓰기 처리
router.post('/new', upload.single('file'), (req, res) => {
    // 🌟 [교정]: 비로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    const { title, content } = req.body;
    const author = req.session.user.username;
    const file_path = req.file ? '/uploads/' + req.file.filename : null;

    db.run(
        'INSERT INTO posts (title, content, author, file_path, parent_id) VALUES (?, ?, ?, ?, NULL)',
        [title, content, author, file_path],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.send('등록 실패');
            }
            // 🌟 [교정]: 리다이렉트 주소 보정
            res.redirect('/stud7/board');
        }
    );
});

// 4. 글 상세보기
router.get('/detail/:id', (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.send('글을 찾을 수 없습니다.');
        res.render('detail', { post, user: req.session.user });
    });
});

// 5. 답변 달기 폼
router.get('/reply/:parentId', (req, res) => {
    // 🌟 [교정]: 로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }
    const parentId = req.params.parentId;
    db.get("SELECT title FROM posts WHERE id = ?", [parentId], (err, row) => {
        if (err || !row) return res.send("원글 없음");
        res.render('reply', { parentId, parentTitle: row.title });
    });
});

// 6. 답변 달기 처리
router.post('/create', (req, res) => {
    // 🌟 [교정]: 로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    const { title, content, parent_id } = req.body;
    const author = req.session.user.username;

    db.run(
        'INSERT INTO posts (author, title, content, parent_id) VALUES (?, ?, ?, ?)',
        [author, title, content, parent_id || null],
        function (err) {
            if (err) return res.send('등록 실패');
            // 🌟 [교정]: 리다이렉트 주소 보정
            res.redirect('/stud7/board');
        }
    );
});

// 7. 수정 폼
router.get('/edit/:id', (req, res) => {
    // 🌟 [교정]: 로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.send('글 없음');

        if (post.author !== req.session.user.username) {
            return res.send("<script>alert('본인 글만 수정할 수 있습니다.'); history.back();</script>");
        }

        res.render('edit', { post });
    });
});

// 8. 수정 처리
router.post('/edit/:id', (req, res) => {
    // 🌟 [교정]: 로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    const { title, content } = req.body;
    const postId = req.params.id;

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
                // 🌟 [교정]: 상세 보기 리다이렉트 주소 보정
                res.redirect('/stud7/board/detail/' + postId);
            }
        );
    });
});

// 9. 삭제 처리
router.post('/delete/:id', (req, res) => {
    // 🌟 [교정]: 로그인 튕김 주소 보정
    if (!req.session.user) {
        return res.send("<script>alert('로그인이 필요합니다.'); location.href='/stud7/user/login';</script>");
    }

    const postId = req.params.id;

    db.get('SELECT author FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.send('글 없음');

        if (post.author === req.session.user.username || req.session.user.role === 'admin') {
            db.run('DELETE FROM posts WHERE id = ?', [postId], (err) => {
                if (err) return res.send('삭제 실패');
                // 🌟 [교정]: 리다이렉트 주소 보정
                res.redirect('/stud7/board');
            });
        } else {
            return res.send("<script>alert('본인 글만 삭제할 수 있습니다.'); history.back();</script>");
        }
    });
});

// 📢 관리자 마이페이지에서 보낸 공지사항 데이터 처리 라우터
router.post('/write', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send("권한이 없습니다. 관리자만 작성 가능합니다.");
    }

    const { title, content } = req.body;
    const author = req.session.user.username || 'admin';

    const query = `INSERT INTO posts (title, content, author) VALUES (?, ?, ?)`;

    db.run(query, [title, content, author], function(err) {
        if (err) {
            console.error("💥 공지사항 등록 중 DB 에러 발생:", err);
            return res.status(500).send("공지사항을 저장하는 중에 오류가 발생했습니다.");
        }

        console.log(`✨ 새 공지사항 등록 완료 (ID: ${this.lastID})`);
        // 🌟 [교정]: 공지글 생성 후 리다이렉트 주소 보정
        res.redirect('/stud7/mypage');
    });
});

module.exports = router;