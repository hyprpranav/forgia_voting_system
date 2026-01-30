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
        } else {
            // Fallback: assume expired if can't parse
            return true;
        }
        
        return new Date() > expiryDate;
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
            return false;
        }
        
        const data = codeDoc.data();
        const usedTeams = data.usedTeams || [];
        
        return usedTeams.includes(teamId);
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
            return { allowed: false, message: 'Code not found' };
        }
        
        const data = codeDoc.data();
        const lastVoteAt = data.lastVoteAt;
        
        if (!lastVoteAt) {
            return { allowed: true };
        }
        
        let lastVoteDate;
        if (lastVoteAt.toDate) {
            lastVoteDate = lastVoteAt.toDate();
        } else if (lastVoteAt instanceof Date) {
            lastVoteDate = lastVoteAt;
        } else {
            return { allowed: true };
        }
        
        const now = new Date();
        const diffSeconds = (now - lastVoteDate) / 1000;
        const waitTime = 30; // 30 seconds
        
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
    try {
        // 1. Validate code format
        if (!isValidCodeFormat(code)) {
            return { success: false, message: 'Invalid code format. Use 2-3 digits.' };
        }
        
        // 2. Check if code exists and is not expired
        const expired = await isCodeExpired(code);
        if (expired) {
            return { success: false, message: 'This code has expired or does not exist.' };
        }
        
        // 3. Check rate limit
        const rateLimit = await checkRateLimit(code);
        if (!rateLimit.allowed) {
            return { success: false, message: rateLimit.message };
        }
        
        // 4. Check if already voted for this team
        const alreadyVoted = await hasVotedForTeam(code, teamId);
        if (alreadyVoted) {
            return { success: false, message: 'You have already voted for this team.' };
        }
        
        // 5. Submit vote using Firestore transaction
        await db.runTransaction(async (transaction) => {
            // Get current team data
            const teamRef = db.collection('teams').doc(teamId);
            const teamDoc = await transaction.get(teamRef);
            
            // Create team if doesn't exist
            if (!teamDoc.exists) {
                transaction.set(teamRef, {
                    teamId: teamId,
                    teamName: teamName,
                    votes: 1
                });
            } else {
                const currentVotes = teamDoc.data().votes || 0;
                transaction.update(teamRef, {
                    votes: currentVotes + 1
                });
            }
            
            // Update voting code
            const codeRef = db.collection('votingCodes').doc(code);
            const codeDoc = await transaction.get(codeRef);
            const usedTeams = codeDoc.data().usedTeams || [];
            
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
        });
        
        return { success: true, message: 'Vote submitted successfully!' };
    } catch (error) {
        console.error('Error submitting vote:', error);
        return { success: false, message: 'An error occurred. Please try again.' };
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
