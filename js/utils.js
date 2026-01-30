// Shared Utility Functions

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Format timestamp to readable date
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    
    return date.toLocaleString();
}

// Validate voting code format (2-3 digits)
function isValidCodeFormat(code) {
    return /^\d{2,3}$/.test(code);
}

// Check if code is expired
async function isCodeExpired(code) {
    try {
        const codeDoc = await db.collection('votingCodes').doc(code).get();
        
        if (!codeDoc.exists) {
            console.log('Code does not exist:', code);
            return true; // Code doesn't exist = expired
        }
        
        const data = codeDoc.data();
        const expiresAt = data.expiresAt;
        
        // Handle different timestamp formats
        let expiryDate;
        if (expiresAt && expiresAt.toDate) {
            expiryDate = expiresAt.toDate();
        } else if (expiresAt instanceof Date) {
            expiryDate = expiresAt;
        } else if (typeof expiresAt === 'number') {
            // Handle milliseconds timestamp
            expiryDate = new Date(expiresAt);
        } else if (typeof expiresAt === 'string') {
            expiryDate = new Date(parseInt(expiresAt));
        } else {
            console.log('Could not parse expiry date:', expiresAt);
            return true;
        }
        
        const isExpired = new Date() > expiryDate;
        console.log('Code expiry check:', code, 'Expires:', expiryDate, 'Expired:', isExpired);
        return isExpired;
    } catch (error) {
        console.error('Error checking code expiry:', error);
        return true; // Assume expired on error
    }
}

// Check if code has already voted for a team
async function hasVotedForTeam(code, teamId) {
    try {
        const codeDoc = await db.collection('votingCodes').doc(code).get();
        
        if (!codeDoc.exists) {
            console.log('Vote check - code not found:', code);
            return false;
        }
        
        const data = codeDoc.data();
        const usedTeams = data.usedTeams || [];
        
        const hasVoted = usedTeams.includes(teamId);
        console.log('Vote check - already voted for team?', hasVoted, 'Used teams:', usedTeams);
        
        return hasVoted;
    } catch (error) {
        console.error('Error checking vote status:', error);
        return false;
    }
}

// Check rate limit (30 seconds between votes)
async function checkRateLimit(code) {
    try {
        const codeDoc = await db.collection('votingCodes').doc(code).get();
        
        if (!codeDoc.exists) {
            console.log('Rate limit check - code not found:', code);
            return { allowed: false, message: 'Code not found' };
        }
        
        const data = codeDoc.data();
        const lastVoteAt = data.lastVoteAt;
        
        if (!lastVoteAt) {
            console.log('Rate limit check - no previous vote');
            return { allowed: true };
        }
        
        let lastVoteDate;
        if (lastVoteAt.toDate) {
            lastVoteDate = lastVoteAt.toDate();
        } else if (lastVoteAt instanceof Date) {
            lastVoteDate = lastVoteAt;
        } else if (typeof lastVoteAt === 'number') {
            lastVoteDate = new Date(lastVoteAt);
        } else {
            console.log('Rate limit check - could not parse lastVoteAt, allowing');
            return { allowed: true };
        }
        
        const now = new Date();
        const diffSeconds = (now - lastVoteDate) / 1000;
        const waitTime = 30; // 30 seconds
        
        console.log('Rate limit check - seconds since last vote:', diffSeconds);
        
        if (diffSeconds < waitTime) {
            const remaining = Math.ceil(waitTime - diffSeconds);
            return { 
                allowed: false, 
                message: `Please wait ${remaining} seconds before voting again` 
            };
        }
        
        return { allowed: true };
    } catch (error) {
        console.error('Error checking rate limit:', error);
        return { allowed: false, message: 'Error checking rate limit' };
    }
}

