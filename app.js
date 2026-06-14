var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');

var app = express();

// ====================================================================
// 💾 [최우선 실행] 데이터베이스 안전 마이그레이션 + 고정 관리자 자동화 생성
// ====================================================================
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE posts ADD COLUMN parent_id INTEGER", (err) => {});
  db.run("ALTER TABLE posts ADD COLUMN file_path TEXT", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN name TEXT", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN phone TEXT", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN address TEXT", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {});
  db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'", (err) => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            user_id TEXT,
                                            product_id INTEGER,
                                            quantity INTEGER DEFAULT 1,
                                            UNIQUE(user_id, product_id)
      )
  `);
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// static 설정을 상단에 배치하여 public 내의 이미지/CSS를 안전하게 로드
app.use(express.static(path.join(__dirname, 'public')));

// 🌟 [세션 코어 선언부]
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 세션 만료 방지 1시간 고정
}));

// 🌟 [핵심 보정]: 세션 바인딩 및 라우터 전송 직전 무조건 동기화 미들웨어 실행
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// [라우터 모듈 정의 및 연결]
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const userRouter = require('./routes/user');
const productRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const orderRouter = require('./routes/order');
const boardRouter = require('./routes/board');
const mypageRouter = require('./routes/mypage');
const adminRouter = require('./routes/admin');

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/user', userRouter);
app.use('/board', boardRouter);
app.get('/login', (req, res)=> { res.redirect('./user/login'); });
app.use('/products', productRouter);
app.use('/cart', cartRouter);
app.use('/order', orderRouter);
app.use('/mypage', mypageRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ====================================================================
// 🚀 [추가 필수 설정] 서버 실행 포트 동적 할당 (GitHub 배포 매뉴얼 준수)
// ====================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;