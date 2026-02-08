/**
 * Curriculum Admin Dashboard
 * Manages curriculum CRUD operations, PDF upload with GPT-4o Vision + pdf.js,
 * smart auto-tagging, and admin authentication for the Socratic Science Tutor.
 *
 * Data is stored in-memory and exported/imported as curriculum.json.
 * No backend or database required.
 */

// ============================================================================
// Constants & Configuration
// ============================================================================

// SHA-256 hash of the admin passphrase. Replace with your own hash.
// Generate with: echo -n "yourpassphrase" | shasum -a 256
const ADMIN_PASSPHRASE_HASH = '85bd67b52c68dd703d74ac3cf3bfd7e218e971ddb3257e88fc1e65bb3c29fa20';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PDF_PAGES = 20;
const CURRICULUM_JSON_URL = 'curriculum.json';

const TOPIC_NAMES = {
    'solar-system': 'Solar System',
    'human-body': 'Human Body',
    'ecosystems': 'Ecosystems',
    'matter-chemistry': 'Matter & Chemistry',
    'forces-motion': 'Forces & Motion',
    'electricity': 'Electricity',
    'weather-climate': 'Weather & Climate',
    'cells-life': 'Cells & Life'
};

// Color palette for topic pills (consistent mapping)
const TOPIC_COLORS = {
    'solar-system': '#3b82f6',
    'human-body': '#ef4444',
    'ecosystems': '#22c55e',
    'matter-chemistry': '#a855f7',
    'forces-motion': '#f97316',
    'electricity': '#eab308',
    'weather-climate': '#06b6d4',
    'cells-life': '#ec4899'
};

// Valid topic keys for auto-tagging validation
const VALID_TOPIC_KEYS = Object.keys(TOPIC_NAMES);

// ============================================================================
// Application State
// ============================================================================

let curriculumData = [];       // All loaded curriculum documents
let currentEditId = null;      // Document ID being edited (null for new)
let selectedTopics = [];       // Topics selected in the modal form
let selectedGrades = [];       // Grades selected in the modal form
let selectedPdfFile = null;    // File object for PDF upload
let activeContentTab = 'text'; // 'text' or 'pdf'
let isAuthenticated = false;
let hasUnsavedChanges = false;
let lastLoadedData = null;     // Snapshot of data at last load/export for change detection

// ============================================================================
// DOM Element References
// ============================================================================