// Submit a vote
async function submitVote(code, teamId, teamName) {
    console.log('=== Starting vote submission ===');
    console.log('Code:', code, 'Team ID:', teamId, 'Team Name:', teamName);
    
    try {
        // 1. Validate code format
        if (!isValidCodeFormat(code)) {
            console.log('FAILED: Invalid code format');
            return { success: false, message: 'Invalid code format. Please enter 2-3 digits.' };
        }
        console.log('✓ Code format valid');
        
        // 2. Check if code exists and is not expired
        const expired = await isCodeExpired(code);
        if (expired) {
            console.log('FAILED: Code expired or does not exist');
            return { success: false, message: 'Invalid code. This code does not exist or has expired.' };
        }
        console.log('✓ Code exists and not expired');
        
        // 3. Check rate limit
        const rateLimit = await checkRateLimit(code);
        if (!rateLimit.allowed) {
            console.log('FAILED: Rate limit');
            return { success: false, message: rateLimit.message };
        }
        console.log('✓ Rate limit check passed');
        
        // 4. Check if already voted for this team
        const alreadyVoted = await hasVotedForTeam(code, teamId);
        if (alreadyVoted) {
            console.log('FAILED: Already voted for this team');
            return { success: false, message: 'You have already voted for this team. Try voting for other teams!' };
        }
        console.log('✓ Has not voted for this team yet');
        
        // 5. Submit vote using Firestore transaction
        console.log('Starting Firestore transaction...');
        await db.runTransaction(async (transaction) => {
            // Get current team data
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await transaction.get(teamRef);
            
            // Create team if doesn't exist
            if (!teamDoc.exists) {
                console.log('Creating new team entry');
                transaction.set(teamRef, {
                    teamId: teamId,
                    teamName: teamName,
                    votes: 1,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const currentVotes = teamDoc.data().votes || 0;
                console.log('Updating team vote count from', currentVotes, 'to', currentVotes + 1);
                transaction.update(teamRef, {
                    votes: currentVotes + 1
                });
            }
            
            // Update voting code
            const codeRef = db.collection('votingCodes').doc(code);
            const codeDoc = await transaction.get(codeRef);
            
            if (!codeDoc.exists) {
                throw new Error('Code document disappeared during transaction');
            }
            
            const usedTeams = codeDoc.data().usedTeams || [];
            console.log('Updating code usedTeams:', [...usedTeams, teamId]);
            
            transaction.update(codeRef, {
                usedTeams: [...usedTeams, teamId],
                lastVoteAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Record detailed vote
            const voteRef = db.collection('votes').doc();
            transaction.set(voteRef, {
                teamId: teamId,
                teamName: teamName,
                code: code,
                votedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('Transaction completed successfully');
        });
        
        console.log('=== Vote submitted successfully! ===');
        return { success: true, message: 'Vote submitted successfully!' };
    } catch (error) {
        console.error('=== ERROR submitting vote ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Return more specific error messages
        if (error.message && error.message.includes('permission')) {
            return { success: false, message: 'Permission denied. Please check Firebase rules.' };
        } else if (error.message && error.message.includes('not found')) {
            return { success: false, message: 'Code not found. Please try again.' };
        } else {
            return { success: false, message: `Error: ${error.message || 'Unknown error occurred'}` };
        }
    }
}

// Get all teams with vote counts
async function getTeamStats() {
    try {
        const snapshot = await db.collection('teams')
            .orderBy('votes', 'desc')
            .get();
        
        const teams = [];
        snapshot.forEach(doc => {
            teams.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return teams;
    } catch (error) {
        console.error('Error getting team stats:', error);
        return [];
    }
}

// Get total vote count
async function getTotalVotes() {
    try {
        const snapshot = await db.collection('votes').get();
        return snapshot.size;
    } catch (error) {
        console.error('Error getting total votes:', error);
        return 0;
    }
}

// Get active code count (non-expired)
async function getActiveCodesCount() {
    try {
        const now = firebase.firestore.Timestamp.now();
        const snapshot = await db.collection('votingCodes')
            .where('expiresAt', '>', now)
            .get();
        return snapshot.size;
    } catch (error) {
        console.error('Error getting active codes:', error);
        return 0;
    }
}

// Export results as CSV
function exportToCSV(teams) {
    const headers = ['Rank', 'Team ID', 'Team Name', 'Votes'];
    const rows = teams.map((team, index) => [
        index + 1,
        team.teamId || team.id,
        team.teamName || 'Unknown',
        team.votes || 0
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voting_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Results exported successfully!', 'success');
}

// Get URL parameter
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}
