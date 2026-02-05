/**
 * Socratic Science Tutor
 * An AI-powered tutoring system that uses the Socratic method to help students
 * discover knowledge through guided questioning rather than direct lecturing.
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
    }
};

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
    studentNameInput: document.getElementById('student-name'),
    gradeLevelSelect: document.getElementById('grade-level'),
    startSessionBtn: document.getElementById('start-session'),

    // Topic Selection
    topicButtons: document.querySelectorAll('.topic-btn'),

    // Chat
    currentTopicDisplay: document.getElementById('current-topic-display'),
    questionCount: document.getElementById('question-count'),
    chatContainer: document.getElementById('chat-container'),
    studentResponse: document.getElementById('student-response'),
    sendResponseBtn: document.getElementById('send-response'),
    needHintBtn: document.getElementById('need-hint'),
    endSessionBtn: document.getElementById('end-session-btn'),

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
    // Store in sessionStorage (cleared when browser tab closes)
    // We also store in memory for immediate access
    SessionState.apiKey = key;
    sessionStorage.setItem('socratic_session_active', 'true');
    // Note: We intentionally don't store the actual key in sessionStorage for security
}

function clearApiKey() {
    SessionState.apiKey = null;
    sessionStorage.removeItem('socratic_session_active');
}

function hasValidApiKey() {
    return SessionState.apiKey && SessionState.apiKey.startsWith('sk-ant-');
}

// ============================================================================
// Claude API Integration
// ============================================================================

async function callClaudeAPI(messages, systemPrompt) {
    if (!hasValidApiKey()) {
        throw new Error('Invalid API key');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': SessionState.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.content[0].text;
}

// ============================================================================
// Socratic Tutoring Engine
// ============================================================================

function buildSystemPrompt() {
    const topic = ScienceTopics[SessionState.currentTopic];
    const gradeExpectations = topic.gradeExpectations[SessionState.gradeLevel] || topic.gradeExpectations[6];

    return `You are a Socratic science tutor helping ${SessionState.studentName}, a ${SessionState.gradeLevel}th grade student, learn about ${topic.name}.

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

Remember: Your goal is to help them DISCOVER knowledge, not receive it. Every response should end with a question.`;
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

    // Add the student's message to conversation history
    SessionState.conversationHistory.push({
        role: 'user',
        content: isHintRequest
            ? `[Student requested a hint] ${studentMessage || "I need help with this question."}`
            : studentMessage
    });

    // Store response data for assessment
    SessionState.assessmentData.responses.push({
        question: SessionState.conversationHistory.length > 1
            ? SessionState.conversationHistory[SessionState.conversationHistory.length - 2]?.content
            : 'Opening question',
        answer: studentMessage,
        wasHintRequest: isHintRequest
    });

    try {
        showLoading(true, 'Thinking about your answer...');

        const response = await callClaudeAPI(SessionState.conversationHistory, systemPrompt);

        // Add assistant response to history
        SessionState.conversationHistory.push({
            role: 'assistant',
            content: response
        });

        SessionState.questionCount++;

        return response;
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

    const openingPrompt = `Start a tutoring session about ${topic.name}.

Greet ${SessionState.studentName} warmly (1 sentence), then ask an open-ended opening question to gauge their current understanding.

The question should:
- Be broad enough that any student can answer something
- Invite them to share what they already know
- Be encouraging and non-intimidating

Example style: "Hi [name]! Let's explore [topic] together. To start, what comes to mind when you think about [topic]?"

Keep it brief and friendly.`;

    SessionState.conversationHistory.push({
        role: 'user',
        content: openingPrompt
    });

    try {
        showLoading(true, 'Preparing your session...');

        const response = await callClaudeAPI(SessionState.conversationHistory, systemPrompt);

        // Replace the prompt with assistant's response for clean history
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

    // Create a summary of the conversation for assessment
    const conversationSummary = SessionState.conversationHistory
        .map((msg, i) => `${msg.role === 'assistant' ? 'Tutor' : 'Student'}: ${msg.content}`)
        .join('\n\n');

    const assessmentMessages = [{
        role: 'user',
        content: `Here is the tutoring conversation to assess:\n\n${conversationSummary}\n\nProvide the JSON assessment.`
    }];

    try {
        showLoading(true, 'Creating your session summary...');

        const response = await callClaudeAPI(assessmentMessages, assessmentPrompt);

        // Parse the JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid assessment format');
    } catch (error) {
        console.error('Error generating summary:', error);
        // Return a default summary if parsing fails
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

// ============================================================================
// Summary UI Functions
// ============================================================================

function displaySummary(assessment) {
    // Set intro
    elements.summaryIntro.textContent = assessment.overallSummary;

    // Display strengths
    elements.strengthsList.innerHTML = '';
    assessment.strengths.forEach(strength => {
        const li = document.createElement('li');
        li.textContent = strength;
        elements.strengthsList.appendChild(li);
    });

    // Display areas to improve
    elements.improvementsList.innerHTML = '';
    assessment.areasToImprove.forEach(area => {
        const li = document.createElement('li');
        li.textContent = area;
        elements.improvementsList.appendChild(li);
    });

    // Display next steps
    elements.nextStepsList.innerHTML = '';
    assessment.nextSteps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        elements.nextStepsList.appendChild(li);
    });

    // Display knowledge map
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

    if (!apiKey.startsWith('sk-ant-')) {
        alert('Please enter a valid Anthropic API key (starts with sk-ant-)');
        return;
    }

    if (!name) {
        alert('Please enter your name');
        return;
    }

    // Store session data
    storeApiKey(apiKey);
    SessionState.studentName = name;
    SessionState.gradeLevel = grade;

    // Clear the input for security
    elements.apiKeyInput.value = '';

    // Show topic selection
    showScreen('topic');
});

// Topic Selection
elements.topicButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
        const topicId = btn.dataset.topic;
        SessionState.currentTopic = topicId;

        const topic = ScienceTopics[topicId];
        elements.currentTopicDisplay.textContent = topic.name;

        // Reset chat
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

        showScreen('chat');

        try {
            const opening = await generateOpeningQuestion();
            addMessage(opening, 'tutor');
            updateQuestionCount();
        } catch (error) {
            addMessage('Sorry, I had trouble starting our session. Please check your API key and try again.', 'tutor');
        }
    });
});

// Send Response
async function handleSendResponse() {
    const response = elements.studentResponse.value.trim();

    if (!response) {
        return;
    }

    // Disable input while processing
    elements.studentResponse.disabled = true;
    elements.sendResponseBtn.disabled = true;
    elements.needHintBtn.disabled = true;

    // Add student message
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
    elements.studentResponse.disabled = true;
    elements.sendResponseBtn.disabled = true;
    elements.needHintBtn.disabled = true;

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

    try {
        const assessment = await generateSessionSummary();
        displaySummary(assessment);

        // Store assessment for download
        SessionState.currentAssessment = assessment;

        // Clear the API key
        clearApiKey();

        showScreen('summary');
    } catch (error) {
        alert('There was an error generating your summary. Please try again.');
    }
});

// Download Summary
elements.downloadSummaryBtn.addEventListener('click', () => {
    if (!SessionState.currentAssessment) {
        return;
    }

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
    // Reset all state
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
    SessionState.currentAssessment = null;

    // Clear inputs
    elements.studentNameInput.value = '';
    elements.gradeLevelSelect.value = '6';
    elements.chatContainer.innerHTML = '';

    showScreen('setup');
});

// Clear API key when page is closed/refreshed
window.addEventListener('beforeunload', () => {
    clearApiKey();
});

// ============================================================================
// Initialize
// ============================================================================

// Check if there's an active session (shouldn't be, but just in case)
if (sessionStorage.getItem('socratic_session_active')) {
    sessionStorage.removeItem('socratic_session_active');
}

// Focus on API key input
elements.apiKeyInput.focus();
