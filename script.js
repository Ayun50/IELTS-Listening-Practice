"use strict";

let leftWords = {};
let rightWords = {};
let filteredWords = [];
let currentWordIndex = 0;
let currentWordObject = null;
let correctFirstAttempt = 0;
let totalAttempted = 0;
let hasAttemptedCurrent = false;
let answeredCorrectly = false;
let mode = "check";
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let hasTypedInCurrentList = false;

const themeLeft = document.getElementById("theme-left");
const themeRight = document.getElementById("theme-right");
const letterBoxesDiv = document.getElementById("letter-boxes");
const hiddenInput = document.getElementById("hidden-input");
const speakBtn = document.getElementById("speak-btn");
const actionBtn = document.getElementById("action-btn");
const messageDiv = document.getElementById("message");
const translationDiv = document.getElementById("translation");
const tipDiv = document.getElementById("tip");
const correctSpan = document.getElementById("correct-count");
const totalSpan = document.getElementById("total-attempts");
const accuracySpan = document.getElementById("accuracy");
const showAnswerBtn = document.getElementById("show-answer-btn");
const wordCountSpan = document.getElementById("word-count");
const timerDisplay = document.getElementById("timer-display");

const PLACEHOLDERS = {
    left: "-- 剑桥雅思词汇列表 --",
    right: "-- 主题分类词汇列表 --"
};

init();

async function init() {
    setInteractiveState(false);
    try {
        const response = await fetch("words.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        leftWords = validateWordSet(data.list1, "list1");
        rightWords = validateWordSet(data.list2, "list2");
        populateDropdown(themeLeft, leftWords, PLACEHOLDERS.left);
        populateDropdown(themeRight, rightWords, PLACEHOLDERS.right);
        clearWordDisplay();
    } catch (error) {
        console.error("Error loading words:", error);
        setMessage("词库加载失败。请确认 words.json 与网页在同一目录，并通过静态服务器打开。", "error");
    }
}

function validateWordSet(wordSet, label) {
    if (!wordSet || typeof wordSet !== "object" || Array.isArray(wordSet)) {
        throw new Error(`${label} must be an object`);
    }
    const normalized = {};
    for (const [theme, words] of Object.entries(wordSet)) {
        if (!Array.isArray(words)) {
            console.warn(`Skipped invalid theme: ${theme}`);
            continue;
        }
        const seen = new Set();
        normalized[theme] = words.flatMap((item, index) => {
            if (!item || typeof item.word !== "string" || !item.word.trim()) {
                console.warn(`Skipped invalid item ${theme}[${index}]`);
                return [];
            }
            const word = item.word.trim();
            const key = word.toLocaleLowerCase("en");
            if (seen.has(key)) {
                console.warn(`Skipped duplicate word in ${theme}: ${word}`);
                return [];
            }
            seen.add(key);
            const variants = Array.isArray(item.variants) ? item.variants : [word];
            const cleanVariants = [...new Set([word, ...variants]
                .filter(v => typeof v === "string" && v.trim())
                .map(v => v.trim()))];
            return [{
                word,
                translation: typeof item.translation === "string" ? item.translation : "",
                tip: typeof item.tip === "string" ? item.tip : "",
                caseSensitive: item.caseSensitive === true,
                variants: cleanVariants
            }];
        });
    }
    return normalized;
}

function populateDropdown(selectElement, wordSet, placeholder) {
    selectElement.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.disabled = true;
    first.selected = true;
    first.textContent = placeholder;
    selectElement.appendChild(first);
    Object.keys(wordSet).forEach(theme => {
        const option = document.createElement("option");
        option.value = theme;
        option.textContent = theme;
        selectElement.appendChild(option);
    });
}

themeLeft.addEventListener("change", event => {
    themeRight.value = "";
    loadThemeWords(leftWords[event.target.value] || [], event.target.value);
});

themeRight.addEventListener("change", event => {
    themeLeft.value = "";
    loadThemeWords(rightWords[event.target.value] || [], event.target.value);
});

letterBoxesDiv.addEventListener("click", () => {
    if (!hiddenInput.disabled) hiddenInput.focus();
});

speakBtn.addEventListener("click", () => {
    if (!speakBtn.disabled && currentWordObject) speakWord(currentWordObject.word);
});

actionBtn.addEventListener("click", () => {
    if (mode === "check") checkAnswer();
    else if (mode === "next") goToNextWord();
    else if (mode === "restart") restartCurrentTheme();
});

showAnswerBtn.addEventListener("click", revealAnswer);

hiddenInput.addEventListener("input", () => {
    const maxLength = Math.max(...getVariants().map(v => v.length), 1);
    if (hiddenInput.value.length > maxLength) hiddenInput.value = hiddenInput.value.slice(0, maxLength);
    renderLetterBoxes(selectDisplayVariant(hiddenInput.value), hiddenInput.value);
    if (!hasTypedInCurrentList && filteredWords.length) {
        hasTypedInCurrentList = true;
        startTimer();
    }
});

hiddenInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (mode === "check" && !answeredCorrectly) checkAnswer();
    else if (mode === "next") goToNextWord();
    else if (mode === "restart") restartCurrentTheme();
});

