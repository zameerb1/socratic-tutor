/**
 * Curriculum Admin Dashboard
 * Manages curriculum CRUD operations, PDF upload with Mistral OCR,
 * and admin authentication for the Socratic Science Tutor.
 */

// ============================================================================
// Constants & Configuration
// ============================================================================

const ADMIN_EMAIL = 'drsameerb@gmail.com';
const MISTRAL_OCR_API_URL = 'https://api.mistral.ai/v1/ocr';
const MISTRAL_API_KEY = 'yuZDkE9CSp5mB4lfNvLyIrLcVbllAQqB';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

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

// ============================================================================
// Application State
// ============================================================================

let curriculumData = [];       // All loaded curriculum documents
let currentEditId = null;      // Document ID being edited (null for new)
let selectedTopics = [];       // Topics selected in the modal form
let selectedGrades = [];       // Grades selected in the modal form
let selectedPdfFile = null;    // File object for PDF upload
let activeContentTab = 'text'; // 'text' or 'pdf'

// ============================================================================
// DOM Element References
// ============================================================================

const dom = {
    // Auth
    authGate: document.getElementById('auth-gate'),
    dashboard: document.getElementById('admin-dashboard'),
    loginForm: document.getElementById('login-form'),
    adminEmailInput: document.getElementById('admin-email'),
    sendLinkBtn: document.getElementById('send-link-btn'),
    authStatus: document.getElementById('auth-status'),

    // Header
    adminEmailDisplay: document.getElementById('admin-email-display'),
    signOutBtn: document.getElementById('sign-out-btn'),

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
 * Returns a human-readable relative time string from a Firestore Timestamp.
 * @param {firebase.firestore.Timestamp} timestamp
 * @returns {string}
 */
function timeAgo(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return 'Unknown';
    }

    const now = Date.now();
    const then = timestamp.toDate().getTime();
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
// Authentication
// ============================================================================

/**
 * Checks if Firebase is properly configured and available.
 */
function isFirebaseConfigured() {
    return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
}

/**
 * Sends a passwordless sign-in link to the given email address.
 */
async function sendAdminLoginLink() {
    const email = dom.adminEmailInput.value.trim();

    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    console.log(`[Auth] Sending login link to: ${email}`);

    const actionCodeSettings = {
        url: window.location.href.split('?')[0],
        handleCodeInApp: true
    };

    try {
        dom.sendLinkBtn.disabled = true;
        dom.sendLinkBtn.textContent = 'Sending...';

        await auth.sendSignInLinkToEmail(email, actionCodeSettings);
        localStorage.setItem('emailForSignIn', email);

        dom.authStatus.textContent = 'Login link sent! Check your email and click the link to sign in.';
        dom.authStatus.style.color = '#22c55e';
        showToast('Login link sent! Check your email.', 'success');

        console.log('[Auth] Login link sent successfully');
    } catch (error) {
        console.error('[Auth] Error sending login link:', error.code, error.message);

        if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else if (error.code === 'auth/unauthorized-continue-uri') {
            showToast('This domain is not authorized. Add it in Firebase Console.', 'error');
        } else {
            showToast('Failed to send login link. Please try again.', 'error');
        }
    } finally {
        dom.sendLinkBtn.disabled = false;
        dom.sendLinkBtn.textContent = 'Send Login Link';
    }
}

/**
 * Completes sign-in if the current URL is a Firebase email sign-in link.
 */
async function completeEmailSignIn() {
    if (!isFirebaseConfigured() || !auth) return;

    if (auth.isSignInWithEmailLink(window.location.href)) {
        console.log('[Auth] Detected sign-in link in URL, completing sign-in');

        let email = localStorage.getItem('emailForSignIn');
        if (!email) {
            email = prompt('Please enter your email to confirm sign-in:');
        }

        if (email) {
            try {
                const result = await auth.signInWithEmailLink(email, window.location.href);
                localStorage.removeItem('emailForSignIn');
                window.history.replaceState({}, document.title, window.location.pathname);
                console.log('[Auth] Email link sign-in completed for:', result.user.email);
            } catch (error) {
                console.error('[Auth] Error completing email sign-in:', error);
                showToast('Failed to complete sign-in. The link may have expired.', 'error');
            }
        }
    }
}

/**
 * Handles auth state changes. Enforces admin-only access.
 * @param {firebase.User|null} user
 */
function handleAuthStateChange(user) {
    if (user) {
        console.log(`[Auth] User signed in: ${user.email}`);

        if (user.email !== ADMIN_EMAIL) {
            console.warn(`[Auth] Unauthorized user attempted access: ${user.email}`);
            auth.signOut();
            dom.authStatus.textContent = 'Access denied. This dashboard is restricted to the administrator.';
            dom.authStatus.style.color = '#ef4444';
            showToast('Access denied. Admin privileges required.', 'error');
            return;
        }

        // Authorized admin
        console.log('[Auth] Admin authenticated successfully');
        dom.authGate.classList.add('hidden');
        dom.dashboard.classList.remove('hidden');
        dom.adminEmailDisplay.textContent = user.email;

        loadCurriculum();
    } else {
        console.log('[Auth] No user signed in, showing auth gate');
        dom.authGate.classList.remove('hidden');
        dom.dashboard.classList.add('hidden');
        dom.authStatus.textContent = 'Please sign in with the admin email.';
        dom.authStatus.style.color = '';
    }
}

/**
 * Signs the admin out and returns to the auth gate.
 */
async function signOutAdmin() {
    try {
        console.log('[Auth] Signing out admin');
        await auth.signOut();
        curriculumData = [];
        showToast('Signed out successfully.', 'info');
    } catch (error) {
        console.error('[Auth] Sign-out error:', error);
        showToast('Error signing out.', 'error');
    }
}

// ============================================================================
// Firestore CRUD Operations
// ============================================================================

/**
 * Loads all active curriculum documents from Firestore.
 */
async function loadCurriculum() {
    console.log('[Firestore] Loading curriculum data...');

    try {
        const snapshot = await db.collection('curriculum')
            .where('isActive', '==', true)
            .orderBy('updatedAt', 'desc')
            .get();

        curriculumData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`[Firestore] Loaded ${curriculumData.length} curriculum items`);
        updateStats();
        renderCurriculum();
    } catch (error) {
        console.error('[Firestore] Error loading curriculum:', error);
        showToast('Failed to load curriculum data.', 'error');
    }
}

