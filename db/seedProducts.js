// scripts/seedProducts.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

// 상품 데이터베이스 초기화 및 헬스 용품 데이터 삽입
db.serialize(() => {

    // 1. 기존 데이터 싹 지우기 (과일 데이터 초기화)
    db.run('DELETE FROM products', (err) => {
        if (err) {
            console.error('❌ 기존 데이터 삭제 중 오류 발생:', err.message);
            return db.close();
        }
        console.log('🧹 기존 상품 데이터가 모두 초기화되었습니다.');

        // 2. 새 상품 밀어넣기
        const stmt = db.prepare(`
            INSERT INTO products (name, description, price, emoji, image, likes, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // 🌟 마이프로틴 제품 라인업 배열 (총 9개)
        const products = [
            ['임팩트 웨이 프로틴', '전 세계 베스트셀러, 가성비 최고의 WPC', 27900, '', 'impact_whey_protein.png', 120, 1],
            ['임팩트 웨이 아이솔레이트', '유당불내증 걱정 X 순도 90% 이상 WPI', 42000, '', 'impact_whey_isolate.png', 85, 1],
            ['임팩트 웨이 게이너', '신체구조상 체중 증량과 벌크업을 위한 최적의 배합', 38000, '', 'impact_whey_gainer.png', 40, 1],
            ['클리어 웨이 프로틴', '주스처럼 가볍고 상큼한 부담없는 단백질 보충제', 35000, '', 'clear_whey_protein.png', 45, 1],
            ['임팩트 다이어트 웨이', '체중 조절을 위한 완벽한 영양소의 식사 대용 프로틴', 32000, '', 'impact_diet_whey.png', 55, 1],
            ['에센셜 웨이 프로틴', '매일매일, 부담 없이 즐기는 필수 단백질', 24900, '', 'essential_whey_protein.png', 30, 0],
            ['임팩트 프리워크아웃', '지치지 않는 에너지와 폭발력을 위한 부스터', 26000, '', 'impact_pre_workout.png', 60, 1],
            ['임팩트 EAA', '근육 회복을 돕는 9가지 필수 아미노산과 비타민들', 28000, '', 'impact_eaa.png', 25, 0],
            ['임팩트 하이드레이트', '운동 중 빠른 수분 및 전해질 보충으로 최고의 퍼포먼스를', 19000, '', 'impact_hydrate.png', 15, 0],
            ['오리진 프로틴', '가장 원초적인, 기본에 충실한 프로틴', 19000, '', 'origin_protein.png', 15, 0],
            ['토탈 프로틴 블렌디드', '하나의 상품으로 단백질, 비타민, 각종 영양소를 섭취하세요', 25000, '', 'total_protein_blended.png', 15, 0]

        ];

        products.forEach(product => {
            stmt.run(product, (err) => {
                if (err) console.error('❌ 데이터 삽입 오류:', err.message);
            });
        });

        stmt.finalize(() => {
            console.log('🏋️‍♂️ 9개의 단백질 보충제 및 운동용품 데이터 삽입이 완벽하게 끝났습니다!');
            db.close();
        });
    });
});

/* 이모티콘 모음
💪🥇🦍🧃🥗🥛⚡🧬💧
 */