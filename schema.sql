-- 1. 회원 테이블 (users)
CREATE TABLE IF NOT EXISTS users (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     username TEXT UNIQUE NOT NULL,
                                     password TEXT NOT NULL,
                                     name TEXT,
                                     phone TEXT,
                                     address TEXT,
                                     role TEXT DEFAULT 'user',
                                     status TEXT DEFAULT 'active',
                                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 상품 테이블 (products)
CREATE TABLE IF NOT EXISTS products (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,
                                        description TEXT,
                                        price INTEGER NOT NULL,
                                        emoji TEXT,
                                        image TEXT,
                                        likes INTEGER DEFAULT 0,
                                        is_featured INTEGER DEFAULT 0,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 장바구니 테이블 (cart_items)
CREATE TABLE IF NOT EXISTS cart_items (
                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                          user_id TEXT NOT NULL,
                                          product_id INTEGER NOT NULL,
                                          quantity INTEGER DEFAULT 1,
                                          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                          UNIQUE(user_id, product_id)
    );

-- 4. 게시판/공지사항 테이블 (posts)
CREATE TABLE IF NOT EXISTS posts (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     title TEXT NOT NULL,
                                     content TEXT NOT NULL,
                                     author TEXT NOT NULL,
                                     view_count INTEGER DEFAULT 0,
                                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 위시리스트 테이블 (wishlist)
CREATE TABLE IF NOT EXISTS wishlist (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        user_id TEXT NOT NULL,
                                        product_id INTEGER NOT NULL,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        UNIQUE(user_id, product_id)
    );

-- 6. 주문 테이블 (orders) 🌟 [에러 완벽 해결 버전]
CREATE TABLE IF NOT EXISTS orders (
                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                      user_id TEXT NOT NULL,
                                      product_id INTEGER,          -- 💡 추가: 주문한 상품의 ID
                                      quantity INTEGER,            -- 💡 추가: 주문한 상품의 수량
                                      total_price INTEGER NOT NULL,
                                      status TEXT DEFAULT '주문완료',
                                      receiver_name TEXT,
                                      receiver_phone TEXT,
                                      delivery_address TEXT,
                                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);