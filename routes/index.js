const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 홈페이지 메인 화면 라우터
// 홈페이지 메인 화면 라우터
// 홈페이지 메인 화면 라우터
router.get('/', (req, res) => {
  // 1. 메인에 보여줄 추천 상품 조회
  db.all('SELECT * FROM products LIMIT 5', [], (err, products) => {
    const featuredProducts = products || [];

    // 🌟 [보정된 안전 쿼리] role이 admin인 계정뿐만 아니라, 작성자 이름이 'admin' 또는 '관리자'인 글도 모두 가져옵니다.
    const noticeQuery = `
      SELECT DISTINCT posts.* FROM posts
                                     LEFT JOIN users ON posts.author = users.username
      WHERE users.role = 'admin'
         OR posts.author = 'admin'
         OR posts.author = '관리자'
      ORDER BY posts.id DESC
        LIMIT 5
    `;

    db.all(noticeQuery, [], (err, posts) => {
      if (err) {
        console.error("메인 관리자 공지사항 조회 실패:", err);
      }

      // 2. 상품 데이터와 필터링된 공지글 데이터를 템플릿으로 전달
      res.render('index', {
        title: 'PNU PROTEIN & HEALTHCARE',
        featuredProducts: featuredProducts,
        posts: posts || [],
        user: req.session.user
      });
    });
  });
});

module.exports = router;