function loadThemeWords(wordArray, themeName) {
    filteredWords = wordArray.map(word => ({ ...word, theme: themeName }));
    shuffleArray(filteredWords);
    resetStats();
    resetTimer();
    currentWordIndex = 0;
    updateWordCount();
    if (filteredWords.length) loadWord(0);
    else {
        clearWordDisplay();
        setMessage("这个词库目前没有有效词汇。", "error");
    }
}

function loadWord(index) {
    currentWordObject = filteredWords[index] || null;
    if (!currentWordObject) return;
    hasAttemptedCurrent = false;
    answeredCorrectly = false;
    mode = "check";
    hiddenInput.value = "";
    hiddenInput.disabled = false;
    actionBtn.disabled = false;
    actionBtn.textContent = "Check";
    showAnswerBtn.disabled = false;
    speakBtn.disabled = false;
    translationDiv.textContent = "";
    tipDiv.textContent = "";
    setMessage("");
    renderLetterBoxes(currentWordObject.word, "");
    hiddenInput.focus();
    speakWord(currentWordObject.word);
}

function getVariants() {
    return currentWordObject?.variants?.length ? currentWordObject.variants : (currentWordObject ? [currentWordObject.word] : []);
}

function selectDisplayVariant(input) {
    const variants = getVariants();
    if (!variants.length) return "";
    const normalized = currentWordObject.caseSensitive ? input : input.toLocaleLowerCase("en");
    const prefixMatch = variants.find(variant => {
        const candidate = currentWordObject.caseSensitive ? variant : variant.toLocaleLowerCase("en");
        return candidate.startsWith(normalized);
    });
    if (prefixMatch) return prefixMatch;
    return variants.find(v => v.length === input.length) || currentWordObject.word;
}

function renderLetterBoxes(pattern, value) {
    letterBoxesDiv.innerHTML = "";
    const row = document.createElement("div");
    row.className = "word-row";
    [...pattern].forEach((char, index) => {
        const box = document.createElement("span");
        box.className = "letter-box";
        if (char === " ") {
            box.dataset.space = "true";
            box.textContent = value[index] === " " || !value[index] ? "·" : value[index];
        } else {
            box.textContent = value[index] || "";
        }
        row.appendChild(box);
    });
    letterBoxesDiv.appendChild(row);
}

