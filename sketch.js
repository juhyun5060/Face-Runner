// ----------------------------------------
// 1. ML5 & 비디오 설정
// ----------------------------------------
let faceapi;
let video;
let detections = [];

// 기존과 동일하게, descriptors가 true여야 expressions가 나옵니다.
const detection_options = {
    withLandmarks: true,
    withDescriptors: true,
    withExpressions: true
};

// ----------------------------------------
// 2. 게임 변수 설정
// ----------------------------------------
let player;
let obstacles = [];
let score = 0;
let currentExpression = 'neutral'; // 현재 플레이어 표정
let gameRunning = true;
let groundY; // 땅 높이

// ----------------------------------------
// 3. P5.js & ML5.js 설정 함수
// ----------------------------------------
function setup() {
    createCanvas(800, 450);
    groundY = height - 40; // 땅의 Y좌표

    // 비디오 및 ml5 설정
    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide();
    faceapi = ml5.faceApi(video, detection_options, modelReady);

    // 게임 객체 생성
    player = new Player();
}

function modelReady() {
    console.log('FaceAPI 모델이 준비되었습니다!');
    faceapi.detect(gotResults); // 감지 시작
}

// ----------------------------------------
// 4. ML5.js 결과 처리 (가장 중요!)
// ----------------------------------------
function gotResults(err, result) {
    if (err) {
        console.error(err);
        faceapi.detect(gotResults); // 에러가 나도 계속 시도
        return;
    }

    // 얼굴을 감지했을 때만
    if (result && result.length > 0) {
        const expressions = result[0].expressions;
        // 가장 점수가 높은 표정을 현재 상태로 저장
        currentExpression = getDominantExpression(expressions);
    } else {
        // 얼굴 감지 못하면 'neutral'
        currentExpression = 'neutral';
    }

    // 계속 반복 감지
    faceapi.detect(gotResults);
}

/**
 * 표정 객체에서 가장 점수가 높은 표정의 이름을 반환하는 헬퍼 함수
 * @param {object} expressions - {happy: 0.1, sad: 0.8, ...}
 * @returns {string} - "happy", "sad" 등 가장 높은 점수의 표정 이름
 */
function getDominantExpression(expressions) {
    let maxScore = 0;
    let dominantExpression = 'neutral';

    // Object.entries로 객체를 순회하며 [key, value] 쌍을 찾음
    for (const [expression, score] of Object.entries(expressions)) {
        if (score > maxScore) {
            maxScore = score;
            dominantExpression = expression;
        }
    }
    return dominantExpression;
}


// ----------------------------------------
// 5. P5.js 그리기 루프 (게임의 핵심)
// ----------------------------------------
function draw() {
    // 캔버스를 검은색으로
    background(0);

    // (좌우 반전) 비디오를 좌측 상단에 작게 그리기 (디버깅용)
    push();
    translate(160, 0); // 위치
    scale(-1, 1); // 좌우 반전
    image(video, 0, 0, 160, 120);
    pop();
    
    // 땅 그리기
    fill(100);
    noStroke();
    rect(0, groundY, width, height - groundY);

    if (!gameRunning) {
        // 게임 오버 화면
        fill(255, 0, 0);
        textAlign(CENTER, CENTER);
        textSize(50);
        text("GAME OVER", width / 2, height / 2 - 40);
        textSize(30);
        text(`Score: ${score}`, width / 2, height / 2 + 20);
        text("Refresh to restart", width / 2, height / 2 + 70);
        return; // 게임 오버 시 여기서 draw() 종료
    }

    // --- 게임 실행 중 로직 ---

    // 1. 장애물 생성
    // 100 프레임마다 (약 1.5초) 50% 확률로 장애물 생성
    if (frameCount % 100 === 0 && random(1) < 0.5) {
        obstacles.push(new Obstacle());
    }

    // 2. 장애물 관리 (업데이트, 그리기, 충돌 확인)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();
        obs.show();

        // (A) 플레이어와 충돌했는지 확인
        if (obs.hits(player)) {
            gameOver();
        }

        // (B) 화면 밖으로 나갔는지 확인
        if (obs.isOffscreen()) {
            obstacles.splice(i, 1); // 배열에서 제거
            score++; // 점수 획득
        }
    }

    // 3. 플레이어 상태 업데이트 (표정에 따라)
    player.setState(currentExpression);
    player.update(); // 플레이어 물리 적용 (점프 등)
    player.show(); // 플레이어 그리기

    // 4. UI 그리기 (점수, 현재 표정)
    fill(255);
    textSize(30);
    textAlign(LEFT, TOP);
    text(`Score: ${score}`, 20, 20);
    text(`State: ${currentExpression}`, 20, 60);
}