const dom = {
    // Auth
    authGate: document.getElementById('auth-gate'),
    dashboard: document.getElementById('admin-dashboard'),
    loginForm: document.getElementById('login-form'),
    adminPassphraseInput: document.getElementById('admin-passphrase'),
    loginBtn: document.getElementById('login-btn'),
    authStatus: document.getElementById('auth-status'),

    // Header
    signOutBtn: document.getElementById('sign-out-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importJsonInput: document.getElementById('import-json-input'),
    exportJsonBtn: document.getElementById('export-json-btn'),

    // OpenAI API Key
    openaiApiKey: document.getElementById('openai-api-key'),
    saveApiKeyBtn: document.getElementById('save-api-key-btn'),
    apiKeyStatus: document.getElementById('api-key-status'),

    // Stats
    statTotal: document.getElementById('stat-total'),
    statActive: document.getElementById('stat-active'),
    statTopics: document.getElementById('stat-topics'),

    // Filters
    filterTopic: document.getElementById('filter-topic'),
    filterGrade: document.getElementById('filter-grade'),
    addCurriculumBtn: document.getElementById('add-curriculum-btn'),

    // Grid
    curriculumGrid: document.getElementById('curriculum-grid'),
    emptyState: document.getElementById('empty-state'),

    // Modal
    modal: document.getElementById('curriculum-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    curriculumTitle: document.getElementById('curriculum-title'),
    curriculumId: document.getElementById('curriculum-id'),

    // Content tabs
    tabText: document.getElementById('tab-text'),
    tabPdf: document.getElementById('tab-pdf'),
    textTab: document.getElementById('text-tab'),
    pdfTab: document.getElementById('pdf-tab'),
    curriculumText: document.getElementById('curriculum-text'),

    // PDF elements
    dropZone: document.getElementById('drop-zone'),
    pdfInput: document.getElementById('pdf-input'),
    fileInfo: document.getElementById('file-info'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    ocrBtn: document.getElementById('ocr-btn'),
    ocrProgress: document.getElementById('ocr-progress'),
    ocrPreview: document.getElementById('ocr-preview'),
    ocrPreviewArea: document.getElementById('ocr-preview-area'),

    // Modal footer
    deleteBtn: document.getElementById('delete-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    saveBtn: document.getElementById('save-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Computes the SHA-256 hash of a string using the Web Crypto API.
 * @param {string} message
 * @returns {Promise<string>} Hex-encoded hash
 */
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns a human-readable relative time string from an ISO date string.
 * @param {string} dateString - ISO 8601 date string
 * @returns {string}
 */
function timeAgo(dateString) {
    if (!dateString) return 'Unknown';

    const then = new Date(dateString).getTime();
    if (isNaN(then)) return 'Unknown';

    const now = Date.now();
    const diffMs = now - then;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

/**
 * Truncates text to a maximum length, appending "..." if truncated.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trimEnd() + '...';
}

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================================
// Toast Notifications
// ============================================================================

/**
 * Displays a toast notification that auto-dismisses after 3 seconds.
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'} type - The type of notification
 */
function showToast(message, type = 'info') {
    console.log(`[Toast ${type}] ${message}`);

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    dom.toastContainer.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.add('toast-exit');
        // Remove after exit animation completes
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================================================
// OpenAI API Key Management
// ============================================================================

function getOpenAIApiKey() {
    return localStorage.getItem('openai_api_key') || '';
}

function saveOpenAIApiKey(key) {
    if (key) {
        localStorage.setItem('openai_api_key', key);
        dom.apiKeyStatus.textContent = 'Key saved';
        dom.apiKeyStatus.style.color = '#22c55e';
        showToast('OpenAI API key saved.', 'success');
    } else {
        showToast('Please enter an API key.', 'error');
    }
}

// ============================================================================
// Authentication (Passphrase-based)
// ============================================================================

/**
 * Validates the entered passphrase against the stored hash.
 * @param {string} passphrase
 */
async function handleLogin(passphrase) {
    if (!passphrase) {
        showToast('Please enter the passphrase.', 'error');
        return;
    }

    const hash = await sha256(passphrase);

    if (hash === ADMIN_PASSPHRASE_HASH) {
        isAuthenticated = true;
        localStorage.setItem('admin_authenticated', 'true');
        dom.authGate.classList.add('hidden');
        dom.dashboard.classList.remove('hidden');
        loadCurriculum();
        showToast('Signed in successfully.', 'success');
        console.log('[Auth] Admin authenticated');
    } else {
        dom.authStatus.textContent = 'Incorrect passphrase.';
        dom.authStatus.style.color = '#ef4444';
        showToast('Incorrect passphrase.', 'error');
        console.warn('[Auth] Incorrect passphrase attempt');
    }
}

/**
 * Signs the admin out and returns to the auth gate.
 */
function handleSignOut() {
    isAuthenticated = false;
    localStorage.removeItem('admin_authenticated');
    curriculumData = [];
    hasUnsavedChanges = false;
    dom.authGate.classList.remove('hidden');
    dom.dashboard.classList.add('hidden');
    dom.adminPassphraseInput.value = '';
    dom.authStatus.textContent = 'Please sign in with the admin passphrase.';
    dom.authStatus.style.color = '';
    showToast('Signed out.', 'info');
    console.log('[Auth] Signed out');
}

/**
 * Checks for an existing admin session in localStorage.
 */
function checkExistingSession() {
    if (localStorage.getItem('admin_authenticated') === 'true') {
        isAuthenticated = true;
        dom.authGate.classList.add('hidden');
        dom.dashboard.classList.remove('hidden');
        loadCurriculum();
        console.log('[Auth] Restored existing session');
    }
}

// ============================================================================
// In-Memory CRUD Operations
// ============================================================================

/**
 * Loads curriculum data from the static JSON file.
 */
async function loadCurriculum() {
    console.log('[Data] Loading curriculum data from JSON...');

    try {
        const response = await fetch(CURRICULUM_JSON_URL + '?t=' + Date.now());
        if (!response.ok) {
            console.log('[Data] No curriculum.json found, starting fresh');
            curriculumData = [];
        } else {
            const data = await response.json();
            curriculumData = data.items || [];
        }

        lastLoadedData = JSON.stringify(curriculumData);
        hasUnsavedChanges = false;
        console.log(`[Data] Loaded ${curriculumData.length} curriculum items`);
        updateStats();
        renderCurriculum();
    } catch (error) {
        console.error('[Data] Error loading curriculum:', error);
        showToast('Failed to load curriculum data. Starting with empty list.', 'error');
        curriculumData = [];
        lastLoadedData = JSON.stringify(curriculumData);
        updateStats();
        renderCurriculum();
    }
}

/**
 * Creates a new curriculum item in memory.
 * @param {Object} data - The curriculum data
 * @returns {string|null} The new item ID, or null on failure
 */
function createCurriculumItem(data) {
    const newItem = {
        id: 'curr_' + Date.now(),
        title: data.title,
        content: data.content,
        contentType: data.contentType,
        pdfFileName: data.pdfFileName || null,
        topics: data.topics,
        grades: data.grades,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    curriculumData.unshift(newItem);
    hasUnsavedChanges = true;
    console.log(`[Data] Created item: ${newItem.id} - ${newItem.title}`);
    showToast('Curriculum item created. Export JSON to save permanently.', 'success');
    return newItem.id;
}

/**
 * Updates an existing curriculum item in memory.
 * @param {string} itemId - The item ID
 * @param {Object} data - The fields to update
 * @returns {boolean} Whether the update succeeded
 */
function updateCurriculumItem(itemId, data) {
    const index = curriculumData.findIndex(d => d.id === itemId);
    if (index === -1) {
        showToast('Item not found.', 'error');
        return false;
    }

    curriculumData[index] = {
        ...curriculumData[index],
        title: data.title,
        content: data.content,
        contentType: data.contentType,
        pdfFileName: data.pdfFileName !== undefined ? data.pdfFileName : curriculumData[index].pdfFileName,
        topics: data.topics,
        grades: data.grades,
        updatedAt: new Date().toISOString()
    };

    hasUnsavedChanges = true;
    console.log(`[Data] Updated item: ${itemId}`);
    showToast('Curriculum item updated. Export JSON to save permanently.', 'success');
    return true;
}

/**
 * Soft-deletes a curriculum item by setting isActive to false.
 * @param {string} itemId - The item ID
 * @returns {boolean} Whether the delete succeeded
 */
function deleteCurriculumItem(itemId) {
    const index = curriculumData.findIndex(d => d.id === itemId);
    if (index === -1) {
        showToast('Item not found.', 'error');
        return false;
    }

    curriculumData[index].isActive = false;
    curriculumData[index].updatedAt = new Date().toISOString();
    hasUnsavedChanges = true;
    console.log(`[Data] Soft-deleted item: ${itemId}`);
    showToast('Curriculum item deleted. Export JSON to save permanently.', 'success');
    return true;
}

// ============================================================================
// Import / Export
// ============================================================================

/**
 * Exports the current curriculum data as a downloadable JSON file.
 */
function exportCurriculumJson() {
    const exportData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        items: curriculumData.filter(d => d.isActive !== false)
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curriculum.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    lastLoadedData = JSON.stringify(curriculumData);
    hasUnsavedChanges = false;
    showToast('curriculum.json downloaded. Commit it to your repo to publish.', 'success');
    console.log(`[Export] Exported ${exportData.items.length} active items`);
}

/**
 * Imports curriculum data from a JSON file.
 * @param {File} file - The JSON file
 */
function importCurriculumJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.items && Array.isArray(data.items)) {
                curriculumData = data.items;
                lastLoadedData = JSON.stringify(curriculumData);
                hasUnsavedChanges = false;
                updateStats();
                renderCurriculum();
                showToast(`Imported ${curriculumData.length} items from JSON.`, 'success');
                console.log(`[Import] Imported ${curriculumData.length} items`);
            } else {
                showToast('Invalid JSON format. Expected { items: [...] }', 'error');
                console.error('[Import] Invalid JSON structure');
            }
        } catch (err) {
            console.error('[Import] Parse error:', err);
            showToast('Failed to parse JSON file.', 'error');
        }
    };
    reader.readAsText(file);
}

// ============================================================================
// PDF Upload & GPT-4o Vision OCR
// ============================================================================

/**
 * Calls GPT-4o Vision to extract text from a single page image.
 * @param {string} apiKey - OpenAI API key
 * @param {string} imageBase64 - Base64 data URL of the page image
 * @param {number} pageNum - Current page number (1-based)
 * @param {number} totalPages - Total number of pages
 * @returns {Promise<string>} Extracted text
 */
async function callGPT4oVision(apiKey, imageBase64, pageNum, totalPages) {
    console.log(`[OCR] Sending page ${pageNum}/${totalPages} to GPT-4o Vision`);

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Extract ALL text from this PDF page image (page ${pageNum} of ${totalPages}). Preserve the original structure, headings, lists, and formatting as much as possible using markdown. Include all text content — do not summarize or omit anything.`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageBase64,
                            detail: 'high'
                        }
                    }
                ]
            }],
            max_tokens: 4096,
            temperature: 0
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[OCR] GPT-4o Vision API returned ${response.status}: ${errorBody}`);
        throw new Error(`Vision API request failed with status ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content || '';
}

/**
 * Extracts text from a PDF using pdf.js for rendering and GPT-4o Vision for OCR.
 * @param {File} file - The PDF file
 * @param {function} onProgress - Progress callback: (pageNum, totalPages)
 * @returns {Promise<string|null>} Extracted text, or null on failure
 */
async function extractTextWithVision(file, onProgress) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
        showToast('Please enter your OpenAI API key in the settings bar above.', 'error');
        return null;
    }

    console.log(`[OCR] Starting GPT-4o Vision extraction for: ${file.name}, size: ${formatFileSize(file.size)}`);

    try {
        // Read the PDF file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        console.log('[OCR] PDF loaded into memory');

        // Load with pdf.js
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = Math.min(pdfDoc.numPages, MAX_PDF_PAGES);
        console.log(`[OCR] PDF has ${pdfDoc.numPages} pages, processing ${totalPages}`);

        if (pdfDoc.numPages > MAX_PDF_PAGES) {
            showToast(`PDF has ${pdfDoc.numPages} pages. Processing first ${MAX_PDF_PAGES} pages only.`, 'info');
        }

        const pageTexts = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (onProgress) onProgress(pageNum, totalPages);

            // Get the page
            const page = await pdfDoc.getPage(pageNum);

            // Render to canvas at scale 2.0 for better quality
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Convert canvas to base64 PNG
            const imageBase64 = canvas.toDataURL('image/png');
            console.log(`[OCR] Page ${pageNum} rendered, image size: ~${Math.round(imageBase64.length / 1024)}KB`);

            // Send to GPT-4o Vision
            const pageText = await callGPT4oVision(apiKey, imageBase64, pageNum, totalPages);
            pageTexts.push(pageText);

            console.log(`[OCR] Page ${pageNum} extracted: ${pageText.length} characters`);
        }

        const combinedText = pageTexts.join('\n\n---\n\n');
        console.log(`[OCR] Total extracted text: ${combinedText.length} characters from ${totalPages} pages`);
        return combinedText;
    } catch (error) {
        console.error('[OCR] Error during Vision extraction:', error);
        showToast('Text extraction failed. Please try again or enter text manually.', 'error');
        return null;
    }
}

/**
 * Validates and processes a selected PDF file. Updates the UI to show file info.
 * @param {File} file
 */
function handlePdfFileSelected(file) {
    console.log(`[PDF] File selected: ${file.name}, type: ${file.type}, size: ${formatFileSize(file.size)}`);

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a PDF file.', 'error');
        return;
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE_BYTES) {
        showToast(`File too large. Maximum size is ${formatFileSize(MAX_PDF_SIZE_BYTES)}.`, 'error');
        return;
    }

    selectedPdfFile = file;

    // Update UI
    dom.fileName.textContent = file.name;
    dom.fileSize.textContent = formatFileSize(file.size);
    dom.fileInfo.classList.remove('hidden');
    dom.ocrBtn.classList.remove('hidden');
    dom.ocrPreviewArea.classList.add('hidden');
    dom.ocrProgress.classList.add('hidden');

    showToast(`PDF selected: ${file.name}`, 'info');
}

/**
 * Runs the full OCR pipeline: shows progress, calls API, displays result.
 */
async function runOcrPipeline() {
    if (!selectedPdfFile) {
        showToast('No PDF file selected.', 'error');
        return;
    }

    console.log('[OCR] Starting Vision OCR pipeline');

    // Show progress
    dom.ocrBtn.classList.add('hidden');
    dom.ocrProgress.classList.remove('hidden');
    dom.ocrPreviewArea.classList.add('hidden');

    const progressSpan = dom.ocrProgress.querySelector('span');

    const onProgress = (pageNum, totalPages) => {
        if (progressSpan) {
            progressSpan.textContent = `Extracting text: page ${pageNum} of ${totalPages}...`;
        }
    };

    if (progressSpan) progressSpan.textContent = 'Loading PDF...';

    const extractedText = await extractTextWithVision(selectedPdfFile, onProgress);

    if (extractedText !== null) {
        if (progressSpan) progressSpan.textContent = 'Extraction complete!';

        // Show extracted text in editable preview
        dom.ocrPreview.value = extractedText;
        dom.ocrPreviewArea.classList.remove('hidden');

        await new Promise(r => setTimeout(r, 600));
        dom.ocrProgress.classList.add('hidden');

        showToast('Text extracted successfully. You can edit it before saving.', 'success');
        console.log('[OCR] Pipeline completed successfully');
    } else {
        // OCR failed
        if (progressSpan) progressSpan.textContent = 'Extraction failed. Try again or enter text manually.';

        await new Promise(r => setTimeout(r, 2000));
        dom.ocrProgress.classList.add('hidden');
        dom.ocrBtn.classList.remove('hidden');

        console.error('[OCR] Pipeline failed');
    }
}

// ============================================================================
// Smart Auto-Tagging with GPT-4o
// ============================================================================

/**
 * Analyzes content with GPT-4o to auto-detect topics and grade levels.
 * @param {string} title - Document title
 * @param {string} content - Document content
 * @returns {Promise<{title: string, topics: string[], grades: number[], summary: string}|null>}
 */
async function autoAnalyzeContent(title, content) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
        console.log('[AutoTag] No API key available, skipping auto-analysis');
        return null;
    }

    console.log(`[AutoTag] Analyzing content: title="${title}", content length=${content.length}`);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: `Analyze this educational document and return a JSON object with these fields:
{
  "title": "suggested title if the provided one seems incomplete, otherwise use the provided title as-is",
  "topics": ["matching topic keys from ONLY this list: solar-system, human-body, ecosystems, matter-chemistry, forces-motion, electricity, weather-climate, cells-life"],
  "grades": [array of grade numbers from 5-10 that this content is appropriate for],
  "summary": "one-sentence summary of what this content covers"
}

Document title: ${title || '(none)'}
Document content (first 3000 chars): ${content.substring(0, 3000)}

Return ONLY valid JSON, no other text.`
                }],
                max_tokens: 512,
                temperature: 0
            })
        });

        if (!response.ok) {
            console.error(`[AutoTag] API returned ${response.status}`);
            return null;
        }

        const data = await response.json();
        const responseText = data.choices[0].message.content;

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[AutoTag] No JSON found in response');
            return null;
        }

        const analysis = JSON.parse(jsonMatch[0]);

        // Validate and sanitize topics
        const validTopics = (analysis.topics || []).filter(t => VALID_TOPIC_KEYS.includes(t));

        // Validate and sanitize grades
        const validGrades = (analysis.grades || [])
            .map(g => parseInt(g))
            .filter(g => g >= 5 && g <= 10);

        const result = {
            title: analysis.title || title,
            topics: validTopics,
            grades: validGrades,
            summary: analysis.summary || ''
        };

        console.log(`[AutoTag] Analysis result: topics=[${result.topics}], grades=[${result.grades}], summary="${result.summary}"`);
        return result;
    } catch (error) {
        console.error('[AutoTag] Error analyzing content:', error);
        return null;
    }
}

/**
 * Applies auto-detected tags to the modal UI.
 * @param {{topics: string[], grades: number[]}} analysis
 */
function applyAutoTags(analysis) {
    if (!analysis) return;

    // Update selected topics
    selectedTopics = [...analysis.topics];
    document.querySelectorAll('.topic-tag').forEach(btn => {
        if (selectedTopics.includes(btn.dataset.topic)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    // Update selected grades
    selectedGrades = [...analysis.grades];
    document.querySelectorAll('.grade-tag').forEach(btn => {
        const grade = parseInt(btn.dataset.grade);
        if (selectedGrades.includes(grade)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    console.log(`[AutoTag] Applied tags: topics=[${selectedTopics}], grades=[${selectedGrades}]`);
}

// ============================================================================
// Modal Management
// ============================================================================

/**
 * Opens the curriculum modal in 'add' or 'edit' mode.
 * @param {'add'|'edit'} mode
 * @param {string|null} docId - Document ID for edit mode
 */
function openModal(mode, docId = null) {
    console.log(`[Modal] Opening in ${mode} mode${docId ? `, docId: ${docId}` : ''}`);

    // Reset form state
    resetModalForm();

    if (mode === 'add') {
        dom.modalTitle.textContent = 'Add Curriculum';
        dom.deleteBtn.classList.add('hidden');
        dom.curriculumId.value = '';
        currentEditId = null;
    } else if (mode === 'edit' && docId) {
        dom.modalTitle.textContent = 'Edit Curriculum';
        dom.deleteBtn.classList.remove('hidden');
        dom.curriculumId.value = docId;
        currentEditId = docId;

        // Find the document and pre-populate
        const doc = curriculumData.find(d => d.id === docId);
        if (doc) {
            console.log(`[Modal] Pre-populating form with document: ${doc.title}`);
            dom.curriculumTitle.value = doc.title || '';

            // Set content type tab
            if (doc.contentType === 'pdf') {
                switchContentTab('pdf');
                dom.ocrPreview.value = doc.content || '';
                dom.ocrPreviewArea.classList.remove('hidden');
                if (doc.pdfFileName) {
                    dom.fileName.textContent = doc.pdfFileName;
                    dom.fileInfo.classList.remove('hidden');
                }
            } else {
                switchContentTab('text');
                dom.curriculumText.value = doc.content || '';
            }

            // Pre-select topics
            selectedTopics = [...(doc.topics || [])];
            document.querySelectorAll('.topic-tag').forEach(btn => {
                if (selectedTopics.includes(btn.dataset.topic)) {
                    btn.classList.add('selected');
                }
            });

            // Pre-select grades
            selectedGrades = [...(doc.grades || [])];
            document.querySelectorAll('.grade-tag').forEach(btn => {
                if (selectedGrades.includes(parseInt(btn.dataset.grade))) {
                    btn.classList.add('selected');
                }
            });
        } else {
            console.warn(`[Modal] Document not found in local data: ${docId}`);
        }
    }

    dom.modal.classList.remove('hidden');
}

/**
 * Closes the modal and resets all form state.
 */
function closeModal() {
    console.log('[Modal] Closing modal');
    dom.modal.classList.add('hidden');
    resetModalForm();
}

/**
 * Resets the modal form fields and internal state.
 */
function resetModalForm() {
    dom.curriculumTitle.value = '';
    dom.curriculumText.value = '';
    dom.curriculumId.value = '';
    dom.ocrPreview.value = '';
    dom.ocrPreviewArea.classList.add('hidden');
    dom.ocrProgress.classList.add('hidden');
    dom.ocrBtn.classList.add('hidden');
    dom.fileInfo.classList.add('hidden');
    dom.fileName.textContent = '';
    dom.fileSize.textContent = '';
    dom.pdfInput.value = '';
    dom.deleteBtn.classList.add('hidden');

    selectedTopics = [];
    selectedGrades = [];
    selectedPdfFile = null;
    currentEditId = null;

    // Clear all tag selections
    document.querySelectorAll('.tag-toggle-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Reset to text tab
    switchContentTab('text');
}

/**
 * Switches between 'text' and 'pdf' content tabs in the modal.
 * @param {'text'|'pdf'} tab
 */
function switchContentTab(tab) {
    activeContentTab = tab;

    if (tab === 'text') {
        dom.tabText.classList.add('active');
        dom.tabPdf.classList.remove('active');
        dom.textTab.classList.add('active');
        dom.pdfTab.classList.remove('active');
    } else {
        dom.tabText.classList.remove('active');
        dom.tabPdf.classList.add('active');
        dom.textTab.classList.remove('active');
        dom.pdfTab.classList.add('active');
    }
}

/**
 * Gathers form data, validates, runs auto-analysis, and saves the curriculum item.
 */
async function handleSave() {
    const title = dom.curriculumTitle.value.trim();

    if (!title) {
        showToast('Please enter a title.', 'error');
        dom.curriculumTitle.focus();
        return;
    }

    // Determine content and content type
    let content = '';
    let contentType = 'text';
    let pdfFileName = null;

    if (activeContentTab === 'pdf') {
        contentType = 'pdf';
        content = dom.ocrPreview.value.trim();

        if (!content && !selectedPdfFile) {
            showToast('Please upload a PDF and process it, or switch to text mode.', 'error');
            return;
        }

        if (selectedPdfFile) {
            pdfFileName = selectedPdfFile.name;
        } else if (currentEditId) {
            const existingDoc = curriculumData.find(d => d.id === currentEditId);
            if (existingDoc) {
                pdfFileName = existingDoc.pdfFileName;
            }
        }
    } else {
        content = dom.curriculumText.value.trim();
        if (!content) {
            showToast('Please enter content.', 'error');
            dom.curriculumText.focus();
            return;
        }
    }

    // If no topics or grades are manually selected, run auto-analysis
    if (selectedTopics.length === 0 || selectedGrades.length === 0) {
        showToast('Auto-detecting topics and grades...', 'info');
        dom.saveBtn.disabled = true;
        dom.saveBtn.textContent = 'Analyzing...';

        try {
            const analysis = await autoAnalyzeContent(title, content);
            if (analysis) {
                // Apply auto-detected tags if none were manually selected
                if (selectedTopics.length === 0) {
                    selectedTopics = analysis.topics;
                    // Update UI to show what was detected
                    document.querySelectorAll('.topic-tag').forEach(btn => {
                        if (selectedTopics.includes(btn.dataset.topic)) {
                            btn.classList.add('selected');
                        }
                    });
                }
                if (selectedGrades.length === 0) {
                    selectedGrades = analysis.grades;
                    document.querySelectorAll('.grade-tag').forEach(btn => {
                        if (selectedGrades.includes(parseInt(btn.dataset.grade))) {
                            btn.classList.add('selected');
                        }
                    });
                }
                // Use suggested title if current one seems empty
                if (!title && analysis.title) {
                    dom.curriculumTitle.value = analysis.title;
                }
                showToast(`Auto-detected: ${selectedTopics.length} topic(s), grades ${selectedGrades.join(', ')}`, 'success');
            }
        } catch (err) {
            console.error('[Save] Auto-analysis failed:', err);
        } finally {
            dom.saveBtn.disabled = false;
            dom.saveBtn.textContent = 'Save';
        }

        // If still no topics/grades after auto-analysis, warn but still allow save
        if (selectedTopics.length === 0) {
            showToast('Could not auto-detect topics. Please select at least one topic manually.', 'error');
            return;
        }
        if (selectedGrades.length === 0) {
            showToast('Could not auto-detect grades. Please select at least one grade level manually.', 'error');
            return;
        }
    }

    const data = {
        title: dom.curriculumTitle.value.trim(),
        content,
        contentType,
        pdfFileName,
        topics: [...selectedTopics],
        grades: [...selectedGrades].sort((a, b) => a - b)
    };

    console.log('[Save] Saving curriculum item:', { ...data, content: truncateText(data.content, 100) });

    let success = false;
    if (currentEditId) {
        success = updateCurriculumItem(currentEditId, data);
    } else {
        const newId = createCurriculumItem(data);
        success = newId !== null;
    }

    if (success) {
        closeModal();
        updateStats();
        renderCurriculum();
    }
}

/**
 * Handles the delete button click inside the modal.
 */
function handleDelete() {
    if (!currentEditId) return;

    const doc = curriculumData.find(d => d.id === currentEditId);
    const titleDisplay = doc ? doc.title : currentEditId;

    if (!confirm(`Are you sure you want to delete "${titleDisplay}"?`)) {
        return;
    }

    console.log(`[Delete] User confirmed deletion of: ${currentEditId}`);

    const success = deleteCurriculumItem(currentEditId);

    if (success) {
        closeModal();
        updateStats();
        renderCurriculum();
    }
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Updates the stats bar with current curriculum counts.
 */
function updateStats() {
    const active = curriculumData.filter(d => d.isActive !== false);
    const total = active.length;
    const uniqueTopics = new Set();
    active.forEach(d => {
        (d.topics || []).forEach(t => uniqueTopics.add(t));
    });

    dom.statTotal.textContent = total;
    dom.statActive.textContent = total;
    dom.statTopics.textContent = uniqueTopics.size;

    console.log(`[Stats] Total: ${total}, Active: ${total}, Topics: ${uniqueTopics.size}`);
}

/**
 * Renders the curriculum cards into the grid, applying active filters.
 */
function renderCurriculum() {
    const filterTopic = dom.filterTopic.value;
    const filterGrade = dom.filterGrade.value;

    console.log(`[Render] Rendering curriculum. Filter - topic: "${filterTopic}", grade: "${filterGrade}"`);

    // Only show active items
    let filtered = curriculumData.filter(d => d.isActive !== false);

    if (filterTopic) {
        filtered = filtered.filter(d => (d.topics || []).includes(filterTopic));
    }

    if (filterGrade) {
        const gradeNum = parseInt(filterGrade);
        filtered = filtered.filter(d => (d.grades || []).includes(gradeNum));
    }

    // Clear the grid
    dom.curriculumGrid.innerHTML = '';

    if (filtered.length === 0) {
        dom.emptyState.classList.remove('hidden');
        dom.curriculumGrid.classList.add('hidden');
        console.log('[Render] No items to display, showing empty state');
        return;
    }

    dom.emptyState.classList.add('hidden');
    dom.curriculumGrid.classList.remove('hidden');

    filtered.forEach(doc => {
        const card = createCurriculumCard(doc);
        dom.curriculumGrid.appendChild(card);
    });

    console.log(`[Render] Rendered ${filtered.length} curriculum cards`);
}

/**
 * Creates a DOM element for a single curriculum card.
 * @param {Object} doc - The curriculum document data
 * @returns {HTMLElement}
 */
function createCurriculumCard(doc) {
    const card = document.createElement('div');
    card.className = 'curriculum-card';
    card.dataset.id = doc.id;

    // Content type badge
    const typeBadge = doc.contentType === 'pdf'
        ? '<span class="content-type-badge badge-pdf">PDF</span>'
        : '<span class="content-type-badge badge-text">Text</span>';

    // Topic pills
    const topicPills = (doc.topics || []).map(topic => {
        const color = TOPIC_COLORS[topic] || '#6b7280';
        const name = TOPIC_NAMES[topic] || topic;
        return `<span class="tag-topic" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40;">${name}</span>`;
    }).join('');

    // Grade tags
    const gradeTags = (doc.grades || []).sort((a, b) => a - b).map(grade => {
        return `<span class="tag-grade">Grade ${grade}</span>`;
    }).join('');

    // Content preview
    const contentPreview = truncateText(doc.content || '', 150);

    // Timestamp
    const updatedText = doc.updatedAt ? timeAgo(doc.updatedAt) : 'Unknown';

    card.innerHTML = `
        <div class="curriculum-card-header">
            <h3 class="curriculum-card-title">${escapeHtml(doc.title || 'Untitled')}</h3>
            ${typeBadge}
        </div>
        <p class="curriculum-card-preview">${escapeHtml(contentPreview)}</p>
        <div class="curriculum-card-tags">
            <div class="tag-group">${topicPills}</div>
            <div class="tag-group">${gradeTags}</div>
        </div>
        <div class="curriculum-card-footer">
            <span class="curriculum-card-timestamp">Updated ${updatedText}</span>
            <div class="curriculum-card-actions">
                <button class="btn-card-action btn-card-edit" data-id="${doc.id}" title="Edit">Edit</button>
                <button class="btn-card-action btn-card-delete" data-id="${doc.id}" title="Delete">Delete</button>
            </div>
        </div>
    `;

    // Attach event listeners to card buttons
    const editBtn = card.querySelector('.btn-card-edit');
    const deleteCardBtn = card.querySelector('.btn-card-delete');

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('edit', doc.id);
    });

    deleteCardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            const success = deleteCurriculumItem(doc.id);
            if (success) {
                updateStats();
                renderCurriculum();
            }
        }
    });

    return card;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Drag and Drop