/**
 * Creates a new curriculum document in Firestore.
 * @param {Object} data - The curriculum data to save
 * @returns {string|null} The new document ID, or null on failure
 */
async function createCurriculum(data) {
    console.log('[Firestore] Creating new curriculum item:', data.title);

    try {
        const docData = {
            title: data.title,
            content: data.content,
            contentType: data.contentType,
            pdfStoragePath: data.pdfStoragePath || null,
            pdfFileName: data.pdfFileName || null,
            topics: data.topics,
            grades: data.grades,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: ADMIN_EMAIL
        };

        const docRef = await db.collection('curriculum').add(docData);
        console.log(`[Firestore] Created document with ID: ${docRef.id}`);
        showToast('Curriculum item created successfully.', 'success');
        return docRef.id;
    } catch (error) {
        console.error('[Firestore] Error creating curriculum:', error);
        showToast('Failed to create curriculum item.', 'error');
        return null;
    }
}

/**
 * Updates an existing curriculum document in Firestore.
 * @param {string} docId - The Firestore document ID
 * @param {Object} data - The fields to update
 * @returns {boolean} Whether the update succeeded
 */
async function updateCurriculum(docId, data) {
    console.log(`[Firestore] Updating curriculum item: ${docId}`, data.title);

    try {
        const updateData = {
            title: data.title,
            content: data.content,
            contentType: data.contentType,
            topics: data.topics,
            grades: data.grades,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Only update PDF fields if they are provided (preserves existing PDF on text edits)
        if (data.pdfStoragePath !== undefined) {
            updateData.pdfStoragePath = data.pdfStoragePath;
        }
        if (data.pdfFileName !== undefined) {
            updateData.pdfFileName = data.pdfFileName;
        }

        await db.collection('curriculum').doc(docId).update(updateData);
        console.log(`[Firestore] Updated document: ${docId}`);
        showToast('Curriculum item updated successfully.', 'success');
        return true;
    } catch (error) {
        console.error('[Firestore] Error updating curriculum:', error);
        showToast('Failed to update curriculum item.', 'error');
        return false;
    }
}

/**
 * Soft-deletes a curriculum document by setting isActive to false.
 * @param {string} docId - The Firestore document ID
 * @returns {boolean} Whether the soft-delete succeeded
 */
async function softDeleteCurriculum(docId) {
    console.log(`[Firestore] Soft-deleting curriculum item: ${docId}`);

    try {
        await db.collection('curriculum').doc(docId).update({
            isActive: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Firestore] Soft-deleted document: ${docId}`);
        showToast('Curriculum item deleted.', 'success');
        return true;
    } catch (error) {
        console.error('[Firestore] Error deleting curriculum:', error);
        showToast('Failed to delete curriculum item.', 'error');
        return false;
    }
}

// ============================================================================
// PDF Upload & Mistral OCR
// ============================================================================

/**
 * Uploads a PDF file to Firebase Storage.
 * @param {File} file - The PDF file to upload
 * @returns {string|null} The storage path, or null on failure
 */
async function uploadPdfToStorage(file) {
    const timestamp = Date.now();
    const storagePath = `curriculum-pdfs/${timestamp}_${file.name}`;
    console.log(`[Storage] Uploading PDF to: ${storagePath}, size: ${formatFileSize(file.size)}`);

    try {
        const storageRef = storage.ref(storagePath);
        const uploadTask = await storageRef.put(file);
        console.log(`[Storage] Upload complete: ${storagePath}`);
        return storagePath;
    } catch (error) {
        console.error('[Storage] Upload error:', error);
        showToast('Failed to upload PDF to storage.', 'error');
        return null;
    }
}

/**
 * Reads a File object as a base64-encoded string.
 * @param {File} file
 * @returns {Promise<string>} Base64-encoded file content
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // reader.result is "data:application/pdf;base64,..." -- extract just the base64 part
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Calls the Mistral OCR API to extract text from a PDF.
 * @param {File} file - The PDF file
 * @returns {string|null} Extracted markdown text, or null on failure
 */
async function extractTextWithOCR(file) {
    console.log(`[OCR] Starting OCR for file: ${file.name}, size: ${formatFileSize(file.size)}`);

    try {
        const base64Data = await readFileAsBase64(file);
        console.log(`[OCR] File encoded to base64, length: ${base64Data.length} characters`);

        const documentUrl = `data:application/pdf;base64,${base64Data}`;

        const payload = {
            model: 'mistral-ocr-latest',
            document: {
                type: 'document_url',
                document_url: documentUrl
            }
        };

        console.log('[OCR] Sending request to Mistral OCR API...');
        const response = await fetch(MISTRAL_OCR_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[OCR] API returned ${response.status}: ${errorBody}`);
            throw new Error(`OCR API request failed with status ${response.status}`);
        }

        const result = await response.json();
        console.log(`[OCR] Received response with ${result.pages ? result.pages.length : 0} pages`);

        const extractedText = (result.pages || [])
            .map(page => page.markdown || '')
            .join('\n\n');

        console.log(`[OCR] Extracted ${extractedText.length} characters of text`);
        return extractedText;
    } catch (error) {
        console.error('[OCR] Error during OCR processing:', error);
        showToast('OCR processing failed. Please try again or enter text manually.', 'error');
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

    console.log('[OCR] Starting OCR pipeline');

    // Show progress
    dom.ocrBtn.classList.add('hidden');
    dom.ocrProgress.classList.remove('hidden');
    dom.ocrPreviewArea.classList.add('hidden');

    const progressFill = dom.ocrProgress.querySelector('.progress-fill');
    const progressText = dom.ocrProgress.querySelector('.progress-text');

    // Animate progress bar (indeterminate-style with stages)
    progressFill.style.width = '20%';
    progressText.textContent = 'Reading PDF file...';

    await new Promise(r => setTimeout(r, 500));
    progressFill.style.width = '40%';
    progressText.textContent = 'Sending to OCR service...';

    const extractedText = await extractTextWithOCR(selectedPdfFile);

    if (extractedText !== null) {
        progressFill.style.width = '90%';
        progressText.textContent = 'Processing results...';

        await new Promise(r => setTimeout(r, 300));
        progressFill.style.width = '100%';
        progressText.textContent = 'OCR complete!';

        // Show extracted text in editable preview
        dom.ocrPreview.value = extractedText;
        dom.ocrPreviewArea.classList.remove('hidden');

        await new Promise(r => setTimeout(r, 600));
        dom.ocrProgress.classList.add('hidden');

        showToast('Text extracted successfully. You can edit it before saving.', 'success');
        console.log('[OCR] Pipeline completed successfully');
    } else {
        // OCR failed
        progressFill.style.width = '100%';
        progressFill.style.backgroundColor = '#ef4444';
        progressText.textContent = 'OCR failed. Try again or enter text manually.';

        await new Promise(r => setTimeout(r, 2000));
        dom.ocrProgress.classList.add('hidden');
        dom.ocrBtn.classList.remove('hidden');

        console.error('[OCR] Pipeline failed');
    }
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

    // Reset progress bar color
    const progressFill = dom.ocrProgress.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.style.backgroundColor = '';
    }

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
 * Gathers form data, validates, and saves (create or update) the curriculum item.
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
    let pdfStoragePath = null;
    let pdfFileName = null;

    if (activeContentTab === 'pdf') {
        contentType = 'pdf';
        content = dom.ocrPreview.value.trim();

        if (!content && !selectedPdfFile) {
            showToast('Please upload a PDF and process it with OCR, or switch to text mode.', 'error');
            return;
        }

        // Upload PDF if a new file was selected
        if (selectedPdfFile) {
            dom.saveBtn.disabled = true;
            dom.saveBtn.textContent = 'Uploading...';

            pdfStoragePath = await uploadPdfToStorage(selectedPdfFile);
            if (!pdfStoragePath) {
                dom.saveBtn.disabled = false;
                dom.saveBtn.textContent = 'Save';
                return;
            }
            pdfFileName = selectedPdfFile.name;
        } else if (currentEditId) {
            // Editing existing PDF item without re-uploading
            const existingDoc = curriculumData.find(d => d.id === currentEditId);
            if (existingDoc) {
                pdfStoragePath = existingDoc.pdfStoragePath;
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

    if (selectedTopics.length === 0) {
        showToast('Please select at least one topic.', 'error');
        return;
    }

    if (selectedGrades.length === 0) {
        showToast('Please select at least one grade level.', 'error');
        return;
    }

    const data = {
        title,
        content,
        contentType,
        pdfStoragePath,
        pdfFileName,
        topics: [...selectedTopics],
        grades: [...selectedGrades].sort((a, b) => a - b)
    };

    console.log('[Save] Saving curriculum item:', { ...data, content: truncateText(data.content, 100) });

    dom.saveBtn.disabled = true;
    dom.saveBtn.textContent = 'Saving...';

    let success = false;
    if (currentEditId) {
        success = await updateCurriculum(currentEditId, data);
    } else {
        const newId = await createCurriculum(data);
        success = newId !== null;
    }

    dom.saveBtn.disabled = false;
    dom.saveBtn.textContent = 'Save';

    if (success) {
        closeModal();
        await loadCurriculum();
    }
}

/**
 * Handles the delete button click inside the modal.
 */
async function handleDelete() {
    if (!currentEditId) return;

    const doc = curriculumData.find(d => d.id === currentEditId);
    const titleDisplay = doc ? doc.title : currentEditId;

    if (!confirm(`Are you sure you want to delete "${titleDisplay}"? This action can be undone by an administrator.`)) {
        return;
    }

    console.log(`[Delete] User confirmed deletion of: ${currentEditId}`);

    dom.deleteBtn.disabled = true;
    dom.deleteBtn.textContent = 'Deleting...';

    const success = await softDeleteCurriculum(currentEditId);

    dom.deleteBtn.disabled = false;
    dom.deleteBtn.textContent = 'Delete';

    if (success) {
        closeModal();
        await loadCurriculum();
    }
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Updates the stats bar with current curriculum counts.
 */
function updateStats() {
    const total = curriculumData.length;
    const active = curriculumData.filter(d => d.isActive !== false).length;
    const uniqueTopics = new Set();
    curriculumData.forEach(d => {
        (d.topics || []).forEach(t => uniqueTopics.add(t));
    });

    dom.statTotal.textContent = total;
    dom.statActive.textContent = active;
    dom.statTopics.textContent = uniqueTopics.size;

    console.log(`[Stats] Total: ${total}, Active: ${active}, Topics: ${uniqueTopics.size}`);
}

/**
 * Renders the curriculum cards into the grid, applying active filters.
 */
function renderCurriculum() {
    const filterTopic = dom.filterTopic.value;
    const filterGrade = dom.filterGrade.value;

    console.log(`[Render] Rendering curriculum. Filter - topic: "${filterTopic}", grade: "${filterGrade}"`);

    // Apply filters
    let filtered = curriculumData;

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
    const deleteBtn = card.querySelector('.btn-card-delete');

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('edit', doc.id);
    });

    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
            const success = await softDeleteCurriculum(doc.id);
            if (success) {
                await loadCurriculum();
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
        sendAdminLoginLink();
    });

    // Auth: Sign out
    dom.signOutBtn.addEventListener('click', signOutAdmin);

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

    // OCR button
    dom.ocrBtn.addEventListener('click', runOcrPipeline);

    // Save button
    dom.saveBtn.addEventListener('click', handleSave);

    // Delete button (inside modal)
    dom.deleteBtn.addEventListener('click', handleDelete);

    console.log('[Init] Event listeners initialized');
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    console.log('[Init] Admin dashboard initializing...');

    initEventListeners();
    initDragAndDrop();

    if (isFirebaseConfigured() && auth) {
        // Complete email sign-in if returning from a login link
        completeEmailSignIn();

        // Listen for auth state changes
        auth.onAuthStateChanged(handleAuthStateChange);
        console.log('[Init] Firebase auth listener attached');
    } else {
        console.error('[Init] Firebase is not configured. Admin dashboard requires Firebase.');
        dom.authStatus.textContent = 'Firebase is not configured. Please set up firebase-config.js.';
        dom.authStatus.style.color = '#ef4444';
    }

    console.log('[Init] Admin dashboard initialized');
}

// Start the application
init();