function checkAnswer() {
    if (!currentWordObject || mode !== "check" || answeredCorrectly) return;
    const userAnswer = hiddenInput.value.trim();
    tipDiv.textContent = currentWordObject.tip ? `💡 Tip: ${currentWordObject.tip}` : "";
    const firstAttempt = !hasAttemptedCurrent;
    if (firstAttempt) {
        totalAttempted += 1;
        hasAttemptedCurrent = true;
    }
    const matches = getVariants().some(variant => currentWordObject.caseSensitive
        ? userAnswer === variant
        : userAnswer.toLocaleLowerCase("en") === variant.toLocaleLowerCase("en"));
    if (matches) {
        if (firstAttempt) correctFirstAttempt += 1;
        answeredCorrectly = true;
        translationDiv.textContent = currentWordObject.translation;
        setMessage("✅ 正确！", "success");
        mode = "next";
        actionBtn.textContent = currentWordIndex === filteredWords.length - 1 ? "完成" : "下一个";
        hiddenInput.disabled = true;
        showAnswerBtn.disabled = true;
        actionBtn.focus();
    } else {
        const lengths = [...new Set(getVariants().map(v => v.length))];
        const lengthText = lengths.length === 1 ? `${lengths[0]} 个字符` : `${lengths.join(" 或 ")} 个字符`;
        setMessage(userAnswer.length && !lengths.includes(userAnswer.length)
            ? `长度应为 ${lengthText}`
            : "❌ 错误，再试一次", "error");
        hiddenInput.value = "";
        renderLetterBoxes(currentWordObject.word, "");
        hiddenInput.focus();
    }
    updateStats();
}

function revealAnswer() {
    if (!currentWordObject || showAnswerBtn.disabled) return;
    hiddenInput.value = currentWordObject.word;
    renderLetterBoxes(currentWordObject.word, currentWordObject.word);
    translationDiv.textContent = currentWordObject.translation;
    tipDiv.textContent = currentWordObject.tip ? `💡 Tip: ${currentWordObject.tip}` : "";
    setMessage(`答案：${getVariants().join(" / ")}`, "success");
    answeredCorrectly = true;
    mode = "next";
    hiddenInput.disabled = true;
    showAnswerBtn.disabled = true;
    actionBtn.textContent = currentWordIndex === filteredWords.length - 1 ? "完成" : "下一个";
    actionBtn.focus();
}

function goToNextWord() {
    if (currentWordIndex >= filteredWords.length - 1) {
        finishSession();
        return;
    }
    currentWordIndex += 1;
    loadWord(currentWordIndex);
}

function finishSession() {
    stopTimer();
    mode = "restart";
    hiddenInput.disabled = true;
    speakBtn.disabled = true;
    showAnswerBtn.disabled = true;
    actionBtn.disabled = false;
    actionBtn.textContent = "重新练习";
    setMessage(`🎉 本轮完成！共 ${filteredWords.length} 个词，用时 ${timerDisplay.textContent}。`, "success");
}

function restartCurrentTheme() {
    if (!filteredWords.length) return;
    shuffleArray(filteredWords);
    resetStats();
    resetTimer();
    currentWordIndex = 0;
    loadWord(0);
}

function clearWordDisplay() {
    currentWordObject = null;
    filteredWords = [];
    currentWordIndex = 0;
    letterBoxesDiv.innerHTML = "";
    hiddenInput.value = "";
    translationDiv.textContent = "";
    tipDiv.textContent = "";
    setMessage("");
    wordCountSpan.textContent = "0";
    setInteractiveState(false);
}

function setInteractiveState(enabled) {
    actionBtn.disabled = !enabled;
    showAnswerBtn.disabled = !enabled;
    speakBtn.disabled = !enabled;
    hiddenInput.disabled = !enabled;
}

function setMessage(text, type = "") {
    messageDiv.textContent = text;
    messageDiv.classList.remove("error", "success");
    if (type) messageDiv.classList.add(type);
}

function resetStats() {
    correctFirstAttempt = 0;
    totalAttempted = 0;
    updateStats();
}

function updateStats() {
    correctSpan.textContent = String(correctFirstAttempt);
    totalSpan.textContent = String(totalAttempted);
    accuracySpan.textContent = totalAttempted ? String(Math.round(correctFirstAttempt / totalAttempted * 100)) : "0";
}

function updateWordCount() {
    wordCountSpan.textContent = String(filteredWords.length);
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = window.setInterval(() => {
        timerSeconds += 1;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval !== null) window.clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
}

function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    hasTypedInCurrentList = false;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function speakWord(word) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        speakBtn.disabled = true;
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-GB";
    utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.toLowerCase().startsWith("en-gb"))
        || voices.find(v => v.lang.toLowerCase().startsWith("en"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
}
