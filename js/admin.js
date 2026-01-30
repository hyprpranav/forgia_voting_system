// Admin Dashboard Logic

let esp32IP = localStorage.getItem('esp32IP') || '192.168.1.100';
let esp32Connected = false;
let codeCheckInterval = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const esp32IPInput = document.getElementById('esp32IP');
const connectESP32Btn = document.getElementById('connectESP32Btn');
const esp32Status = document.getElementById('esp32Status');
const esp32StatusText = document.getElementById('esp32StatusText');
const currentCode = document.getElementById('currentCode');
const codeTimestamp = document.getElementById('codeTimestamp');
const manualGenerateBtn = document.getElementById('manualGenerateBtn');
const teamNameInput = document.getElementById('teamName');
const teamIdInput = document.getElementById('teamId');
const generateQRBtn = document.getElementById('generateQRBtn');
const qrResult = document.getElementById('qrResult');
const downloadQRBtn = document.getElementById('downloadQRBtn');
const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
const exportResultsBtn = document.getElementById('exportResultsBtn');
const refreshCodesBtn = document.getElementById('refreshCodesBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    esp32IPInput.value = esp32IP;
    
    // Event Listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    connectESP32Btn.addEventListener('click', handleConnectESP32);
    manualGenerateBtn.addEventListener('click', handleManualGenerate);
    generateQRBtn.addEventListener('click', handleGenerateQR);
    downloadQRBtn.addEventListener('click', handleDownloadQR);
    refreshAnalyticsBtn.addEventListener('click', loadAnalytics);
    exportResultsBtn.addEventListener('click', handleExportResults);
    refreshCodesBtn.addEventListener('click', loadAllCodes);
    deleteAllBtn.addEventListener('click', handleDeleteAll);
});

