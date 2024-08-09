const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();

// Configuration for file storage
const UPLOAD_FOLDER = 'uploads/';
const COMPRESSED_FOLDER = 'compressed/';

// Ensure the upload and compressed directories exist
if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER);
}
if (!fs.existsSync(COMPRESSED_FOLDER)) {
    fs.mkdirSync(COMPRESSED_FOLDER);
}

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_FOLDER);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = `${uuidv4()}_${file.originalname}`;
        cb(null, uniqueFilename);
    }
});
const upload = multer({ storage });

function compressPdf(inputFilePath, outputFilePath, compressionLevel) {
    const quality = {
        "high": "/screen",    // high compression, lower quality
        "medium": "/ebook",   // medium compression, good quality
        "low": "/prepress"    // low compression, best quality
    }[compressionLevel];

    const args = [
        "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${quality}`,
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        `-sOutputFile=${outputFilePath}`, inputFilePath
    ];

    return new Promise((resolve, reject) => {
        const gs = spawn('gs', args);

        gs.on('error', reject);

        gs.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Ghostscript process exited with code ${code}`));
            } else {
                resolve(outputFilePath);
            }
        });
    });
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/', upload.single('file'), async (req, res) => {
    if (req.file && req.file.mimetype === 'application/pdf') {
        const compression = req.body.compression;
        const inputFilePath = req.file.path;
        const outputFilePath = path.join(COMPRESSED_FOLDER, req.file.filename);

        try {
            await compressPdf(inputFilePath, outputFilePath, compression);
            res.download(outputFilePath, `compressed_${req.file.originalname}`);
        } catch (error) {
            res.status(500).send('Compression failed: ' + error.message);
        }
    } else {
        res.status(400).send('Please upload a valid PDF file.');
    }
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