// ============================================================================

/**
 * Sets up drag-and-drop handlers on the drop zone.
 */
function initDragAndDrop() {
    const dropZone = dom.dropZone;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            console.log(`[DnD] File dropped: ${files[0].name}`);
            handlePdfFileSelected(files[0]);
        }
    });

    // Click on drop zone triggers file input
    dropZone.addEventListener('click', () => {
        dom.pdfInput.click();
    });

    console.log('[DnD] Drag-and-drop initialized');
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Auth: Login form submission
    dom.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(dom.adminPassphraseInput.value);
    });

    // Auth: Sign out
    dom.signOutBtn.addEventListener('click', handleSignOut);

    // Import/Export
    dom.exportJsonBtn.addEventListener('click', exportCurriculumJson);

    dom.importJsonBtn.addEventListener('click', () => {
        dom.importJsonInput.click();
    });

    dom.importJsonInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importCurriculumJson(e.target.files[0]);
            dom.importJsonInput.value = ''; // Reset so same file can be re-imported
        }
    });

    // OpenAI API Key
    dom.saveApiKeyBtn.addEventListener('click', () => {
        saveOpenAIApiKey(dom.openaiApiKey.value.trim());
    });

    // Filters
    dom.filterTopic.addEventListener('change', () => {
        console.log(`[Filter] Topic filter changed to: "${dom.filterTopic.value}"`);
        renderCurriculum();
    });

    dom.filterGrade.addEventListener('change', () => {
        console.log(`[Filter] Grade filter changed to: "${dom.filterGrade.value}"`);
        renderCurriculum();
    });

    // Add Curriculum button
    dom.addCurriculumBtn.addEventListener('click', () => {
        openModal('add');
    });

    // Modal close
    dom.modalCloseBtn.addEventListener('click', closeModal);
    dom.cancelBtn.addEventListener('click', closeModal);

    // Close modal on overlay click
    dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dom.modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Content type tabs
    dom.tabText.addEventListener('click', () => switchContentTab('text'));
    dom.tabPdf.addEventListener('click', () => switchContentTab('pdf'));

    // Topic tag buttons
    document.querySelectorAll('.topic-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic;
            btn.classList.toggle('selected');

            if (btn.classList.contains('selected')) {
                if (!selectedTopics.includes(topic)) {
                    selectedTopics.push(topic);
                }
            } else {
                selectedTopics = selectedTopics.filter(t => t !== topic);
            }

            console.log(`[Tags] Selected topics: [${selectedTopics.join(', ')}]`);
        });
    });

    // Grade tag buttons
    document.querySelectorAll('.grade-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const grade = parseInt(btn.dataset.grade);
            btn.classList.toggle('selected');

            if (btn.classList.contains('selected')) {
                if (!selectedGrades.includes(grade)) {
                    selectedGrades.push(grade);
                }
            } else {
                selectedGrades = selectedGrades.filter(g => g !== grade);
            }

            console.log(`[Tags] Selected grades: [${selectedGrades.join(', ')}]`);
        });
    });

    // PDF file input
    dom.pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePdfFileSelected(e.target.files[0]);
        }
    });

    // Remove file button
    document.querySelector('.remove-file')?.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedPdfFile = null;
        dom.fileInfo.classList.add('hidden');
        dom.ocrBtn.classList.add('hidden');
        dom.ocrPreviewArea.classList.add('hidden');
        dom.pdfInput.value = '';
    });

    // OCR button
    dom.ocrBtn.addEventListener('click', runOcrPipeline);

    // Save button
    dom.saveBtn.addEventListener('click', handleSave);

    // Delete button (inside modal)
    dom.deleteBtn.addEventListener('click', handleDelete);

    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Export JSON before leaving to save your work.';
        }
    });

    console.log('[Init] Event listeners initialized');
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    console.log('[Init] Admin dashboard initializing...');

    initEventListeners();
    initDragAndDrop();

    // Check for existing admin session
    checkExistingSession();

    // Load OpenAI API key status
    const savedKey = getOpenAIApiKey();
    if (savedKey) {
        dom.openaiApiKey.value = '••••••••';
        dom.apiKeyStatus.textContent = 'Key saved';
        dom.apiKeyStatus.style.color = '#22c55e';
    }

    console.log('[Init] Admin dashboard initialized');
}

// Start the application
init();
