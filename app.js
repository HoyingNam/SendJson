const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');
const request = require('request');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser 설정
app.use(bodyParser.json());

// 파일이 저장될 경로 설정
const uploadDirectory = './uploads';

// multer 미들웨어 설정
const upload = multer({ dest: uploadDirectory });

// 정적 파일 제공 설정
app.use(express.static('public'));

// '/upload.html' 경로로 요청이 들어오면 public 폴더에서 upload.html 파일을 제공합니다.
// 브라우저에서 '/upload.html'로 접속하면 upload.html 파일이 로드됩니다.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// 외부 서버의 URL
const externalServerUrl = 'https://app.godamda.kr:43000/externalFiles';

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload JSON files to external server
 *     description: Upload multiple JSON files to an external server via API
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: files
 *         type: file
 *         required: true
 *         description: The JSON files to upload
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       500:
 *         description: Internal server error
 */

app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;

    // 파일을 외부 서버로 직접 전송
    for (const file of files) {
      const filePath = path.join(__dirname, 'uploads', file.originalname);
      await fs.move(file.path, filePath);
      const fileContent = await fs.readFile(filePath);
      const formData = {
        files: [
          {
            value: fileContent,
            options: {
              filename: file.originalname,
              contentType: 'application/json'
            }
          }
        ]
      };
      console.log('formData:', formData); // formData 확인 로그

      // request 모듈을 사용하여 파일을 전송합니다.
      request.post({ url: externalServerUrl, formData: formData }, async (error, response, body) => {
        try {
          if (error) {
            console.error('Error sending data to external server:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          } else {
            console.log('Data sent to external server successfully');
            res.status(200).json({ message: 'Files uploaded successfully' });
          }
        } finally {
          // 전송 후에 임시 파일 삭제
          await fs.unlink(filePath);
        }
      });
    }
  } catch (error) {
    console.error('Error uploading files:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
