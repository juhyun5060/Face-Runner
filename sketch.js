// ----------------------------------------
// 1. ML5 & 비디오 설정
// ----------------------------------------
let faceapi;
let video;
let detections = [];

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
let currentExpression = 'neutral';
let groundY; // 땅 높이

// ★★★★★ 새로 추가된 변수 ★★★★★
// 'start': 시작 대기, 'playing': 게임 중, 'gameOver': 게임 오버
let gameState = 'start'; 

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
// 4. ML5.js 결과 처리
// ----------------------------------------
function gotResults(err, result) {
    if (err) {
        console.error(err);
        faceapi.detect(gotResults);
        return;
    }

    if (result && result.length > 0) {
        const expressions = result[0].expressions;
        currentExpression = getDominantExpression(expressions);
    } else {
        currentExpression = 'neutral';
    }
    faceapi.detect(gotResults);
}

function getDominantExpression(expressions) {
    let maxScore = 0;
    let dominantExpression = 'neutral';
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
    
    // 땅 그리기 (항상 그림)
    fill(100);
    noStroke();
    rect(0, groundY, width, height - groundY);

    // ★★★★★ 게임 상태에 따라 다른 화면 그리기 ★★★★★
    if (gameState === 'playing') {
        runGame(); // 게임 실행 로직
    } else if (gameState === 'start') {
        showStartScreen(); // 시작 화면
    } else if (gameState === 'gameOver') {
        showGameOverScreen(); // 게임 오버 화면
    }
}

/** 'playing' 상태일 때 실행되는 게임 로직 */
function runGame() {
    // 1. 장애물 생성
    if (frameCount % 100 === 0 && random(1) < 0.5) {
        obstacles.push(new Obstacle());
    }

    // 2. 장애물 관리 (업데이트, 그리기, 충돌 확인)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();
        obs.show();

        if (obs.hits(player)) {
            gameOver(); // ★★★ 충돌 시 gameOver() 호출
        }

        if (obs.isOffscreen()) {
            obstacles.splice(i, 1);
            score++;
        }
    }

    // 3. 플레이어 상태 업데이트 (표정에 따라)
    player.setState(currentExpression);
    player.update();
    player.show();

    // 4. UI 그리기 (점수, 현재 표정)
    fill(255);
    textSize(30);
    textAlign(LEFT, TOP);
    text(`Score: ${score}`, 20, 20);
    text(`State: ${currentExpression}`, 20, 60);
}

/** 'start' 상태일 때 시작 화면 그리기 */
function showStartScreen() {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(50);
    text("Press ENTER to Start", width / 2, height / 2);
}

/** 'gameOver' 상태일 때 게임 오버 화면 그리기 */
function showGameOverScreen() {
    fill(255, 0, 0);
    textAlign(CENTER, CENTER);
    textSize(50);
    text("GAME OVER", width / 2, height / 2 - 40);
    textSize(30);
    text(`Score: ${score}`, width / 2, height / 2 + 20);
    text("Press ENTER to Restart", width / 2, height / 2 + 70);
}

// ----------------------------------------
// 6. 게임 상태 관리 함수 (★ 중요 ★)
// ----------------------------------------

/** p5.js 내장 함수: 키보드가 눌렸을 때 호출됨 */
function keyPressed() {
    // 엔터키(keyCode 13)가 눌렸을 때
    if (keyCode === ENTER) {
        // 시작 화면이거나 게임 오버 화면이면, 게임을 시작/재시작
        if (gameState === 'start' || gameState === 'gameOver') {
            startGame();
        }
    }
}

/** 게임을 시작/재시작하는 함수 */
function startGame() {
    // 모든 변수 초기화
    obstacles = [];
    score = 0;
    player = new Player(); // 플레이어 재설정
    currentExpression = 'neutral';
    
    // 게임 상태를 'playing'으로 변경
    gameState = 'playing';
}

/** 게임 오버 처리 함수 */
function gameOver() {
    gameState = 'gameOver'; // 상태 변경
    console.log("GAME OVER");
}


// ----------------------------------------
// 7. Player 클래스 (변경 없음)
// ----------------------------------------
class Player {
    constructor() {
        this.w = 50;
        this.h_normal = 80;
        this.h_duck = 40;
        this.h = this.h_normal;
        this.x = 50;
        this.y = groundY;
        this.vy = 0;
        this.gravity = 0.8;
        this.jumpForce = -18;
        this.state = 'running';
    }
    setState(expression) {
        if (this.isOnGround()) {
            if (expression === 'happy' || expression === 'surprised') {
                this.jump();
                this.state = 'jumping';
            }
            else if (['sad', 'angry', 'fearful', 'disgusted'].includes(expression)) {
                this.state = 'ducking';
            }
            else {
                this.state = 'running';
            }
        }
    }
    jump() {
        if (this.isOnGround()) {
            this.vy = this.jumpForce;
        }
    }
    isOnGround() {
        return this.y >= groundY;
    }
    update() {
        this.y += this.vy;
        this.vy += this.gravity;
        if (this.y > groundY) {
            this.y = groundY;
            this.vy = 0;
            if (this.state === 'jumping' && currentExpression !== 'duck') {
                 this.state = 'running';
            }
        }
        if (this.state === 'ducking' && this.isOnGround()) {
            this.h = this.h_duck;
        } else {
            this.h = this.h_normal;
        }
    }
    show() {
        fill(0, 150, 255);
        noStroke();
        rect(this.x, this.y - this.h, this.w, this.h);
    }
}


// ----------------------------------------
// 8. Obstacle 클래스 (변경 없음)
// ----------------------------------------
class Obstacle {
    constructor() {
        this.x = width;
        this.w = 40;
        this.speed = 7;
        if (random(1) > 0.5) {
            this.type = 'low';
            this.h = 60;
            this.y = groundY - this.h;
        } else {
            this.type = 'high';
            this.h = 50;
            this.y = groundY - 100;
        }
    }
    update() {
        this.x -= this.speed;
    }
    show() {
        fill(255, 0, 0);
        noStroke();
        rect(this.x, this.y, this.w, this.h);
    }
    isOffscreen() {
        return this.x < -this.w;
    }
    hits(player) {
        let playerTop = player.y - player.h;
        let playerBottom = player.y;
        let playerLeft = player.x;
        let playerRight = player.x + player.w;
        let obsTop = this.y;
        let obsBottom = this.y + this.h;
        let obsLeft = this.x;
        let obsRight = this.x + this.w;
        return (playerRight > obsLeft &&
                playerLeft < obsRight &&
                playerBottom > obsTop &&
                playerTop < obsBottom);
    }
}