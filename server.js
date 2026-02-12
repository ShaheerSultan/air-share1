const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// FIXED: Static files serving from root
app.use(express.static(__dirname)); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// FIXED: Defining upload directory properly
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  
  // Formatting size to KB for frontend
  const fileSize = (req.file.size / 1024).toFixed(2) + ' KB';
  
  const fileData = {
    name: req.file.filename,
    originalName: req.file.originalname,
    size: fileSize,
    date: Date.now()
  };
  io.emit('newFile', fileData);
  res.json({ success: true, file: fileData });
});

app.get('/files', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.json([]);
    const fileData = files.map(f => {
      try {
        const stats = fs.statSync(path.join(uploadDir, f));
        return { 
          name: f, 
          size: (stats.size / 1024).toFixed(2) + ' KB', 
          date: stats.mtime, 
          path: `/uploads/${f}` 
        };
      } catch (e) { return null; }
    }).filter(f => f !== null);
    res.json(fileData);
  });
});

app.delete('/file/:filename', (req, res) => {
  const filepath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    fs.unlink(filepath, (err) => {
      if (err) return res.status(500).json({ error: 'Delete failed' });
      io.emit('fileDeleted', req.params.filename);
      res.json({ success: true });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

const PORT = process.env.PORT || 8000; // Koyeb default port 8000 use karta hai
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

});
