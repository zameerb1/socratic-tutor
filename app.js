/**
 * Socratic Science Tutor
 * An AI-powered tutoring system that uses the Socratic method to help students
 * discover knowledge through guided questioning rather than direct lecturing.
 *
 * Uses OpenAI GPT-4o for chat and Whisper for voice input.
 */

// ============================================================================
// Session State Management
// ============================================================================

const SessionState = {
    apiKey: null,
    studentName: '',
    gradeLevel: 6,
    currentTopic: null,
    questionCount: 0,
    conversationHistory: [],
    assessmentData: {
        responses: [],
        strengths: [],
        areasToImprove: [],
        conceptsExplored: {},
        confidenceLevels: [],
        overallEngagement: 'moderate'
    },
    scoreData: {
        scores: [],
        hintsUsed: 0,
        currentScore: null
    },
    // Adaptive difficulty tracking
    difficultyLevel: 'medium', // 'easy', 'medium', 'hard', 'challenge'
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
    // Concept mastery tracking
    conceptMastery: {}, // { "concept name": { score: 0-100, status: "high"|"medium"|"low"|"new" } }
    // Free-form topic discovery
    freeFormDescription: '',
    suggestedSubTopics: [],     // Array of { id, label, description, matchedTopicKeys }
    selectedSubTopics: [],       // Array of selected sub-topic objects
    selectedFocusAreas: []       // Array of selected sub-topic labels for prompts
};

// Curriculum content for current session
let sessionCurriculum = '';

/**
 * Fetch relevant curriculum content from static JSON file for the current topic and grade.
 * Loads curriculum.json, filters by topic and grade, combines matching items.
 * Truncates combined content to 8000 chars max.
 */
async function fetchRelevantCurriculum(topicKey, gradeLevel) {
    try {
        console.log(`Fetching curriculum for topic=${topicKey}, grade=${gradeLevel}`);
        const response = await fetch('curriculum.json');
        if (!response.ok) {
            console.log('No curriculum.json found, proceeding without curriculum');
            return '';
        }

        const data = await response.json();
        const items = data.items || [];

        let combinedContent = '';
        let matchCount = 0;

        items.forEach(item => {
            if (item.isActive &&
                item.topics && item.topics.includes(topicKey) &&
                item.grades && item.grades.includes(gradeLevel)) {
                matchCount++;
                combinedContent += `\n--- ${item.title} ---\n${item.content}\n`;
            }
        });

        console.log(`Found ${matchCount} curriculum documents matching topic and grade`);

        if (combinedContent.length > 8000) {
            combinedContent = combinedContent.substring(0, 8000) + '\n[...truncated]';
        }

        return combinedContent.trim();
    } catch (error) {
        console.error('Error fetching curriculum:', error);
        return '';
    }
}

// Topic definitions with starting concepts and progression paths
const ScienceTopics = {
    'solar-system': {
        name: 'Solar System',
        icon: '&#127759;',
        startingConcepts: ['what is the solar system', 'planets', 'the Sun'],
        progressionPath: ['planet types', 'orbits', 'moons', 'asteroids', 'gravity', 'distance and scale'],
        gradeExpectations: {
            5: ['name planets', 'understand Sun is a star', 'day/night cycle'],
            6: ['planet order', 'inner vs outer planets', 'basic gravity'],
            7: ['orbital mechanics basics', 'planet characteristics', 'moons'],
            8: ['gravitational forces', 'space exploration', 'solar system formation']
        }
    },
    'human-body': {
        name: 'Human Body',
        icon: '&#129728;',
        startingConcepts: ['body systems', 'organs', 'how we stay alive'],
        progressionPath: ['circulatory system', 'respiratory system', 'digestive system', 'nervous system', 'skeletal system'],
        gradeExpectations: {
            5: ['major organs', 'basic functions', 'healthy habits'],
            6: ['organ systems', 'how systems work together', 'cells'],
            7: ['cellular processes', 'system interactions', 'homeostasis'],
            8: ['complex system interactions', 'genetics basics', 'disease and immunity']
        }
    },
    'ecosystems': {
        name: 'Ecosystems',
        icon: '&#127795;',
        startingConcepts: ['what is an ecosystem', 'living things', 'environment'],
        progressionPath: ['food chains', 'food webs', 'producers and consumers', 'decomposers', 'energy flow', 'biomes'],
        gradeExpectations: {
            5: ['living vs non-living', 'basic food chains', 'habitats'],
            6: ['food webs', 'producer/consumer/decomposer', 'adaptation'],
            7: ['energy transfer', 'ecosystem balance', 'human impact'],
            8: ['biogeochemical cycles', 'population dynamics', 'biodiversity']
        }
    },
    'matter-chemistry': {
        name: 'Matter & Chemistry',
        icon: '&#129514;',
        startingConcepts: ['what is matter', 'states of matter', 'what things are made of'],
        progressionPath: ['solids liquids gases', 'atoms', 'molecules', 'elements', 'compounds', 'chemical reactions'],
        gradeExpectations: {
            5: ['states of matter', 'physical properties', 'mixtures'],
            6: ['atoms and molecules', 'elements', 'physical vs chemical changes'],
            7: ['periodic table basics', 'compounds', 'simple reactions'],
            8: ['atomic structure', 'chemical bonds', 'reaction types']
        }
    },
    'forces-motion': {
        name: 'Forces & Motion',
        icon: '&#128640;',
        startingConcepts: ['what makes things move', 'forces', 'speed'],
        progressionPath: ['push and pull', 'gravity', 'friction', 'acceleration', 'Newton\'s laws', 'momentum'],
        gradeExpectations: {
            5: ['push/pull forces', 'gravity basics', 'simple machines'],
            6: ['balanced/unbalanced forces', 'speed and velocity', 'friction'],
            7: ['Newton\'s laws', 'acceleration', 'force calculations'],
            8: ['momentum', 'work and energy', 'complex force interactions']
        }
    },
    'electricity': {
        name: 'Electricity',
        icon: '&#9889;',
        startingConcepts: ['what is electricity', 'how we use electricity', 'circuits'],
        progressionPath: ['electric charge', 'circuits', 'conductors and insulators', 'current and voltage', 'magnetism'],
        gradeExpectations: {
            5: ['static electricity', 'simple circuits', 'safety'],
            6: ['conductors/insulators', 'series and parallel circuits', 'switches'],
            7: ['current, voltage, resistance', 'Ohm\'s law basics', 'electromagnets'],
            8: ['electrical calculations', 'electromagnetic spectrum', 'generators']
        }
    },
    'weather-climate': {
        name: 'Weather & Climate',
        icon: '&#127780;',
        startingConcepts: ['weather vs climate', 'what causes weather', 'atmosphere'],
        progressionPath: ['water cycle', 'air pressure', 'wind', 'clouds', 'weather patterns', 'climate zones'],
        gradeExpectations: {
            5: ['water cycle', 'types of weather', 'seasons'],
            6: ['atmosphere layers', 'air pressure and wind', 'cloud types'],
            7: ['weather systems', 'climate factors', 'severe weather'],
            8: ['global circulation', 'climate change', 'weather prediction']
        }
    },
    'cells-life': {
        name: 'Cells & Life',
        icon: '&#129440;',
        startingConcepts: ['what are cells', 'living things', 'what makes something alive'],
        progressionPath: ['cell parts', 'plant vs animal cells', 'cell functions', 'cell division', 'genetics basics'],
        gradeExpectations: {
            5: ['cells are building blocks', 'microscopes', 'living characteristics'],
            6: ['cell organelles', 'plant vs animal cells', 'single vs multi-celled'],
            7: ['cell processes', 'photosynthesis and respiration', 'cell division'],
            8: ['DNA and genes', 'protein synthesis basics', 'heredity']
        }
    }
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Screens
    setupScreen: document.getElementById('setup-screen'),
    topicScreen: document.getElementById('topic-screen'),
    chatScreen: document.getElementById('chat-screen'),
    summaryScreen: document.getElementById('summary-screen'),
    loadingOverlay: document.getElementById('loading-overlay'),

    // Setup
    apiKeyInput: document.getElementById('api-key'),
    apiKeyLabel: document.getElementById('api-key-label'),
    saveApiKeyCheckbox: document.getElementById('save-api-key'),
    studentNameInput: document.getElementById('student-name'),
    gradeLevelSelect: document.getElementById('grade-level'),
    startSessionBtn: document.getElementById('start-session'),

    // Topic Discovery — Step 1
    topicStepDescribe: document.getElementById('topic-step-describe'),
    topicDescription: document.getElementById('topic-description'),
    topicRecordBtn: document.getElementById('topic-record-btn'),
    topicVoiceControls: document.getElementById('topic-voice-controls'),
    topicVoicePause: document.getElementById('topic-voice-pause'),
    topicVoiceSend: document.getElementById('topic-voice-send'),
    findTopicsBtn: document.getElementById('find-topics-btn'),

    // Topic Discovery — Step 2
    topicStepSelect: document.getElementById('topic-step-select'),
    topicSelectSubtitle: document.getElementById('topic-select-subtitle'),
    suggestedTopicsGrid: document.getElementById('suggested-topics-grid'),
    topicBackBtn: document.getElementById('topic-back-btn'),
    startLearningBtn: document.getElementById('start-learning-btn'),

    // Chat
    currentTopicDisplay: document.getElementById('current-topic-display'),
    questionCount: document.getElementById('question-count'),
    chatContainer: document.getElementById('chat-container'),
    studentResponse: document.getElementById('student-response'),
    sendResponseBtn: document.getElementById('send-response'),
    needHintBtn: document.getElementById('need-hint'),
    endSessionBtn: document.getElementById('end-session-btn'),
    recordBtn: document.getElementById('record-btn'),

    // Chat Voice Controls
    chatVoiceControls: document.getElementById('chat-voice-controls'),
    chatVoicePause: document.getElementById('chat-voice-pause'),
    chatVoiceSend: document.getElementById('chat-voice-send'),

    // Concept Tracker
    conceptTracker: document.getElementById('concept-tracker'),
    conceptChips: document.getElementById('concept-chips'),
    scoreFeedback: document.getElementById('score-feedback'),
    toggleTrackerBtn: document.getElementById('toggle-tracker'),
    conceptTrackerBody: document.getElementById('concept-tracker-body'),

    // Summary
    summaryIntro: document.getElementById('summary-intro'),
    strengthsList: document.getElementById('strengths-list'),
    improvementsList: document.getElementById('improvements-list'),
    nextStepsList: document.getElementById('next-steps-list'),
    knowledgeMapContainer: document.getElementById('knowledge-map-container'),
    downloadSummaryBtn: document.getElementById('download-summary'),
    newSessionBtn: document.getElementById('new-session')
};