// Authentication
function checkAuthState() {
    auth.onAuthStateChanged(user => {
        if (user) {
            showDashboard();
        } else {
            showLogin();
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        showLoading();
        await auth.signInWithEmailAndPassword(email, password);
        loginError.textContent = '';
        showToast('Login successful!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = error.message;
        showToast('Login failed!', 'error');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    auth.signOut();
    showToast('Logged out successfully', 'info');
}

function showLogin() {
    loginScreen.style.display = 'flex';
    dashboardScreen.style.display = 'none';
    stopCodePolling();
}

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    loadAnalytics();
}

// ESP32 Connection
async function handleConnectESP32() {
    esp32IP = esp32IPInput.value.trim();
    
    if (!esp32IP) {
        showToast('Please enter ESP32 IP address', 'error');
        return;
    }
    
    try {
        connectESP32Btn.textContent = 'Connecting...';
        connectESP32Btn.disabled = true;
        
        // Test connection with health check
        const response = await fetch(`http://${esp32IP}/health`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'online') {
                esp32Connected = true;
                updateConnectionStatus(true);
                localStorage.setItem('esp32IP', esp32IP);
                showToast('ESP32 connected successfully!', 'success');
                
                // Start polling for codes
                startCodePolling();
            }
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        console.error('ESP32 connection error:', error);
        esp32Connected = false;
        updateConnectionStatus(false);
        showToast('Failed to connect to ESP32', 'error');
    } finally {
        connectESP32Btn.textContent = 'Connect';
        connectESP32Btn.disabled = false;
    }
}

function updateConnectionStatus(connected) {
    if (connected) {
        esp32Status.className = 'status-indicator status-online';
        esp32StatusText.textContent = `Connected (${esp32IP})`;
    } else {
        esp32Status.className = 'status-indicator status-offline';
        esp32StatusText.textContent = 'Not Connected';
    }
}

// Code Polling
function startCodePolling() {
    if (codeCheckInterval) {
        clearInterval(codeCheckInterval);
    }
    
    // Poll every 2 seconds
    codeCheckInterval = setInterval(checkForNewCode, 2000);
    checkForNewCode(); // Check immediately
}

function stopCodePolling() {
    if (codeCheckInterval) {
        clearInterval(codeCheckInterval);
        codeCheckInterval = null;
    }
}

async function checkForNewCode() {
    if (!esp32Connected) return;
    
    try {
        const response = await fetch(`http://${esp32IP}/getLatestCode`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.code && data.code !== '---' && data.code !== currentCode.textContent) {
                displayCode(data.code);
            }
        }
    } catch (error) {
        console.error('Error checking for code:', error);
        // Don't show error toast to avoid spam
    }
}

function displayCode(code) {
    currentCode.textContent = code;
    codeTimestamp.textContent = formatTimestamp(new Date());
    
    // Animate the code display
    currentCode.classList.add('pulse');
    setTimeout(() => {
        currentCode.classList.remove('pulse');
    }, 1000);
}

// Manual Code Generation
async function handleManualGenerate() {
    try {
        manualGenerateBtn.textContent = 'Generating...';
        manualGenerateBtn.disabled = true;
        
        // Generate random 2-3 digit code
        const code = String(Math.floor(Math.random() * (999 - 10 + 1)) + 10);
        
        // Calculate expiry time (45 minutes from now)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 45 * 60 * 1000);
        
        // Detect if running on localhost or hosted
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.includes('192.168');
        const generatedBy = isLocalhost ? 'localhost' : 'hosted';
        
        // Save directly to Firebase
        await db.collection('votingCodes').doc(code).set({
            code: code,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            usedTeams: [],
            generatedBy: generatedBy,
            generatedVia: 'manual'
        });
        
        // Display the code
        displayCode(code);
        showToast('Code generated and saved to Firebase!', 'success');
        
        // Refresh codes list
        setTimeout(() => loadAllCodes(), 500);
        
        // If ESP32 is connected, also try to sync
        if (esp32Connected) {
            try {
                await fetch(`http://${esp32IP}/generateCode`, {
                    method: 'POST',
                    mode: 'cors'
                });
            } catch (error) {
                console.log('ESP32 sync skipped (offline)');
            }
        }
        
    } catch (error) {
        console.error('Manual generate error:', error);
        showToast('Failed to generate code: ' + error.message, 'error');
    } finally {
        manualGenerateBtn.textContent = 'Manual Generate';
        manualGenerateBtn.disabled = false;
    }
}

// QR Code Generation
async function handleGenerateQR() {
    const teamName = teamNameInput.value.trim();
    const teamId = teamIdInput.value.trim();
    
    if (!teamName || !teamId) {
        showToast('Please enter both team name and ID', 'error');
        return;
    }
    
    try {
        generateQRBtn.disabled = true;
        generateQRBtn.textContent = 'Generating...';
        
        // Detect if running on localhost or hosted
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.includes('192.168');
        const qrGeneratedBy = isLocalhost ? 'localhost' : 'hosted';
        
        // Save team to Firebase
        await db.collection('teams').doc(teamId).set({
            teamId: teamId,
            teamName: teamName,
            votes: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            qrGeneratedBy: qrGeneratedBy,
            qrGeneratedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Clear previous QR code
        const qrcodeDiv = document.getElementById('qrcode');
        qrcodeDiv.innerHTML = '';
        
        // Generate voting URL
        const votingURL = `${window.location.origin}${window.location.pathname.replace('index.html', '')}vote.html?team=${encodeURIComponent(teamId)}&name=${encodeURIComponent(teamName)}`;
        
        // Generate QR code
        new QRCode(qrcodeDiv, {
            text: votingURL,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Update team name label
        document.getElementById('teamNameLabel').textContent = teamName;
        
        // Show result
        qrResult.style.display = 'block';
        
        showToast('Team saved & QR Code generated!', 'success');
        
        // Refresh analytics to show new team
        setTimeout(() => loadAnalytics(), 500);
    } catch (error) {
        console.error('Error saving team:', error);
        showToast('Failed to save team data', 'error');
    } finally {
        generateQRBtn.disabled = false;
        generateQRBtn.textContent = 'Generate QR Code';
    }
}

function handleDownloadQR() {
    const teamName = teamNameInput.value.trim();
    
    // Get the QR code canvas
    const qrCanvas = document.querySelector('#qrcode canvas');
    
    if (!qrCanvas) {
        showToast('Please generate a QR code first', 'error');
        return;
    }
    
    // Create a larger canvas with team name
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (QR + padding + text)
    canvas.width = 300;
    canvas.height = 350;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw QR code centered
    const qrSize = 256;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 20;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    
    // Draw team name
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(teamName, canvas.width / 2, 310);
    
    // Download
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${teamName.replace(/\s+/g, '_')}_QR.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('QR Code downloaded!', 'success');
    });
}

// Analytics
async function loadAnalytics() {
    try {
        refreshAnalyticsBtn.textContent = 'Loading...';
        refreshAnalyticsBtn.disabled = true;
        
        // Get team stats
        const teams = await getTeamStats();
        
        // Get total votes
        const totalVotes = await getTotalVotes();
        
        // Get active codes
        const activeCodes = await getActiveCodesCount();
        
        // Update stats
        document.getElementById('totalVotes').textContent = totalVotes;
        document.getElementById('activeCodes').textContent = activeCodes;
        document.getElementById('totalTeams').textContent = teams.length;
        
        // Update top/bottom teams
        if (teams.length > 0) {
            const topTeam = teams[0];
            document.getElementById('topTeam').innerHTML = `
                <span class="team-name">${topTeam.teamName || topTeam.id}</span>
                <span class="vote-count">${topTeam.votes || 0}</span>
            `;
            
            const bottomTeam = teams[teams.length - 1];
            document.getElementById('bottomTeam').innerHTML = `
                <span class="team-name">${bottomTeam.teamName || bottomTeam.id}</span>
                <span class="vote-count">${bottomTeam.votes || 0}</span>
            `;
        }
        
        // Update rankings table
        const tbody = document.getElementById('rankingsBody');
        tbody.innerHTML = '';
        
        if (teams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No teams yet</td></tr>';
        } else {
            teams.forEach((team, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>#${index + 1}</strong></td>
                    <td>${sanitizeInput(team.teamName || 'Unknown')}</td>
                    <td><code>${sanitizeInput(team.teamId || team.id)}</code></td>
                    <td><strong>${team.votes || 0}</strong></td>
                    <td><span style="color: ${team.qrGeneratedBy === 'localhost' ? '#2196F3' : '#4CAF50'};">
                        ${team.qrGeneratedBy || 'N/A'}
                    </span></td>
                `;
                tbody.appendChild(row);
            });
        }
        
        showToast('Analytics updated', 'success');
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Failed to load analytics', 'error');
    } finally {
        refreshAnalyticsBtn.textContent = 'Refresh';
        refreshAnalyticsBtn.disabled = false;
    }
}

// Load All Generated Codes
async function loadAllCodes() {
    try {
        refreshCodesBtn.textContent = 'Loading...';
        refreshCodesBtn.disabled = true;
        
        // Get all voting codes ordered by creation time
        const snapshot = await db.collection('votingCodes')
            .orderBy('createdAt', 'desc')
            .get();
        
        const tbody = document.getElementById('codesTableBody');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No codes generated yet</td></tr>';
            document.getElementById('totalCodesCount').textContent = '0';
            return;
        }
        
        let totalCodes = 0;
        const now = new Date();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalCodes++;
            
            // Format timestamps
            const createdAt = data.createdAt ? formatTimestamp(data.createdAt) : 'Unknown';
            const expiresAt = data.expiresAt ? formatTimestamp(data.expiresAt) : 'Unknown';
            
            // Check if expired
            let expiryDate;
            if (data.expiresAt && data.expiresAt.toDate) {
                expiryDate = data.expiresAt.toDate();
            } else if (data.expiresAt instanceof Date) {
                expiryDate = data.expiresAt;
            }
            const isExpired = expiryDate ? now > expiryDate : false;
            const status = isExpired ? '❌ Expired' : '✅ Active';
            const statusColor = isExpired ? '#f44336' : '#4CAF50';
            
            // Generation method
            const generatedBy = data.generatedBy || 'unknown';
            const generatedVia = data.generatedVia || 'N/A';
            const methodDisplay = generatedVia === 'manual' ? 
                `${generatedBy} (manual)` : 
                generatedBy;
            
            // Votes used
            const usedTeams = data.usedTeams || [];
            const votesUsed = usedTeams.length;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${doc.id}</strong></td>
                <td>${createdAt}</td>
                <td>${expiresAt}</td>
                <td><span style="color: ${generatedBy === 'localhost' ? '#2196F3' : '#FF9800'};">
                    ${methodDisplay}
                </span></td>
                <td><span style="color: ${statusColor}; font-weight: 600;">${status}</span></td>
                <td>${votesUsed} vote${votesUsed !== 1 ? 's' : ''}</td>
            `;
            tbody.appendChild(row);
        });
        
        document.getElementById('totalCodesCount').textContent = totalCodes;
        showToast(`Loaded ${totalCodes} codes`, 'success');
        
    } catch (error) {
        console.error('Error loading codes:', error);
        showToast('Failed to load codes', 'error');
    } finally {
        refreshCodesBtn.textContent = 'Refresh Codes';
        refreshCodesBtn.disabled = false;
    }
}

async function handleExportResults() {
    try {
        exportResultsBtn.disabled = true;
        const teams = await getTeamStats();
        
        if (teams.length === 0) {
            showToast('No data to export', 'info');
            return;
        }
        
        exportToCSV(teams);
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export results', 'error');
    } finally {
        exportResultsBtn.disabled = false;
    }
}

// Delete All Data with Passkey
async function handleDeleteAll() {
    const passkey = prompt('⚠️ WARNING: This will delete ALL teams, codes, and votes!\n\nEnter passkey to continue:');
    
    if (passkey !== '0000') {
        if (passkey !== null) {
            showToast('Invalid passkey!', 'error');
        }
        return;
    }
    
    const confirm = window.confirm('Are you absolutely sure? This action CANNOT be undone!\n\n- All teams will be deleted\n- All voting codes will be deleted\n- All vote records will be deleted');
    
    if (!confirm) {
        return;
    }
    
    try {
        deleteAllBtn.disabled = true;
        deleteAllBtn.textContent = 'Deleting...';
        showLoading();
        
        let deletedCount = 0;
        
        // Delete all teams
        console.log('Deleting teams...');
        const teamsSnapshot = await db.collection('teams').get();
        const teamsBatch = db.batch();
        teamsSnapshot.forEach(doc => {
            teamsBatch.delete(doc.ref);
            deletedCount++;
        });
        await teamsBatch.commit();
        console.log(`Deleted ${teamsSnapshot.size} teams`);
        
        // Delete all voting codes
        console.log('Deleting voting codes...');
        const codesSnapshot = await db.collection('votingCodes').get();
        const codesBatch = db.batch();
        codesSnapshot.forEach(doc => {
            codesBatch.delete(doc.ref);
            deletedCount++;
        });
        await codesBatch.commit();
        console.log(`Deleted ${codesSnapshot.size} codes`);
        
        // Delete all votes
        console.log('Deleting votes...');
        const votesSnapshot = await db.collection('votes').get();
        const votesBatch = db.batch();
        votesSnapshot.forEach(doc => {
            votesBatch.delete(doc.ref);
            deletedCount++;
        });
        await votesBatch.commit();
        console.log(`Deleted ${votesSnapshot.size} votes`);
        
        hideLoading();
        showToast(`✅ Successfully deleted ${deletedCount} records!`, 'success');
        
        // Refresh all data displays
        loadAnalytics();
        loadAllCodes();
        
        // Reset code display
        currentCode.textContent = '---';
        codeTimestamp.textContent = 'All data deleted. Generate new code to start.';
        
    } catch (error) {
        console.error('Error deleting data:', error);
        hideLoading();
        showToast('Failed to delete data: ' + error.message, 'error');
    } finally {
        deleteAllBtn.disabled = false;
        deleteAllBtn.textContent = '🗑️ Delete All Data';
    }
}
