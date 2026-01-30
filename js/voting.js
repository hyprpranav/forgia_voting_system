// Voting Page Logic

let currentTeamId = '';
let currentTeamName = '';

// DOM Elements
const teamNameDisplay = document.getElementById('teamName');
const teamIdDisplay = document.getElementById('teamIdDisplay');
const votingForm = document.getElementById('votingForm');
const votingCodeInput = document.getElementById('votingCode');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const statusMessage = document.getElementById('statusMessage');
const successScreen = document.getElementById('successScreen');
const errorDisplay = document.getElementById('errorDisplay');
const successTeamName = document.getElementById('successTeamName');
const scanAnotherBtn = document.getElementById('scanAnotherBtn');
const retryBtn = document.getElementById('retryBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTeamFromURL();
    
    // Event Listeners
    votingForm.addEventListener('submit', handleVoteSubmit);
    scanAnotherBtn.addEventListener('click', handleScanAnother);
    retryBtn.addEventListener('click', resetForm);
    
    // Auto-focus on code input
    votingCodeInput.focus();
    
    // Allow only numbers in code input
    votingCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
});

// Load team information from URL parameters
function loadTeamFromURL() {
    currentTeamId = getURLParameter('team');
    currentTeamName = getURLParameter('name');
    
    if (!currentTeamId) {
        showError(
            'Invalid QR Code',
            'This QR code is invalid. Please scan a valid team QR code.',
            false
        );
        votingForm.style.display = 'none';
        return;
    }
    
    // If no team name provided, use team ID
    if (!currentTeamName) {
        currentTeamName = currentTeamId;
    }
    
    // Display team information
    teamNameDisplay.textContent = sanitizeInput(currentTeamName);
    teamIdDisplay.textContent = sanitizeInput(currentTeamId);
    
    // Set page title
    document.title = `Vote for ${currentTeamName}`;
}

// Handle vote submission
async function handleVoteSubmit(e) {
    e.preventDefault();
    
    const code = votingCodeInput.value.trim();
    
    console.log('=== Vote Form Submitted ===');
    console.log('Entered code:', code);
    console.log('Team ID:', currentTeamId);
    console.log('Team Name:', currentTeamName);
    
    if (!code) {
        showStatus('Please enter your voting code', 'error');
        return;
    }
    
    if (!isValidCodeFormat(code)) {
        showStatus('Invalid code format. Please enter 2-3 digits.', 'error');
        return;
    }
    
    try {
        // Disable form
        submitVoteBtn.disabled = true;
        submitVoteBtn.textContent = 'Submitting...';
        showLoading();
        
        console.log('Calling submitVote function...');
        
        // Submit vote
        const result = await submitVote(code, currentTeamId, currentTeamName);
        
        console.log('Vote result:', result);
        
        hideLoading();
        
        if (result.success) {
            console.log('Vote successful!');
            showSuccess();
        } else {
            console.log('Vote failed:', result.message);
            showStatus(result.message, 'error');
            submitVoteBtn.disabled = false;
            submitVoteBtn.textContent = 'Submit Vote 🎉';
        }
    } catch (error) {
        console.error('=== Vote submission exception ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        hideLoading();
        showStatus(`Error: ${error.message || 'Unknown error occurred'}`, 'error');
        submitVoteBtn.disabled = false;
        submitVoteBtn.textContent = 'Submit Vote 🎉';
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

// Show success screen
function showSuccess() {
    votingForm.style.display = 'none';
    statusMessage.style.display = 'none';
    successTeamName.textContent = currentTeamName;
    successScreen.style.display = 'block';
    
    // Play success animation
    const checkmark = document.querySelector('.checkmark');
    checkmark.style.animation = 'none';
    setTimeout(() => {
        checkmark.style.animation = 'checkmarkPop 0.5s ease';
    }, 10);
}

// Show error screen
function showError(title, message, allowRetry = true) {
    votingForm.style.display = 'none';
    statusMessage.style.display = 'none';
    successScreen.style.display = 'none';
    
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    retryBtn.style.display = allowRetry ? 'inline-block' : 'none';
    
    errorDisplay.style.display = 'block';
}

// Reset form
function resetForm() {
    votingForm.style.display = 'block';
    successScreen.style.display = 'none';
    errorDisplay.style.display = 'none';
    statusMessage.style.display = 'none';
    
    votingCodeInput.value = '';
    submitVoteBtn.disabled = false;
    submitVoteBtn.textContent = 'Submit Vote 🎉';
    votingCodeInput.focus();
}

// Handle "Scan Another Team" button
function handleScanAnother() {
    // Redirect to instruction page (or clear URL to show "Scan QR" state)
    window.location.href = window.location.pathname;
}

// Show initial "Scan QR" state if no team parameter
if (!getURLParameter('team')) {
    document.querySelector('.voting-card').innerHTML = `
        <div class="scan-instruction">
            <div class="qr-icon">📱</div>
            <h2>Scan Team QR Code</h2>
            <p>Point your camera at a team's QR code to start voting</p>
            <div class="instructions">
                <h3>Steps to Vote:</h3>
                <ol>
                    <li>Get your voting code at the entrance</li>
                    <li>Scan team QR code</li>
                    <li>Enter your code</li>
                    <li>Submit your vote!</li>
                </ol>
            </div>
        </div>
    `;
}

// Prevent multiple submissions
let isSubmitting = false;

votingForm.addEventListener('submit', async (e) => {
    if (isSubmitting) {
        e.preventDefault();
        return;
    }
    isSubmitting = true;
    
    // Will be reset by handleVoteSubmit
    setTimeout(() => {
        isSubmitting = false;
    }, 3000);
});