// ============================================================================
// Screen Navigation
// ============================================================================

function showScreen(screenName) {
    const screens = ['setup', 'topic', 'chat', 'summary'];
    screens.forEach(name => {
        const screen = document.getElementById(`${name}-screen`);
        if (screen) {
            screen.classList.toggle('hidden', name !== screenName);
        }
    });
}

function showLoading(show = true, text = 'Thinking...') {
    elements.loadingOverlay.classList.toggle('hidden', !show);
    elements.loadingOverlay.querySelector('.loading-text').textContent = text;
}

// ============================================================================
// API Key Management (Session-based, cleared on end)
// ============================================================================

function storeApiKey(key) {
    SessionState.apiKey = key;
    sessionStorage.setItem('socratic_session_active', 'true');
}

function clearApiKey() {
    SessionState.apiKey = null;
    sessionStorage.removeItem('socratic_session_active');
}

function hasValidApiKey() {
    if (!SessionState.apiKey) return false;
    return SessionState.apiKey.startsWith('sk-');
}

// ============================================================================
// API Key Encryption (for local storage)
// ============================================================================

function encryptApiKey(apiKey) {
    const salt = 'socratic-tutor-v1';
    let encrypted = '';
    for (let i = 0; i < apiKey.length; i++) {
        encrypted += String.fromCharCode(
            apiKey.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
        );
    }
    return btoa(encrypted);
}

function decryptApiKey(encrypted) {
    const salt = 'socratic-tutor-v1';
    const decoded = atob(encrypted);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(
            decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
        );
    }
    return decrypted;
}

function saveApiKeyLocally(apiKey) {
    const encrypted = encryptApiKey(apiKey);
    localStorage.setItem('socratic_api_key_openai', encrypted);
}

function loadApiKeyLocally() {
    const encrypted = localStorage.getItem('socratic_api_key_openai');
    if (encrypted) {
        try {
            return decryptApiKey(encrypted);
        } catch (e) {
            console.error('Failed to decrypt API key');
            return null;
        }
    }
    return null;
}

function clearSavedApiKey() {
    localStorage.removeItem('socratic_api_key_openai');
}

// ============================================================================
// AI API Integration (OpenAI Only)
// ============================================================================

