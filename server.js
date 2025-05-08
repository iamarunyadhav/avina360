// const express = require('express');
// const multer = require('multer');
// const fs = require('fs-extra');
// const axios = require('axios');
// const FormData = require('form-data');
// const path = require('path');
// const puppeteer = require('puppeteer');
// const { exec } = require('child_process');

// const app = express();
// const PORT = 3000;
// const REMOVE_BG_API_KEY = 'fkExbxbQWtRByG9Trco7n5x4';

// app.use(express.static('public'));
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// const storage = multer.diskStorage({
//   destination: 'uploads/',
//   filename: (_, file, cb) => {
//     const safeName = file.originalname.replace(/\s+/g, '-').replace(/[()]/g, '');
//     cb(null, `${Date.now()}-${safeName}`);
//   },
// });
// const upload = multer({ storage });

// // 🔁 Main Upload Route
// app.post('/upload', upload.single('image'), async (req, res) => {
//   const inputPath = req.file.path;
//   const outputFileName = `transparent-${req.file.filename}.png`;
//   const outputPath = `public/transparent/${outputFileName}`;

//   const axis = req.body.axis || 'x';
//   const bg = req.body.bg || 'black'; // default to black background

//   fs.ensureDirSync('public/transparent');

//   // 🧠 Remove.bg API
//   const formData = new FormData();
//   formData.append('image_file', fs.createReadStream(inputPath));
//   formData.append('size', 'auto');

//   try {
//     const bgRes = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
//       headers: {
//         ...formData.getHeaders(),
//         'X-Api-Key': REMOVE_BG_API_KEY,
//       },
//       responseType: 'arraybuffer',
//     });

//     fs.writeFileSync(outputPath, bgRes.data);

//     // 🧠 Serve via HTTP
//     const imageUrl = `http://localhost:${PORT}/transparent/${outputFileName}`;
//     await captureRotation(imageUrl, axis, bg);

//     res.download('output/final.mp4');
//   } catch (err) {
//     console.error('❌ Error:', err.message);
//     res.status(500).send('Something went wrong');
//   }
// });

// // 🎥 Generate frames → Render → MP4
// async function captureRotation(imageUrl, axis, bg) {
//   await fs.emptyDir('frames');

//   const browser = await puppeteer.launch({
//     headless: 'new',
//     defaultViewport: { width: 800, height: 800 },
//   });

//   const page = await browser.newPage();
//   page.on('console', msg => console.log('🖥 Puppeteer Log:', msg.text()));

//   // 👇 Pass axis and bg to frontend
//   const rotateUrl = `http://localhost:${PORT}/rotate.html?img=${encodeURIComponent(imageUrl)}&axis=${axis}&bg=${bg}`;
//   await page.goto(rotateUrl);
//   await page.waitForSelector('#renderReady');

//   for (let i = 0; i < 90; i++) {
//     await page.evaluate(`window.rotateFrame(${i})`);
//     await new Promise(resolve => setTimeout(resolve, 50));
//     await page.screenshot({ path: `frames/frame_${String(i).padStart(3, '0')}.png` });
//   }

//   await browser.close();

//   return new Promise((resolve, reject) => {
//     const cmd = `ffmpeg -framerate 30 -i frames/frame_%03d.png -c:v libx264 -pix_fmt yuv420p -y output/final.mp4`;
//     exec(cmd, (err) => (err ? reject(err) : resolve()));
//   });
// }

// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });


const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;
const REMOVE_BG_API_KEY = 'fkExbxbQWtRByG9Trco7n5x4'; // 👈 replace this!

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[()]/g, '');
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

// ✅ Upload and handle background removal + 3D render
app.post('/upload', upload.single('image'), async (req, res) => {
  const file = req.file;
  const axis = req.body.axis || 'x';
  const bg = req.body.bg || 'black';
  const duration = parseInt(req.body.duration) || 5;
  const watermark = req.body.watermark || 'MyBrand';
  const gifExport = req.body.gif === 'true';

  const inputPath = file.path;
  const outputName = `transparent-${file.filename}.png`;
  const outputPath = `public/transparent/${outputName}`;
  fs.ensureDirSync('public/transparent');

  // ✅ Call remove.bg API
  const formData = new FormData();
  formData.append('image_file', fs.createReadStream(inputPath));
  formData.append('size', 'auto');

  try {
    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      responseType: 'arraybuffer',
    });

    fs.writeFileSync(outputPath, response.data);

    const imageUrl = `http://localhost:${PORT}/transparent/${outputName}`;
    const baseName = file.filename.replace(/\..+$/, '');
    const outputVideo = `output/${baseName}.mp4`;
    const outputGif = `output/${baseName}.gif`;

    await captureRotation(imageUrl, axis, bg, duration, watermark, outputVideo);

    if (gifExport) {
      await convertToGif(outputVideo, outputGif);
      res.download(outputGif);
    } else {
      res.download(outputVideo);
    }

  } catch (err) {
    console.error('❌ Remove.bg or render error:', err.message);
    res.status(500).send('Error: Remove.bg or rendering failed.');
  }
});

// ✅ Headless browser rendering with Puppeteer
async function captureRotation(imageUrl, axis, bg, duration, watermark, outputPath) {
  await fs.emptyDir('frames');

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 800, height: 800 },
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('🖥 Puppeteer Log:', msg.text()));

  const rotateUrl = `http://localhost:${PORT}/rotate.html?img=${encodeURIComponent(imageUrl)}&axis=${axis}&bg=${bg}&duration=${duration}`;
  await page.goto(rotateUrl);
  await page.waitForSelector('#renderReady');

  const totalFrames = duration * 30;

  for (let i = 0; i < totalFrames; i++) {
    await page.evaluate(`window.rotateFrame(${i})`);
    await new Promise(resolve => setTimeout(resolve, 5));
    await page.screenshot({ path: `frames/frame_${String(i).padStart(3, '0')}.png` });
  }

  await browser.close();

  // ✅ Add watermark and render to video
  return new Promise((resolve, reject) => {
    const ffmpegCmd = `ffmpeg -y -framerate 30 -i frames/frame_%03d.png -vf "drawtext=text='${watermark}':fontcolor=white:fontsize=24:x=w-tw-20:y=h-th-20" -pix_fmt yuv420p "${outputPath}"`;
    exec(ffmpegCmd, (err) => (err ? reject(err) : resolve()));
  });
}

// ✅ Convert to GIF using ffmpeg
function convertToGif(inputVideo, outputGif) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputVideo}" -vf "fps=15,scale=480:-1:flags=lanczos" "${outputGif}"`;
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