function gameOver() {
    gameRunning = false;
    console.log("GAME OVER");
    // noLoop(); // noLoop() 대신 플래그 사용
}


// ----------------------------------------
// 6. Player 클래스 (플레이어 객체)
// ----------------------------------------
class Player {
    constructor() {
        this.w = 50; // 너비
        this.h_normal = 80; // 기본 높이
        this.h_duck = 40; // 숙였을 때 높이
        this.h = this.h_normal; // 현재 높이

        this.x = 50; // X위치 (고정)
        this.y = groundY; // Y위치 (땅에서 시작)
        this.vy = 0; // Y방향 속도 (점프용)
        this.gravity = 0.8;
        this.jumpForce = -18;
        
        this.state = 'running'; // 'running', 'jumping', 'ducking'
    }

    /** 표정에 따라 플레이어 상태 변경 */
    setState(expression) {
        // 점프 중일 때는 숙일 수 없음
        if (this.isOnGround()) {
            // JUMP: happy, surprised
            if (expression === 'happy' || expression === 'surprised') {
                this.jump();
                this.state = 'jumping';
            }
            // DUCK: sad, angry, fearful, disgusted
            else if (['sad', 'angry', 'fearful', 'disgusted'].includes(expression)) {
                this.state = 'ducking';
            }
            // RUN: neutral
            else {
                this.state = 'running';
            }
        }
    }
    
    /** 점프 실행 */
    jump() {
        if (this.isOnGround()) {
            this.vy = this.jumpForce;
        }
    }

    /** 땅에 있는지 확인 */
    isOnGround() {
        return this.y >= groundY;
    }

    /** 매 프레임 물리 업데이트 */
    update() {
        // 중력 적용
        this.y += this.vy;
        this.vy += this.gravity;

        // 땅에 닿으면 멈춤
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            // 점프가 끝났고, 표정이 'duck'이 아니면 'running'으로 복귀
            if (this.state === 'jumping' && currentExpression !== 'duck') {
                 this.state = 'running';
            }
        }
        
        // 상태에 따라 높이 조절
        if (this.state === 'ducking' && this.isOnGround()) {
            this.h = this.h_duck;
        } else {
            this.h = this.h_normal;
        }
    }

    /** 플레이어 그리기 */
    show() {
        fill(0, 150, 255); // 파란색
        noStroke();
        // y좌표가 발끝 기준이므로, (y - 현재 높이)로 사각형을 그림
        rect(this.x, this.y - this.h, this.w, this.h);
    }
}


// ----------------------------------------
// 7. Obstacle 클래스 (장애물 객체)
// ----------------------------------------
class Obstacle {
    constructor() {
        this.x = width; // 화면 오른쪽 끝에서 시작
        this.w = 40;
        this.speed = 7;
        
        // 장애물 타입 (low: 점프해서 피함, high: 숙여서 피함)
        if (random(1) > 0.5) {
            this.type = 'low';
            this.h = 60;
            this.y = groundY - this.h; // 땅에 붙어있음
        } else {
            this.type = 'high';
            this.h = 50;
            this.y = groundY - 100; // 플레이어가 숙여서 피할 높이
        }
    }

    /** 매 프레임 왼쪽으로 이동 */
    update() {
        this.x -= this.speed;
    }

    /** 장애물 그리기 */
    show() {
        fill(255, 0, 0); // 빨간색
        noStroke();
        rect(this.x, this.y, this.w, this.h);
    }

    /** 화면 밖으로 나갔는지 */
    isOffscreen() {
        return this.x < -this.w;
    }

    /** 플레이어와 충돌했는지 (AABB 충돌 감지) */
    hits(player) {
        // 플레이어의 실제 y 위치 (상단)
        let playerTop = player.y - player.h;
        let playerBottom = player.y;
        let playerLeft = player.x;
        let playerRight = player.x + player.w;

        let obsTop = this.y;
        let obsBottom = this.y + this.h;
        let obsLeft = this.x;
        let obsRight = this.x + this.w;

        // AABB (Axis-Aligned Bounding Box) 충돌 검사
        return (playerRight > obsLeft &&
                playerLeft < obsRight &&
                playerBottom > obsTop &&
                playerTop < obsBottom);
    }
}
