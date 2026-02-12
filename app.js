class AirShareApp {
    constructor() {
        this.socket = null;
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    async init() {
        this.setupTheme();
        this.setupEventListeners();
        await this.connectSocket();
        this.loadFiles();
        this.setupAutoRefresh();
    }

    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.getElementById('themeToggle').querySelector('i');
        themeIcon.className = this.currentTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', this.currentTheme);
            localStorage.setItem('theme', this.currentTheme);
            
            const themeIcon = document.getElementById('themeToggle').querySelector('i');
            themeIcon.className = this.currentTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        });

        // QR Code button
        document.getElementById('qrBtn').addEventListener('click', () => {
            this.showQRCode();
        });

        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
            e.target.value = '';
        });

        // Drag and drop
        const dropArea = document.getElementById('dropArea');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.preventDefaults);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('drag-over');
            });
        });

        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileUpload(files);
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('newFile', (file) => {
            this.addFileCard(file);
            this.showNotification('New file uploaded!');
        });
        
        this.socket.on('fileDeleted', (filename) => {
            this.removeFileCard(filename);
            this.showNotification('File deleted');
        });
    }

    updateConnectionStatus(connected) {
        const icon = document.getElementById('statusIcon');
        const text = document.getElementById('statusText');
        
        if (connected) {
            icon.className = 'fas fa-circle connected';
            text.textContent = 'Connected';
        } else {
            icon.className = 'fas fa-circle disconnected';
            text.textContent = 'Disconnected';
        }
    }

    async loadFiles() {
        try {
            const response = await fetch('/files');
            const files = await response.json();
            
            const filesGrid = document.getElementById('filesGrid');
            filesGrid.innerHTML = '';
            
            if (files.length === 0) {
                filesGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No files shared yet</p>
                        <small>Upload a file to get started</small>
                    </div>
                `;
            } else {
                files.forEach(file => this.addFileCard(file));
            }
            
            this.updateFileCount(files.length);
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        for (let file of files) {
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressBar.style.width = `${percentComplete}%`;
                        progressText.textContent = `${Math.round(percentComplete)}%`;
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        progressBar.style.width = '100%';
                        progressText.textContent = '100%';
                        
                        setTimeout(() => {
                            progressContainer.style.display = 'none';
                        }, 1000);
                    }
                });
                
                xhr.open('POST', '/upload');
                xhr.send(formData);
                
            } catch (error) {
                console.error('Upload error:', error);
                this.showNotification('Upload failed!', 'error');
            }
        }
    }

    addFileCard(file) {
        const filesGrid = document.getElementById('filesGrid');
        
        // Remove empty state if present
        const emptyState = filesGrid.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.dataset.filename = file.name;
        
        const fileIcon = this.getFileIcon(file.name);
        const displayName = file.originalName || file.name.substring(file.name.indexOf('-') + 1);
        
        fileCard.innerHTML = `
            <div class="file-icon">
                <i class="${fileIcon}"></i>
            </div>
            <div class="file-name" title="${displayName}">${displayName}</div>
            <div class="file-meta">
                <span class="file-size">${file.size}</span>
                <span class="file-date">${new Date(file.date).toLocaleTimeString()}</span>
            </div>
            <div class="file-actions">
                <button class="action-btn download-btn" onclick="app.downloadFile('${file.name}', '${displayName}')">
                    <i class="fas fa-download"></i> Download
                </button>
                <button class="action-btn delete-btn" onclick="app.deleteFile('${file.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        filesGrid.insertBefore(fileCard, filesGrid.firstChild);
        this.updateFileCount(document.querySelectorAll('.file-card').length);
    }

    removeFileCard(filename) {
        const fileCard = document.querySelector(`.file-card[data-filename="${filename}"]`);
        if (fileCard) {
            fileCard.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                fileCard.remove();
                this.updateFileCount(document.querySelectorAll('.file-card').length);
                
                const filesGrid = document.getElementById('filesGrid');
                if (filesGrid.children.length === 0) {
                    filesGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>No files shared yet</p>
                            <small>Upload a file to get started</small>
                        </div>
                    `;
                }
            }, 300);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        const icons = {
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            docx: 'fas fa-file-word',
            txt: 'fas fa-file-alt',
            jpg: 'fas fa-file-image',
            jpeg: 'fas fa-file-image',
            png: 'fas fa-file-image',
            gif: 'fas fa-file-image',
            mp4: 'fas fa-file-video',
            mp3: 'fas fa-file-audio',
            zip: 'fas fa-file-archive',
            rar: 'fas fa-file-archive'
        };
        
        return icons[ext] || 'fas fa-file';
    }

    updateFileCount(count) {
        document.getElementById('fileCount').textContent = count;
    }

    async downloadFile(filename, originalName) {
        try {
            const response = await fetch(`/uploads/${filename}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = originalName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(url);
            this.showNotification('Download started!');
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed!', 'error');
        }
    }

    async deleteFile(filename) {
        if (!confirm('Are you sure you want to delete this file?')) return;
        
        try {
            const response = await fetch(`/file/${filename}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('File deleted');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showNotification('Delete failed!', 'error');
        }
    }

    showQRCode() {
        const currentURL = window.location.href;
        const modal = document.getElementById('qrModal');
        const qrCanvas = document.getElementById('qrCanvas');
        const qrUrl = document.getElementById('qrUrl');
        
        qrUrl.textContent = currentURL;
        
        // Generate QR Code
        new QRious({
            element: qrCanvas,
            value: currentURL,
            size: 200,
            background: '#ffffff',
            foreground: '#000000'
        });
        
        modal.classList.add('active');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    setupAutoRefresh() {
        // Refresh file list every 30 seconds as backup
        setInterval(() => {
            this.loadFiles();
        }, 30000);
    }
}

// Global functions for HTML onclick handlers
function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');
}

function copyQRURL() {
    const url = document.getElementById('qrUrl').textContent;
    navigator.clipboard.writeText(url)
        .then(() => {
            const app = window.app;
            app.showNotification('URL copied to clipboard!');
        })
        .catch(err => {
            console.error('Copy failed:', err);
        });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AirShareApp();
});

// Add notification styles dynamically
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--surface-color);
        border-left: 4px solid var(--success-color);
        padding: 15px 20px;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow);
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 1001;
        max-width: 300px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.error {
        border-left-color: var(--danger-color);
    }
    
    .notification i {
        font-size: 1.2rem;
    }
    
    .notification.success i {
        color: var(--success-color);
    }
    
    .notification.error i {
        color: var(--danger-color);
    }
`;
document.head.appendChild(notificationStyles);