async function callAI(messages, systemPrompt) {
    if (!hasValidApiKey()) {
        throw new Error('Invalid API key');
    }

    const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SessionState.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 1024,
            messages: openaiMessages
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// ============================================================================
// Adaptive Difficulty
// ============================================================================

function updateDifficultyLevel(score) {
    if (score === null) return;

    const prevLevel = SessionState.difficultyLevel;

    if (score >= 80) {
        SessionState.consecutiveHighScores++;
        SessionState.consecutiveLowScores = 0;
    } else if (score < 50) {
        SessionState.consecutiveLowScores++;
        SessionState.consecutiveHighScores = 0;
    } else {
        SessionState.consecutiveHighScores = 0;
        SessionState.consecutiveLowScores = 0;
    }

    const levels = ['easy', 'medium', 'hard', 'challenge'];
    const currentIndex = levels.indexOf(SessionState.difficultyLevel);

    if (SessionState.consecutiveHighScores >= 3 && currentIndex < levels.length - 1) {
        SessionState.difficultyLevel = levels[currentIndex + 1];
        SessionState.consecutiveHighScores = 0;
        console.log(`[Difficulty] Ramped UP: ${prevLevel} -> ${SessionState.difficultyLevel}`);
    }

    if (SessionState.consecutiveLowScores >= 2 && currentIndex > 0) {
        SessionState.difficultyLevel = levels[currentIndex - 1];
        SessionState.consecutiveLowScores = 0;
        console.log(`[Difficulty] Ramped DOWN: ${prevLevel} -> ${SessionState.difficultyLevel}`);
    }

    console.log(`[Difficulty] Level: ${SessionState.difficultyLevel}, consecutiveHigh: ${SessionState.consecutiveHighScores}, consecutiveLow: ${SessionState.consecutiveLowScores}`);
}

// ============================================================================
// Topic Discovery — AI-powered sub-topic suggestions
// ============================================================================

/**
 * Sends the student's free-form description to GPT-4o and asks for 8-12 specific
 * sub-topics as JSON. Each sub-topic has { id, label, description, matchedTopicKeys[] }.
 */
async function discoverTopics(description) {
    console.log(`[TopicDiscovery] Student description: "${description}"`);

    const availableTopicKeys = Object.keys(ScienceTopics);
    const topicList = availableTopicKeys.map(k => `"${k}" (${ScienceTopics[k].name})`).join(', ');

    const systemPrompt = `You are a helpful science education assistant. A ${SessionState.gradeLevel}th grade student has described what they want to learn. Your job is to suggest 8-12 specific, focused sub-topics that match their interest.

Available science topic categories for curriculum matching: ${topicList}

Return ONLY valid JSON (no markdown code fences) with this structure:
{
    "subtopics": [
        {
            "id": "unique-slug",
            "label": "Short Topic Name (2-5 words)",
            "description": "One sentence explaining what this sub-topic covers",
            "matchedTopicKeys": ["closest-matching-key"]
        }
    ]
}

Guidelines:
- Suggest 8-12 sub-topics that are specific and interesting for a ${SessionState.gradeLevel}th grader
- Each sub-topic should be focused enough for a 10-15 minute tutoring session
- matchedTopicKeys should contain 1-2 keys from the available categories that best match this sub-topic
- If the student's description is vague, interpret broadly and suggest diverse sub-topics
- Make descriptions encouraging and age-appropriate
- Labels should be concise and engaging`;

    const messages = [{
        role: 'user',
        content: `The student says: "${description}"\n\nSuggest specific sub-topics they can explore.`
    }];

    try {
        showLoading(true, 'Finding topics for you...');
        const response = await callAI(messages, systemPrompt);
        console.log('[TopicDiscovery] Raw response:', response);

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in topic discovery response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const subtopics = parsed.subtopics || [];

        console.log(`[TopicDiscovery] Got ${subtopics.length} sub-topics`);
        return subtopics;
    } catch (error) {
        console.error('[TopicDiscovery] Error:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

/**
 * Renders the suggested sub-topics as selectable chip cards in the grid.
 */
function renderSuggestedTopics(subtopics) {
    elements.suggestedTopicsGrid.innerHTML = '';
    SessionState.suggestedSubTopics = subtopics;
    SessionState.selectedSubTopics = [];
    SessionState.selectedFocusAreas = [];

    subtopics.forEach((st, index) => {
        const chip = document.createElement('button');
        chip.className = 'suggested-topic-chip';
        chip.dataset.index = index;
        chip.innerHTML = `
            <div class="chip-check">&#10003;</div>
            <div class="chip-label">${st.label}</div>
            <div class="chip-desc">${st.description}</div>
        `;

        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            updateSelectedSubTopics();
        });

        elements.suggestedTopicsGrid.appendChild(chip);
    });

    updateSelectedSubTopics();
}

/**
 * Updates the SessionState with currently selected sub-topics and enables/disables Start Learning.
 */
function updateSelectedSubTopics() {
    const selectedChips = elements.suggestedTopicsGrid.querySelectorAll('.suggested-topic-chip.selected');
    const indices = Array.from(selectedChips).map(c => parseInt(c.dataset.index));

    SessionState.selectedSubTopics = indices.map(i => SessionState.suggestedSubTopics[i]);
    SessionState.selectedFocusAreas = SessionState.selectedSubTopics.map(st => st.label);

    elements.startLearningBtn.disabled = SessionState.selectedSubTopics.length === 0;

    console.log(`[TopicDiscovery] Selected ${SessionState.selectedSubTopics.length} sub-topics:`, SessionState.selectedFocusAreas);
}

/**
 * Determines the primary topic key from selected sub-topics (most frequently matched).
 */
function determinePrimaryTopic() {
    const keyCount = {};
    SessionState.selectedSubTopics.forEach(st => {
        (st.matchedTopicKeys || []).forEach(key => {
            if (ScienceTopics[key]) {
                keyCount[key] = (keyCount[key] || 0) + 1;
            }
        });
    });

    // Find the most frequently matched key
    let bestKey = null;
    let bestCount = 0;
    Object.entries(keyCount).forEach(([key, count]) => {
        if (count > bestCount) {
            bestCount = count;
            bestKey = key;
        }
    });

    // Fallback to first matched key from first selected sub-topic
    if (!bestKey && SessionState.selectedSubTopics.length > 0) {
        const firstKeys = SessionState.selectedSubTopics[0].matchedTopicKeys || [];
        bestKey = firstKeys.find(k => ScienceTopics[k]) || Object.keys(ScienceTopics)[0];
    }

    console.log(`[TopicDiscovery] Primary topic: ${bestKey} (matched ${bestCount} times)`);
    return bestKey || 'solar-system';
}

// ============================================================================
// Socratic Tutoring Engine
// ============================================================================

function buildSystemPrompt() {
    const topic = ScienceTopics[SessionState.currentTopic];
    const gradeExpectations = topic.gradeExpectations[SessionState.gradeLevel] || topic.gradeExpectations[6];

    let difficultyInstructions = '';
    if (SessionState.consecutiveHighScores >= 2) {
        difficultyInstructions = `\nThe student has answered ${SessionState.consecutiveHighScores} questions well in a row. Push harder! Ask more complex questions. Challenge their thinking. Do NOT keep asking easy questions.`;
    } else if (SessionState.consecutiveLowScores >= 1) {
        difficultyInstructions = `\nThe student has been struggling recently. Scale back. Use simpler language and more relatable examples. Build their confidence.`;
    }

    // Build focus areas section if we have free-form discovery data
    let focusSection = '';
    if (SessionState.selectedFocusAreas.length > 0) {
        focusSection = `\n\nSTUDENT'S CHOSEN FOCUS AREAS: ${SessionState.selectedFocusAreas.join(', ')}`;
        if (SessionState.freeFormDescription) {
            focusSection += `\nSTUDENT'S ORIGINAL INTEREST: "${SessionState.freeFormDescription}"`;
        }
        focusSection += `\nFocus your questions on these specific areas. Use them to guide the progression of topics.`;
    }

    return `You are a Socratic science tutor helping ${SessionState.studentName}, a ${SessionState.gradeLevel}th grade student, learn about ${topic.name}.${focusSection}

CORE PRINCIPLES - FOLLOW THESE EXACTLY:

1. SOCRATIC METHOD: Never lecture. Always ask questions that guide the student to discover answers themselves.

2. ADAPTIVE QUESTIONING:
   - Analyze the student's response for understanding level, confidence, and enthusiasm
   - If they seem uncertain or give a weak answer, ask an EASIER question they can likely answer correctly
   - If they answer well, gradually increase complexity
   - Build on what they know, don't jump to unknown territory

3. BRIEF RESPONSES: Keep your responses SHORT (2-3 sentences max). Give tiny tidbits of info only when absolutely necessary to scaffold understanding. Never give long explanations.

4. ENCOURAGEMENT CALIBRATION:
   - If the student seems less confident, give genuine encouragement and ask something they can succeed at
   - If they're doing well, acknowledge briefly and challenge them slightly more
   - Always maintain a warm, supportive tone

5. RESPONSE FORMAT:
   Start with a brief reaction (1 sentence), then ask your next question.
   Example: "Interesting thinking! You mentioned the Sun - what do you think the Sun actually is?"

6. GRADE-APPROPRIATE: For grade ${SessionState.gradeLevel}, expect understanding of: ${gradeExpectations.join(', ')}

7. DETECT CONFIDENCE: Look for signals in their response:
   - Uncertain: "I think...", "maybe...", "I'm not sure...", short answers, question marks
   - Confident: Direct statements, longer explanations, enthusiasm words
   - Struggling: Very short answers, "I don't know", off-topic responses

8. WHEN STUDENT STRUGGLES:
   - Don't give the answer directly
   - Break it down into smaller, easier questions
   - Relate to everyday experiences they'd know
   - Example: If they can't explain gravity, ask "What happens when you drop a ball?"

9. KNOWLEDGE BUILDING:
   - Start broad, get specific based on their responses
   - Connect new concepts to things they've already shown they know
   - Create "aha moments" through well-crafted questions

10. TRACK CONCEPTS: Mentally note which concepts they understand well vs struggle with.

DIFFICULTY LEVEL: ${SessionState.difficultyLevel.toUpperCase()}
- EASY: Simple recall questions, everyday examples, lots of encouragement
- MEDIUM: Application questions, "why" and "how" questions, moderate scaffolding
- HARD: Analysis questions, connect multiple concepts, minimal hints
- CHALLENGE: Synthesis and evaluation, cross-topic connections, push boundaries
${difficultyInstructions}

IMPORTANT: When the student is doing well, DO NOT keep asking easy questions.
Progressively increase complexity. If they score 80+ three times, move to harder concepts.

Remember: Your goal is to help them DISCOVER knowledge, not receive it. Every response should end with a question.

IMPORTANT - SCORING AND CONCEPT TRACKING: At the very end of EVERY response, you MUST include a hidden assessment block. This is hidden from the student so be honest.

Format (ALL on separate lines at the very end):
[SCORE:XX]
[CONCEPTS:concept1=score1,concept2=score2]
[FEEDBACK:one brief sentence about what the student knows or should focus on]

SCORE: 0-100 for how well the student demonstrated understanding:
- 85-100: Excellent understanding, shows deep thinking
- 70-84: Good understanding, mostly correct reasoning
- 50-69: Partial understanding, some gaps
- 30-49: Limited understanding, struggling
- 0-29: Minimal understanding or off-topic

CONCEPTS: List 1-4 specific concepts discussed so far with individual mastery scores (0-100).
Use short concept names (2-4 words max). Examples: "planet order=85", "gravity basics=60", "cell parts=40"
Update scores for concepts already mentioned if the student shows progress or regression.

FEEDBACK: A brief, encouraging sentence the student WILL see. Examples:
- "You really understand how planets orbit - let's see if you can connect that to gravity!"
- "You're getting closer to understanding food chains - think about where the energy starts."
- "Great start! Let's dig deeper into how circuits work."

For hint requests, score based on the overall conversation context.${sessionCurriculum ? `

CURRICULUM REFERENCE MATERIAL:
Use the following curriculum content to align your questions with what the student is expected to learn at their grade level.
Do NOT quote this material directly to the student. Instead, use it to inform your questioning strategy, ensuring your questions guide the student toward the key concepts and learning objectives outlined here.
${sessionCurriculum}` : ''}`;
}

function buildAssessmentPrompt() {
    const topic = ScienceTopics[SessionState.currentTopic];

    return `You are analyzing a tutoring session for ${SessionState.studentName}, a ${SessionState.gradeLevel}th grade student learning about ${topic.name}.

Based on the conversation, provide a JSON assessment with this EXACT structure:
{
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "areasToImprove": ["area 1", "area 2"],
    "nextSteps": ["specific actionable step 1", "specific actionable step 2", "specific actionable step 3"],
    "conceptMastery": {
        "concept name": percentage (0-100),
        "another concept": percentage
    },
    "overallSummary": "A 2-sentence summary for parents/mentors about how the session went and the student's understanding level."
}

Guidelines:
- Be specific and encouraging in strengths (what exactly did they demonstrate?)
- Be constructive in areas to improve (frame as opportunities, not failures)
- Make next steps actionable and appropriate for a ${SessionState.gradeLevel}th grader
- Concept mastery should reflect demonstrated understanding in the conversation
- Include 4-6 concepts in conceptMastery based on what was discussed
- Keep everything age-appropriate and parent-friendly

IMPORTANT: Return ONLY valid JSON, no other text.`;
}

async function generateTutorResponse(studentMessage, isHintRequest = false) {
    const systemPrompt = buildSystemPrompt();

    SessionState.conversationHistory.push({
        role: 'user',
        content: isHintRequest
            ? `[Student requested a hint] ${studentMessage || "I need help with this question."}`
            : studentMessage
    });

    SessionState.assessmentData.responses.push({
        question: SessionState.conversationHistory.length > 1
            ? SessionState.conversationHistory[SessionState.conversationHistory.length - 2]?.content
            : 'Opening question',
        answer: studentMessage,
        wasHintRequest: isHintRequest
    });

    try {
        showLoading(true, 'Thinking about your answer...');

        const response = await callAI(SessionState.conversationHistory, systemPrompt);
        const { score, cleanResponse } = parseAndUpdateScore(response);
        updateDifficultyLevel(score);

        if (isHintRequest) {
            SessionState.scoreData.hintsUsed++;
        }

        SessionState.conversationHistory.push({
            role: 'assistant',
            content: cleanResponse
        });

        SessionState.questionCount++;
        return cleanResponse;
    } catch (error) {
        console.error('Error calling API:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

async function generateOpeningQuestion() {
    const topic = ScienceTopics[SessionState.currentTopic];
    const systemPrompt = buildSystemPrompt();

    let focusContext = '';
    if (SessionState.selectedFocusAreas.length > 0) {
        focusContext = `\nThe student specifically chose to focus on: ${SessionState.selectedFocusAreas.join(', ')}.
Their original description of what they want to learn: "${SessionState.freeFormDescription}"
Start by connecting to their stated interest.`;
    }

    const openingPrompt = `Start a tutoring session about ${topic.name}.${focusContext}

Greet ${SessionState.studentName} warmly (1 sentence), then ask an open-ended opening question to gauge their current understanding.

The question should:
- Be broad enough that any student can answer something
- Invite them to share what they already know
- Be encouraging and non-intimidating
${SessionState.selectedFocusAreas.length > 0 ? '- Connect to their chosen focus areas' : ''}

Example style: "Hi [name]! Let's explore [topic] together. To start, what comes to mind when you think about [topic]?"

Keep it brief and friendly.`;

    SessionState.conversationHistory.push({
        role: 'user',
        content: openingPrompt
    });

    try {
        showLoading(true, 'Preparing your session...');

        const response = await callAI(SessionState.conversationHistory, systemPrompt);

        SessionState.conversationHistory = [{
            role: 'assistant',
            content: response
        }];

        SessionState.questionCount = 1;
        return response;
    } catch (error) {
        console.error('Error generating opening:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

async function generateSessionSummary() {
    const assessmentPrompt = buildAssessmentPrompt();

    const conversationSummary = SessionState.conversationHistory
        .map((msg, i) => `${msg.role === 'assistant' ? 'Tutor' : 'Student'}: ${msg.content}`)
        .join('\n\n');

    const assessmentMessages = [{
        role: 'user',
        content: `Here is the tutoring conversation to assess:\n\n${conversationSummary}\n\nProvide the JSON assessment.`
    }];

    try {
        showLoading(true, 'Creating your session summary...');

        const response = await callAI(assessmentMessages, assessmentPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid assessment format');
    } catch (error) {
        console.error('Error generating summary:', error);
        return {
            strengths: ['Participated in the learning session', 'Showed willingness to explore the topic'],
            areasToImprove: ['Continue practicing with guided questions'],
            nextSteps: ['Review the concepts discussed today', 'Try explaining what you learned to someone else'],
            conceptMastery: { 'General Understanding': 60 },
            overallSummary: `${SessionState.studentName} participated in a tutoring session about ${ScienceTopics[SessionState.currentTopic].name}. Continue exploring this topic to build deeper understanding.`
        };
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// Chat UI Functions
// ============================================================================

function addMessage(content, type = 'tutor', isHint = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}${isHint ? ' message-hint' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar avatar-${type}`;
    avatar.innerHTML = type === 'tutor' ? '&#129302;' : '&#128100;';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message message-tutor';
    indicator.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'avatar avatar-tutor';
    avatar.innerHTML = '&#129302;';

    const typing = document.createElement('div');
    typing.className = 'message-content typing-indicator';
    typing.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    indicator.appendChild(avatar);
    indicator.appendChild(typing);

    elements.chatContainer.appendChild(indicator);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function updateQuestionCount() {
    elements.questionCount.textContent = `Question ${SessionState.questionCount}`;
}

function parseAndUpdateScore(response) {
    console.log('[Parse] Raw AI response (last 300 chars):', response.slice(-300));

    let score = null;
    let cleanResponse = response;
    let feedback = null;

    const scoreMatch = response.match(/\[SCORE:\s*(\d+)\s*\]/i);
    if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
        SessionState.scoreData.scores.push(score);
        SessionState.scoreData.currentScore = score;
        console.log(`[Parse] Score: ${score}`);
    } else {
        console.warn('[Parse] No [SCORE:XX] tag found in response');
    }

    let conceptsMatch = response.match(/\[CONCEPTS:\s*([^\]]+)\]/i);
    if (conceptsMatch) {
        console.log(`[Parse] Raw concepts string: "${conceptsMatch[1]}"`);
        parseConceptString(conceptsMatch[1]);
    } else {
        console.warn('[Parse] No [CONCEPTS:] tag found, trying fallback patterns');
        const fallbackMatch = response.match(/CONCEPTS:\s*(.+?)(?:\n|\[|$)/i);
        if (fallbackMatch) {
            console.log(`[Parse] Fallback concepts: "${fallbackMatch[1]}"`);
            parseConceptString(fallbackMatch[1]);
        }
    }

    const feedbackMatch = response.match(/\[FEEDBACK:\s*([^\]]+)\]/i);
    if (feedbackMatch) {
        feedback = feedbackMatch[1].trim();
        console.log(`[Parse] Feedback: "${feedback}"`);
    } else {
        const fallbackFeedback = response.match(/FEEDBACK:\s*(.+?)(?:\n|$)/i);
        if (fallbackFeedback) {
            feedback = fallbackFeedback[1].trim();
            console.log(`[Parse] Fallback feedback: "${feedback}"`);
        }
    }

    if (score !== null && Object.keys(SessionState.conceptMastery).length === 0 && SessionState.questionCount > 1) {
        const topicName = ScienceTopics[SessionState.currentTopic]?.name || 'General';
        const status = score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';
        SessionState.conceptMastery[topicName + ' basics'] = { score, status };
        console.log(`[Parse] Auto-generated concept from score: "${topicName} basics" = ${score}`);
    }

    if (score !== null && !feedback) {
        if (score >= 80) feedback = "Great understanding! Keep pushing deeper.";
        else if (score >= 60) feedback = "Good thinking! You're on the right track.";
        else if (score >= 40) feedback = "You're building understanding - keep exploring!";
        else feedback = "Don't worry, we'll work through this together!";
        console.log(`[Parse] Auto-generated feedback: "${feedback}"`);
    }

    cleanResponse = cleanResponse
        .replace(/\[SCORE:\s*\d+\s*\]/gi, '')
        .replace(/\[CONCEPTS:[^\]]*\]/gi, '')
        .replace(/\[FEEDBACK:[^\]]*\]/gi, '')
        .replace(/CONCEPTS:\s*.+?(?=\n|$)/gi, '')
        .replace(/FEEDBACK:\s*.+?(?=\n|$)/gi, '')
        .trim();

    updateConceptTracker(feedback, score);
    return { score, cleanResponse };
}

function parseConceptString(conceptStr) {
    const pairs = conceptStr.split(/[,;]+/);
    pairs.forEach(pair => {
        const match = pair.match(/(.+?)\s*[=:\-]\s*(\d+)/);
        if (match) {
            const name = match[1].trim().replace(/^["']|["']$/g, '');
            const conceptScore = parseInt(match[2], 10);
            if (name && !isNaN(conceptScore) && conceptScore >= 0 && conceptScore <= 100) {
                let status = 'new';
                if (conceptScore >= 70) status = 'high';
                else if (conceptScore >= 50) status = 'medium';
                else if (conceptScore >= 1) status = 'low';

                SessionState.conceptMastery[name] = { score: conceptScore, status };
                console.log(`[Concepts] ${name}: ${conceptScore} (${status})`);
            }
        }
    });
}

function updateConceptTracker(feedback, score) {
    const concepts = SessionState.conceptMastery;
    const conceptKeys = Object.keys(concepts);

    if (conceptKeys.length > 0) {
        elements.conceptTracker.classList.remove('hidden');
    }

    elements.conceptChips.innerHTML = '';
    conceptKeys.forEach(name => {
        const { score: cScore, status } = concepts[name];
        const chip = document.createElement('span');
        chip.className = `concept-chip mastery-${status}`;

        let icon = '';
        if (status === 'high') icon = '&#10003;';
        else if (status === 'medium') icon = '&#8599;';
        else if (status === 'low') icon = '&#10067;';
        else icon = '&#10024;';

        chip.innerHTML = `<span class="chip-icon">${icon}</span>${name}`;
        chip.title = `${name}: ${cScore}%`;
        elements.conceptChips.appendChild(chip);
    });

    if (feedback) {
        elements.scoreFeedback.classList.remove('hidden', 'feedback-great', 'feedback-good', 'feedback-working', 'feedback-struggling');
        elements.scoreFeedback.textContent = feedback;

        if (score >= 80) {
            elements.scoreFeedback.classList.add('feedback-great');
        } else if (score >= 60) {
            elements.scoreFeedback.classList.add('feedback-good');
        } else if (score >= 40) {
            elements.scoreFeedback.classList.add('feedback-working');
        } else if (score !== null) {
            elements.scoreFeedback.classList.add('feedback-struggling');
        } else {
            elements.scoreFeedback.classList.add('feedback-good');
        }
    }
}

function resetConceptTracker() {
    SessionState.conceptMastery = {};
    elements.conceptTracker.classList.add('hidden');
    elements.conceptChips.innerHTML = '';
    elements.scoreFeedback.classList.add('hidden');
    elements.scoreFeedback.textContent = '';
}

// ============================================================================
// Summary UI Functions
// ============================================================================

function displaySummary(assessment) {
    elements.summaryIntro.textContent = assessment.overallSummary;

    elements.strengthsList.innerHTML = '';
    assessment.strengths.forEach(strength => {
        const li = document.createElement('li');
        li.textContent = strength;
        elements.strengthsList.appendChild(li);
    });

    elements.improvementsList.innerHTML = '';
    assessment.areasToImprove.forEach(area => {
        const li = document.createElement('li');
        li.textContent = area;
        elements.improvementsList.appendChild(li);
    });

    elements.nextStepsList.innerHTML = '';
    assessment.nextSteps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        elements.nextStepsList.appendChild(li);
    });

    elements.knowledgeMapContainer.innerHTML = '';
    Object.entries(assessment.conceptMastery).forEach(([concept, percentage]) => {
        const item = document.createElement('div');
        item.className = 'knowledge-map-item';

        const level = percentage >= 70 ? 'high' : percentage >= 40 ? 'medium' : 'low';

        item.innerHTML = `
            <span class="knowledge-label">${concept}</span>
            <div class="knowledge-bar">
                <div class="knowledge-fill ${level}" style="width: ${percentage}%"></div>
            </div>
            <span class="knowledge-percent">${percentage}%</span>
        `;

        elements.knowledgeMapContainer.appendChild(item);
    });
}

function generateDownloadableReport(assessment) {
    const topic = ScienceTopics[SessionState.currentTopic];
    const date = new Date().toLocaleDateString();

    let report = `SOCRATIC SCIENCE TUTOR - SESSION REPORT
========================================

Student: ${SessionState.studentName}
Grade Level: ${SessionState.gradeLevel}th Grade
Topic: ${topic.name}
Date: ${date}
Questions Explored: ${SessionState.questionCount}
${SessionState.selectedFocusAreas.length > 0 ? `Focus Areas: ${SessionState.selectedFocusAreas.join(', ')}\n` : ''}
SUMMARY
-------
${assessment.overallSummary}

STRENGTHS
---------
${assessment.strengths.map(s => `• ${s}`).join('\n')}

AREAS FOR GROWTH
----------------
${assessment.areasToImprove.map(a => `• ${a}`).join('\n')}

RECOMMENDED NEXT STEPS
----------------------
${assessment.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CONCEPT UNDERSTANDING
---------------------
${Object.entries(assessment.conceptMastery).map(([c, p]) => `${c}: ${p}%`).join('\n')}

---
Generated by Socratic Science Tutor
`;

    return report;
}

// ============================================================================
// Voice Input — State Machine (MediaRecorder + OpenAI Whisper)
// ============================================================================

const VoiceState = {
    mediaRecorder: null,
    audioChunks: [],
    micStream: null,
    status: 'idle', // 'idle' | 'recording' | 'paused' | 'transcribing'
    context: null    // 'chat' | 'topic' — which screen initiated the recording
};

/**
 * Checks if voice input is supported in this browser.
 */
function isVoiceSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

/**
 * Initializes voice input. Hides mic buttons if unsupported.
 */
function initVoiceInput() {
    if (!isVoiceSupported()) {
        elements.recordBtn.style.display = 'none';
        elements.topicRecordBtn.style.display = 'none';
        console.log('[Voice] MediaRecorder or getUserMedia not supported in this browser');
        return;
    }
    console.log('[Voice] Voice input initialized (Whisper mode)');
}

/**
 * Starts recording audio from the microphone.
 * @param {'chat'|'topic'} context - Which screen initiated the recording
 */
async function voiceStart(context) {
    if (VoiceState.status !== 'idle') {
        console.warn(`[Voice] Cannot start, current status: ${VoiceState.status}`);
        return;
    }

    VoiceState.context = context;
    console.log(`[Voice] Starting recording, context: ${context}`);

    try {
        VoiceState.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = '';
            }
        }
        console.log(`[Voice] Using MIME type: ${mimeType || '(browser default)'}`);

        VoiceState.mediaRecorder = new MediaRecorder(
            VoiceState.micStream,
            mimeType ? { mimeType } : undefined
        );
        VoiceState.audioChunks = [];

        VoiceState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                VoiceState.audioChunks.push(event.data);
            }
        };

        VoiceState.mediaRecorder.start();
        VoiceState.status = 'recording';
        updateVoiceUI();
        console.log('[Voice] Recording started');
    } catch (err) {
        console.error('[Voice] Error starting recording:', err);
        VoiceState.status = 'idle';
        updateVoiceUI();
        if (err.name === 'NotAllowedError') {
            alert('Microphone access was denied. Please allow microphone access to use voice input.');
        } else {
            alert('Could not start recording. Please check your microphone.');
        }
    }
}

/**
 * Toggles pause/resume on the current recording.
 */
function voicePauseResume() {
    if (VoiceState.status === 'recording' && VoiceState.mediaRecorder) {
        VoiceState.mediaRecorder.pause();
        VoiceState.status = 'paused';
        console.log('[Voice] Paused');
        updateVoiceUI();
    } else if (VoiceState.status === 'paused' && VoiceState.mediaRecorder) {
        VoiceState.mediaRecorder.resume();
        VoiceState.status = 'recording';
        console.log('[Voice] Resumed');
        updateVoiceUI();
    }
}

/**
 * Stops recording, transcribes with Whisper, inserts text, and auto-triggers the action.
 */
async function voiceSend() {
    if (VoiceState.status !== 'recording' && VoiceState.status !== 'paused') {
        console.warn(`[Voice] Cannot send, current status: ${VoiceState.status}`);
        return;
    }

    const context = VoiceState.context;
    VoiceState.status = 'transcribing';
    updateVoiceUI();

    // Stop the MediaRecorder and collect audio
    const audioPromise = new Promise((resolve) => {
        VoiceState.mediaRecorder.onstop = () => {
            // Release mic
            if (VoiceState.micStream) {
                VoiceState.micStream.getTracks().forEach(track => track.stop());
                VoiceState.micStream = null;
            }

            if (VoiceState.audioChunks.length === 0) {
                console.warn('[Voice] No audio data captured');
                resolve(null);
                return;
            }

            const audioBlob = new Blob(VoiceState.audioChunks, {
                type: VoiceState.mediaRecorder.mimeType || 'audio/webm'
            });
            console.log(`[Voice] Recording stopped, blob size: ${audioBlob.size} bytes`);
            resolve(audioBlob);
        };
        VoiceState.mediaRecorder.stop();
    });

    const audioBlob = await audioPromise;

    if (!audioBlob) {
        VoiceState.status = 'idle';
        updateVoiceUI();
        return;
    }

    // Transcribe
    try {
        const transcript = await transcribeAudio(audioBlob);

        if (transcript) {
            if (context === 'chat') {
                // Insert into chat textarea and auto-send
                const currentText = elements.studentResponse.value;
                elements.studentResponse.value = currentText
                    ? currentText + ' ' + transcript
                    : transcript;
                console.log(`[Voice] Chat transcript: "${transcript.substring(0, 100)}..."`);

                VoiceState.status = 'idle';
                updateVoiceUI();

                // Auto-send the message
                handleSendResponse();
            } else if (context === 'topic') {
                // Insert into topic textarea and auto-trigger "Find Topics"
                const currentText = elements.topicDescription.value;
                elements.topicDescription.value = currentText
                    ? currentText + ' ' + transcript
                    : transcript;
                console.log(`[Voice] Topic transcript: "${transcript.substring(0, 100)}..."`);

                VoiceState.status = 'idle';
                updateVoiceUI();

                // Auto-trigger topic discovery
                handleFindTopics();
            }
        } else {
            console.warn('[Voice] Whisper returned empty transcript');
            VoiceState.status = 'idle';
            updateVoiceUI();
        }
    } catch (error) {
        console.error('[Voice] Transcription error:', error);
        alert('Could not transcribe audio. Please try again or type your answer.');
        VoiceState.status = 'idle';
        updateVoiceUI();
    }
}

/**
 * Sends audio to OpenAI Whisper API for transcription. Returns the transcript text.
 */
async function transcribeAudio(audioBlob) {
    if (!hasValidApiKey()) {
        throw new Error('No valid API key for Whisper transcription');
    }

    console.log('[Voice] Sending audio to Whisper API...');

    let ext = 'webm';
    if (audioBlob.type.includes('mp4')) ext = 'mp4';
    else if (audioBlob.type.includes('ogg')) ext = 'ogg';

    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${ext}`);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SessionState.apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Whisper API returned ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
}

/**
 * Cancels an ongoing voice recording and returns to idle.
 */
function voiceCancel() {
    if (VoiceState.status === 'idle') return;

    console.log('[Voice] Cancelling recording');

    if (VoiceState.mediaRecorder && VoiceState.mediaRecorder.state !== 'inactive') {
        VoiceState.mediaRecorder.onstop = null;
        VoiceState.mediaRecorder.stop();
    }

    if (VoiceState.micStream) {
        VoiceState.micStream.getTracks().forEach(track => track.stop());
        VoiceState.micStream = null;
    }

    VoiceState.audioChunks = [];
    VoiceState.status = 'idle';
    VoiceState.context = null;
    updateVoiceUI();
}

/**
 * Updates all voice-related UI elements based on VoiceState.status and VoiceState.context.
 */
function updateVoiceUI() {
    const status = VoiceState.status;
    const context = VoiceState.context;

    // Determine which set of controls to show
    const isChatContext = context === 'chat';
    const isTopicContext = context === 'topic';

    // Chat voice controls
    const chatMic = elements.recordBtn;
    const chatControls = elements.chatVoiceControls;
    const chatPause = elements.chatVoicePause;
    const chatSend = elements.chatVoiceSend;

    // Topic voice controls
    const topicMic = elements.topicRecordBtn;
    const topicControls = elements.topicVoiceControls;
    const topicPause = elements.topicVoicePause;
    const topicSend = elements.topicVoiceSend;

    if (status === 'idle') {
        // Show mic buttons, hide voice controls
        chatMic.classList.remove('hidden', 'recording');
        chatControls.classList.add('hidden');
        topicMic.classList.remove('hidden', 'recording');
        topicControls.classList.add('hidden');

        chatMic.disabled = false;
        topicMic.disabled = false;
    } else if (status === 'recording') {
        if (isChatContext) {
            chatMic.classList.add('hidden');
            chatControls.classList.remove('hidden');
            chatPause.textContent = '\u23F8 Pause';
            chatPause.classList.remove('is-paused');
            chatPause.disabled = false;
            chatSend.disabled = false;
            chatSend.innerHTML = '\u25B6 Send';
        } else if (isTopicContext) {
            topicMic.classList.add('hidden');
            topicControls.classList.remove('hidden');
            topicPause.textContent = '\u23F8 Pause';
            topicPause.classList.remove('is-paused');
            topicPause.disabled = false;
            topicSend.disabled = false;
            topicSend.innerHTML = '\u25B6 Send';
        }
    } else if (status === 'paused') {
        if (isChatContext) {
            chatPause.textContent = '\u25B6 Resume';
            chatPause.classList.add('is-paused');
            chatPause.disabled = false;
            chatSend.disabled = false;
        } else if (isTopicContext) {
            topicPause.textContent = '\u25B6 Resume';
            topicPause.classList.add('is-paused');
            topicPause.disabled = false;
            topicSend.disabled = false;
        }
    } else if (status === 'transcribing') {
        if (isChatContext) {
            chatPause.disabled = true;
            chatSend.disabled = true;
            chatSend.innerHTML = '<span class="spinner-inline"></span> Transcribing...';
        } else if (isTopicContext) {
            topicPause.disabled = true;
            topicSend.disabled = true;
            topicSend.innerHTML = '<span class="spinner-inline"></span> Transcribing...';
        }
    }
}

// ============================================================================
// Event Handlers
// ============================================================================

// Start Session
elements.startSessionBtn.addEventListener('click', async () => {
    const apiKey = elements.apiKeyInput.value.trim();
    const name = elements.studentNameInput.value.trim();
    const grade = parseInt(elements.gradeLevelSelect.value);

    if (!apiKey) {
        alert('Please enter your API key');
        return;
    }

    if (!apiKey.startsWith('sk-')) {
        alert('Please enter a valid OpenAI API key (starts with sk-)');
        return;
    }

    if (!name) {
        alert('Please enter your name');
        return;
    }

    storeApiKey(apiKey);
    SessionState.studentName = name;
    SessionState.gradeLevel = grade;

    if (elements.saveApiKeyCheckbox.checked) {
        saveApiKeyLocally(apiKey);
    } else {
        clearSavedApiKey();
    }

    elements.apiKeyInput.value = '';

    // Show topic discovery screen (step 1)
    showScreen('topic');
    showTopicStep('describe');
});

// ============================================================================
// Topic Discovery Event Handlers
// ============================================================================

function showTopicStep(step) {
    if (step === 'describe') {
        elements.topicStepDescribe.classList.remove('hidden');
        elements.topicStepSelect.classList.add('hidden');
    } else if (step === 'select') {
        elements.topicStepDescribe.classList.add('hidden');
        elements.topicStepSelect.classList.remove('hidden');
    }
}

// "Find Topics" button handler
async function handleFindTopics() {
    const description = elements.topicDescription.value.trim();
    if (!description) {
        alert('Please describe what you want to learn about!');
        return;
    }

    SessionState.freeFormDescription = description;

    try {
        const subtopics = await discoverTopics(description);
        if (subtopics.length === 0) {
            alert('Could not find matching topics. Try describing your interest differently.');
            return;
        }
        renderSuggestedTopics(subtopics);
        showTopicStep('select');
    } catch (error) {
        console.error('[TopicDiscovery] Failed:', error);
        alert('Something went wrong finding topics. Please check your API key and try again.');
    }
}

elements.findTopicsBtn.addEventListener('click', handleFindTopics);

// "Back" button — go back to description step
elements.topicBackBtn.addEventListener('click', () => {
    showTopicStep('describe');
});

// "Start Learning" button — begin session with selected sub-topics
elements.startLearningBtn.addEventListener('click', async () => {
    if (SessionState.selectedSubTopics.length === 0) return;

    // Determine primary topic for curriculum + system prompt
    const primaryTopic = determinePrimaryTopic();
    SessionState.currentTopic = primaryTopic;

    const topic = ScienceTopics[primaryTopic];
    const focusLabel = SessionState.selectedFocusAreas.length <= 3
        ? SessionState.selectedFocusAreas.join(', ')
        : `${SessionState.selectedFocusAreas.slice(0, 2).join(', ')} +${SessionState.selectedFocusAreas.length - 2} more`;
    elements.currentTopicDisplay.textContent = `${topic.name} — ${focusLabel}`;

    // Reset chat state
    elements.chatContainer.innerHTML = '';
    SessionState.conversationHistory = [];
    SessionState.questionCount = 0;
    SessionState.assessmentData = {
        responses: [],
        strengths: [],
        areasToImprove: [],
        conceptsExplored: {},
        confidenceLevels: [],
        overallEngagement: 'moderate'
    };
    SessionState.scoreData = { scores: [], hintsUsed: 0, currentScore: null };
    SessionState.difficultyLevel = 'medium';
    SessionState.consecutiveHighScores = 0;
    SessionState.consecutiveLowScores = 0;
    resetConceptTracker();

    // Fetch curriculum for all matched topic keys
    const allMatchedKeys = new Set();
    SessionState.selectedSubTopics.forEach(st => {
        (st.matchedTopicKeys || []).forEach(key => {
            if (ScienceTopics[key]) allMatchedKeys.add(key);
        });
    });

    let combinedCurriculum = '';
    for (const key of allMatchedKeys) {
        const c = await fetchRelevantCurriculum(key, SessionState.gradeLevel);
        if (c) combinedCurriculum += '\n' + c;
    }
    sessionCurriculum = combinedCurriculum.trim();
    if (sessionCurriculum) {
        console.log('[Session] Curriculum loaded, length:', sessionCurriculum.length);
    }

    showScreen('chat');

    try {
        const opening = await generateOpeningQuestion();
        addMessage(opening, 'tutor');
        updateQuestionCount();
    } catch (error) {
        addMessage('Sorry, I had trouble starting our session. Please check your API key and try again.', 'tutor');
    }
});

// ============================================================================
// Chat Event Handlers
// ============================================================================

async function handleSendResponse() {
    const response = elements.studentResponse.value.trim();
    if (!response) return;

    // Cancel voice if active
    if (VoiceState.status === 'recording' || VoiceState.status === 'paused') {
        voiceCancel();
    }

    elements.studentResponse.disabled = true;
    elements.sendResponseBtn.disabled = true;
    elements.needHintBtn.disabled = true;
    elements.recordBtn.disabled = true;

    addMessage(response, 'student');
    elements.studentResponse.value = '';

    try {
        addTypingIndicator();
        const tutorResponse = await generateTutorResponse(response);
        removeTypingIndicator();
        addMessage(tutorResponse, 'tutor');
        updateQuestionCount();
    } catch (error) {
        removeTypingIndicator();
        addMessage('I had a little trouble there. Could you try saying that again?', 'tutor');
    } finally {
        elements.studentResponse.disabled = false;
        elements.sendResponseBtn.disabled = false;
        elements.needHintBtn.disabled = false;
        elements.recordBtn.disabled = false;
        elements.studentResponse.focus();
    }
}

elements.sendResponseBtn.addEventListener('click', handleSendResponse);

elements.studentResponse.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendResponse();
    }
});

// Need Hint
elements.needHintBtn.addEventListener('click', async () => {
    if (VoiceState.status === 'recording' || VoiceState.status === 'paused') {
        voiceCancel();
    }

    elements.studentResponse.disabled = true;
    elements.sendResponseBtn.disabled = true;
    elements.needHintBtn.disabled = true;
    elements.recordBtn.disabled = true;

    try {
        addTypingIndicator();
        const hint = await generateTutorResponse('', true);
        removeTypingIndicator();
        addMessage(hint, 'tutor', true);
    } catch (error) {
        removeTypingIndicator();
        addMessage('Let me try to help you think about this differently...', 'tutor', true);
    } finally {
        elements.studentResponse.disabled = false;
        elements.sendResponseBtn.disabled = false;
        elements.needHintBtn.disabled = false;
        elements.recordBtn.disabled = false;
        elements.studentResponse.focus();
    }
});

// End Session
elements.endSessionBtn.addEventListener('click', async () => {
    if (SessionState.questionCount < 2) {
        if (!confirm('You\'ve only just started! Are you sure you want to end the session?')) {
            return;
        }
    }

    // Cancel voice if active
    voiceCancel();

    try {
        const assessment = await generateSessionSummary();
        displaySummary(assessment);
        SessionState.currentAssessment = assessment;
        clearApiKey();
        showScreen('summary');
    } catch (error) {
        alert('There was an error generating your summary. Please try again.');
    }
});

// Download Summary
elements.downloadSummaryBtn.addEventListener('click', () => {
    if (!SessionState.currentAssessment) return;

    const report = generateDownloadableReport(SessionState.currentAssessment);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${SessionState.studentName}_${SessionState.currentTopic}_report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// New Session
elements.newSessionBtn.addEventListener('click', () => {
    SessionState.apiKey = null;
    SessionState.studentName = '';
    SessionState.gradeLevel = 6;
    SessionState.currentTopic = null;
    SessionState.questionCount = 0;
    SessionState.conversationHistory = [];
    SessionState.assessmentData = {
        responses: [],
        strengths: [],
        areasToImprove: [],
        conceptsExplored: {},
        confidenceLevels: [],
        overallEngagement: 'moderate'
    };
    SessionState.scoreData = { scores: [], hintsUsed: 0, currentScore: null };
    SessionState.difficultyLevel = 'medium';
    SessionState.consecutiveHighScores = 0;
    SessionState.consecutiveLowScores = 0;
    SessionState.conceptMastery = {};
    SessionState.currentAssessment = null;
    SessionState.freeFormDescription = '';
    SessionState.suggestedSubTopics = [];
    SessionState.selectedSubTopics = [];
    SessionState.selectedFocusAreas = [];
    sessionCurriculum = '';

    elements.studentNameInput.value = '';
    elements.gradeLevelSelect.value = '6';
    elements.chatContainer.innerHTML = '';
    elements.topicDescription.value = '';
    elements.suggestedTopicsGrid.innerHTML = '';
    resetConceptTracker();
    voiceCancel();

    showScreen('setup');
});

// Clear API key when page is closed/refreshed
window.addEventListener('beforeunload', () => {
    clearApiKey();
});

// ============================================================================
// Voice Button Event Handlers
// ============================================================================

// Chat mic button -> start recording in chat context
elements.recordBtn.addEventListener('click', () => {
    if (VoiceState.status === 'idle') {
        voiceStart('chat');
    }
});

// Chat voice controls
elements.chatVoicePause.addEventListener('click', voicePauseResume);
elements.chatVoiceSend.addEventListener('click', voiceSend);

// Topic mic button -> start recording in topic context
elements.topicRecordBtn.addEventListener('click', () => {
    if (VoiceState.status === 'idle') {
        voiceStart('topic');
    }
});

// Topic voice controls
elements.topicVoicePause.addEventListener('click', voicePauseResume);
elements.topicVoiceSend.addEventListener('click', voiceSend);

// Concept tracker toggle
elements.toggleTrackerBtn.addEventListener('click', () => {
    elements.conceptTrackerBody.classList.toggle('collapsed');
    elements.toggleTrackerBtn.classList.toggle('collapsed');
});
elements.conceptTracker.querySelector('.concept-tracker-header').addEventListener('click', () => {
    elements.conceptTrackerBody.classList.toggle('collapsed');
    elements.toggleTrackerBtn.classList.toggle('collapsed');
});

// ============================================================================
// Initialize
// ============================================================================

if (sessionStorage.getItem('socratic_session_active')) {
    sessionStorage.removeItem('socratic_session_active');
}

initVoiceInput();

const savedKey = loadApiKeyLocally();
if (savedKey) {
    elements.apiKeyInput.value = savedKey;
    elements.saveApiKeyCheckbox.checked = true;
}

elements.apiKeyInput.focus();
