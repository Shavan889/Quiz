/**
 * QuizMaster - Main Application Logic
 * 
 * Architecture:
 * - State: Centralized object to hold app state
 * - DOM Elements: Cached references to UI elements
 * - Logic: Pure functions where possible, separated from UI updates
 * - Event Listeners: Handlers for user interaction
 */

/* ==========================================================================
   1. STATE MANAGEMENT
   ========================================================================== */
const AppState = {
    currentCategory: null,
    currentDifficulty: null,
    questions: [],
    userAnswers: [], // Stores { questionIndex, selectedOption, isCorrect, correctAnswer }
    currentQuestionIndex: 0,
    score: 0,
    timer: null,
    timeLeft: 15,
    maxTime: 15,
    isQuizActive: false,
    hasAnswered: false,
    isSoundOn: true,
};

/* ==========================================================================
   2. DOM ELEMENTS
   ========================================================================== */
const Screens = {
    start: document.getElementById('start-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen'),
    review: document.getElementById('review-screen'),
};

const UI = {
    themeToggle: document.getElementById('theme-toggle'),
    soundToggle: document.getElementById('sound-toggle'),
    sunIcon: document.querySelector('.sun-icon'),
    moonIcon: document.querySelector('.moon-icon'),
    soundOnIcon: document.querySelector('.sound-on'),
    soundOffIcon: document.querySelector('.sound-off'),

    startForm: document.getElementById('start-form'),

    // Quiz Elements
    questionCount: document.getElementById('question-count'),
    scoreDisplay: document.getElementById('score-display'),
    progressBar: document.getElementById('progress-bar'),
    timerText: document.querySelector('.timer-text'),
    timerCircle: document.getElementById('timer-circle'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    nextBtn: document.getElementById('next-btn'),

    // Result Elements
    finalScore: document.getElementById('final-score'),
    performanceMsg: document.getElementById('performance-msg'),
    highScoreMsg: document.getElementById('highscore-msg'),
    restartBtn: document.getElementById('restart-btn'),
    homeBtn: document.getElementById('home-btn'),
    reviewBtn: document.getElementById('review-btn'),

    // Review Elements
    reviewContainer: document.getElementById('review-container'),
    backToResultBtn: document.getElementById('back-to-result-btn'),

    // Canvas
    confettiCanvas: document.getElementById('confetti-canvas'),
};

/* ==========================================================================
   3. INITIALIZATION & EVENTS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
});

function setupEventListeners() {
    UI.themeToggle.addEventListener('click', toggleTheme);
    UI.soundToggle.addEventListener('click', toggleSound);

    UI.startForm.addEventListener('submit', handleStartQuiz);
    UI.nextBtn.addEventListener('click', handleNextQuestion);
    UI.restartBtn.addEventListener('click', restartQuiz);
    UI.homeBtn.addEventListener('click', goHome);

    UI.reviewBtn.addEventListener('click', showReviewScreen);
    UI.backToResultBtn.addEventListener('click', () => switchScreen(Screens.review, Screens.result));

    // Option selection delegation
    UI.optionsContainer.addEventListener('click', (e) => {
        const optionCard = e.target.closest('.option-card');
        if (optionCard && AppState.isQuizActive && !AppState.hasAnswered) {
            handleAnswerSelection(optionCard);
        }
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('quiz-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('quiz-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    if (theme === 'dark') {
        UI.moonIcon.classList.add('hidden');
        UI.sunIcon.classList.remove('hidden');
    } else {
        UI.moonIcon.classList.remove('hidden');
        UI.sunIcon.classList.add('hidden');
    }
}

function toggleSound() {
    AppState.isSoundOn = !AppState.isSoundOn;
    if (AppState.isSoundOn) {
        UI.soundOnIcon.classList.remove('hidden');
        UI.soundOffIcon.classList.add('hidden');
    } else {
        UI.soundOnIcon.classList.add('hidden');
        UI.soundOffIcon.classList.remove('hidden');
    }
}

/* ==========================================================================
   4. QUIZ LOGIC
   ========================================================================== */
async function handleStartQuiz(e) {
    e.preventDefault();

    const category = document.getElementById('category').value;
    const difficulty = document.getElementById('difficulty').value;

    AppState.currentCategory = category;
    AppState.currentDifficulty = difficulty;

    // Show Loading or Transition
    UI.startForm.querySelector('button').textContent = 'Loading...';

    try {
        await fetchQuestions(category, difficulty);

        if (AppState.questions.length > 0) {
            startQuizSession();
        } else {
            alert('No questions found for this selection. Please try another.');
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
        alert('Failed to load questions. Please check your internet connection.');
    } finally {
        UI.startForm.querySelector('button').textContent = 'Start Quiz';
    }
}

// Fetch Logic (Using Trivial API or similar open API)
async function fetchQuestions(category, difficulty) {
    // Construct API URL
    // Amount: 10, Type: multiple
    let url = `https://opentdb.com/api.php?amount=10&difficulty=${difficulty}&type=multiple`;
    if (category !== 'any') {
        url += `&category=${category}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Transform data to our format
        AppState.questions = data.results.map(q => ({
            question: decodeHTML(q.question),
            correct_answer: decodeHTML(q.correct_answer),
            options: shuffleArray([...q.incorrect_answers.map(decodeHTML), decodeHTML(q.correct_answer)])
        }));
    } catch (e) {
        // Fallback or Mock data if API fails
        console.warn('API Fetch failed, using fallback data');
        AppState.questions = generateFallbackQuestions();
    }
}

function startQuizSession() {
    AppState.currentQuestionIndex = 0;
    AppState.score = 0;
    AppState.userAnswers = [];
    AppState.isQuizActive = true;

    switchScreen(Screens.start, Screens.quiz);
    renderQuestion();
}

function renderQuestion() {
    const currentQ = AppState.questions[AppState.currentQuestionIndex];

    // Reset State
    AppState.hasAnswered = false;
    UI.nextBtn.classList.add('hidden');
    UI.optionsContainer.innerHTML = '';

    // Update UI
    UI.questionText.textContent = currentQ.question;
    UI.questionCount.textContent = `Question ${AppState.currentQuestionIndex + 1}/${AppState.questions.length}`;
    UI.scoreDisplay.textContent = `Score: ${AppState.score}`;

    // Progress Bar
    const progress = ((AppState.currentQuestionIndex) / AppState.questions.length) * 100;
    UI.progressBar.style.width = `${progress}%`;

    // Create Options with Animation Delay
    currentQ.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.style.animation = `fadeIn 0.5s ease forwards ${index * 0.1}s`;
        btn.innerHTML = `<span>${opt}</span>`;
        btn.dataset.value = opt;
        UI.optionsContainer.appendChild(btn);
    });

    startTimer();
}

function handleAnswerSelection(selectedOption) {
    if (AppState.hasAnswered) return;

    AppState.hasAnswered = true;
    clearInterval(AppState.timer); // Stop timer

    const currentQ = AppState.questions[AppState.currentQuestionIndex];
    const selectedValue = selectedOption ? selectedOption.dataset.value : null;
    const isCorrect = selectedValue === currentQ.correct_answer;

    // Record Answer
    AppState.userAnswers.push({
        question: currentQ.question,
        selected: selectedValue || "Time Expired",
        correct: currentQ.correct_answer,
        isCorrect: isCorrect
    });

    // Visual Feedback
    if (selectedOption) {
        if (isCorrect) {
            selectedOption.classList.add('correct');
            AppState.score += 10;
            playSound('correct');
        } else {
            selectedOption.classList.add('incorrect');
            playSound('incorrect');
            // Highlight correct answer
            const correctOption = Array.from(UI.optionsContainer.children).find(
                opt => opt.dataset.value === currentQ.correct_answer
            );
            if (correctOption) correctOption.classList.add('correct');
        }
    } else {
        // Time expired case
        playSound('incorrect');
    }

    UI.scoreDisplay.textContent = `Score: ${AppState.score}`;
    UI.nextBtn.classList.remove('hidden');

    if (AppState.currentQuestionIndex === AppState.questions.length - 1) {
        UI.nextBtn.textContent = 'See Results';
    } else {
        UI.nextBtn.textContent = 'Next Question';
    }
}

function handleNextQuestion() {
    AppState.currentQuestionIndex++;

    if (AppState.currentQuestionIndex < AppState.questions.length) {
        renderQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    AppState.isQuizActive = false;

    // Calculate Score
    const totalQuestions = AppState.questions.length;
    const maxScore = totalQuestions * 10;
    const percentage = (AppState.score / maxScore) * 100;

    UI.finalScore.textContent = AppState.score;
    document.querySelector('.total-score').textContent = `/ ${maxScore}`;

    // Performance Message
    if (percentage >= 80) {
        UI.performanceMsg.textContent = "Outstanding! 🌟";
        launchConfetti();
        playSound('win');
    } else if (percentage >= 50) {
        UI.performanceMsg.textContent = "Good Job! 👍";
        playSound('finish');
    } else {
        UI.performanceMsg.textContent = "Better Luck Next Time! 💪";
        playSound('finish');
    }

    // High Score Logic
    const highScore = localStorage.getItem('quiz-highscore') || 0;
    if (AppState.score > highScore) {
        localStorage.setItem('quiz-highscore', AppState.score);
        UI.highScoreMsg.classList.remove('hidden');
    } else {
        UI.highScoreMsg.classList.add('hidden');
    }

    switchScreen(Screens.quiz, Screens.result);
}

function restartQuiz() {
    switchScreen(Screens.result, Screens.start);
    stopConfetti();
}

function goHome() {
    location.reload();
}

function showReviewScreen() {
    UI.reviewContainer.innerHTML = '';

    AppState.userAnswers.forEach((answer, index) => {
        const item = document.createElement('div');
        item.className = `review-item ${answer.isCorrect ? 'correct' : 'incorrect'}`;

        item.innerHTML = `
            <div class="review-question">${index + 1}. ${answer.question}</div>
            <div class="review-answer your-ans">You: ${answer.selected} ${answer.isCorrect ? '✅' : '❌'}</div>
            ${!answer.isCorrect ? `<div class="review-answer correct-ans">Correct: ${answer.correct}</div>` : ''}
        `;

        UI.reviewContainer.appendChild(item);
    });

    switchScreen(Screens.result, Screens.review);
}

/* ==========================================================================
   5. UTILITIES (Timer, Helpers, Sound)
   ========================================================================== */
function startTimer() {
    AppState.timeLeft = AppState.maxTime;
    updateTimerUI();

    clearInterval(AppState.timer);

    AppState.timer = setInterval(() => {
        AppState.timeLeft--;
        updateTimerUI();

        if (AppState.timeLeft <= 0) {
            clearInterval(AppState.timer);
            handleTimeOut();
        }
    }, 1000);
}

function updateTimerUI() {
    UI.timerText.textContent = AppState.timeLeft;

    const circumference = 283;
    const offset = circumference - (AppState.timeLeft / AppState.maxTime) * circumference;

    UI.timerCircle.style.strokeDashoffset = offset;

    if (AppState.timeLeft <= 5) {
        UI.timerCircle.style.stroke = 'var(--error-color)';
    } else {
        UI.timerCircle.style.stroke = 'var(--primary-color)';
    }
}

function handleTimeOut() {
    if (AppState.hasAnswered) return;

    // Handle timeout as incorrect + pass null as selection
    const currentQ = AppState.questions[AppState.currentQuestionIndex];

    // Show correct answer visually before moving on
    const correctOption = Array.from(UI.optionsContainer.children).find(
        opt => opt.dataset.value === currentQ.correct_answer
    );

    // We call handleAnswerSelection with null to trigger logic
    handleAnswerSelection(null);

    // Need to manually add visual feedback because handleAnswerSelection handles null gracefully but DOES NOT find a 'selectedOption' to style
    if (correctOption) correctOption.classList.add('correct');
}

function switchScreen(from, to) {
    from.classList.remove('active-screen');
    from.classList.add('hidden');

    setTimeout(() => {
        to.classList.remove('hidden');
        requestAnimationFrame(() => {
            to.classList.add('active-screen');
        });
    }, 50);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

// Simple Audio Synthesis
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!AppState.isSoundOn) return;

    // Resume context if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'incorrect') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2); // Arpeggio
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'finish') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

function generateFallbackQuestions() {
    return [
        {
            question: "What is the capital of France?",
            correct_answer: "Paris",
            options: ["London", "Berlin", "Paris", "Madrid"]
        },
        {
            question: "Which planet is known as the Red Planet?",
            correct_answer: "Mars",
            options: ["Mars", "Venus", "Jupiter", "Saturn"]
        },
        {
            question: "What is 2 + 2?",
            correct_answer: "4",
            options: ["3", "4", "5", "6"]
        }
    ];
}

/* ==========================================================================
   6. EFFECTS (Confetti)
   ========================================================================== */
// Simple Confetti Implementation
let confettiInterval;

function launchConfetti() {
    const canvas = UI.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#4299e1', '#9f7aea', '#ed64a6'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 5 + 2,
            angle: Math.random() * 360
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pieces.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle * Math.PI / 180);
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();

            p.y += p.speed;
            p.angle += 5;

            if (p.y > canvas.height) {
                p.y = -10;
                p.x = Math.random() * canvas.width;
            }
        });
    }

    confettiInterval = setInterval(draw, 20);

    // Stop after 5 seconds
    setTimeout(stopConfetti, 5000);
}

function stopConfetti() {
    clearInterval(confettiInterval);
    const canvas = UI.confettiCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
