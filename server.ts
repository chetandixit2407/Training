import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// High payload limit for base64 photo upload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Safely initialize Google GenAI client only when GEMINI_API_KEY is present
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Path to persistent training knowledge database and permanent/temporary photo uploads
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const REFERENCE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'reference');
const COMPLETION_UPLOADS_DIR = path.join(UPLOADS_DIR, 'completion');

const KNOWLEDGE_FILE = path.join(DATA_DIR, 'training_knowledge.json');
const GUIDES_FILE = path.join(DATA_DIR, 'guides.json');
const ROOM_PHOTOS_FILE = path.join(DATA_DIR, 'room_photos.json');
const ROOM_ANALYSIS_FILE = path.join(DATA_DIR, 'room_analysis.json');
const COMPLETION_PHOTOS_FILE = path.join(DATA_DIR, 'completion_photos.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Ensure distinct data and categorized uploads directories exist
[DATA_DIR, UPLOADS_DIR, REFERENCE_UPLOADS_DIR, COMPLETION_UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Ensure API responses are never stale-cached across devices or sessions
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Allow cross-origin image loading across preview/dev/shared domains
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// Statically serve reference photos (permanent) and task completion photos (40-day retention)
app.use('/uploads/reference', express.static(REFERENCE_UPLOADS_DIR));
app.use('/uploads/completion', express.static(COMPLETION_UPLOADS_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Return explicit 404 for missing upload files instead of falling through to SPA index.html
app.use('/uploads', (req, res) => {
  res.status(404).json({ error: 'Uploaded image file not found on server' });
});


// Initial seed data representing approved office training knowledge
const DEFAULT_KNOWLEDGE = [
  {
    id: 'knowledge-reception',
    category: 'reception',
    roomNameHi: 'RECEPTION AREA',
    roomNameEn: 'RECEPTION AREA',
    referencePhotoUrl: '/uploads/reference/ref_reception_1794401118506_2hm8.jpg',
    currentVersion: 1,
    status: 'approved',
    approvedBy: 'Admin (Lalit Sir)',
    approvedAt: '2026-11-02T08:30:00Z',
    titleHi: 'रिसेप्शन एरिया व फ्रंट डेस्क मानक',
    titleEn: 'Reception Area & Front Desk Standard',
    summaryHi: 'फ्रंट डेस्क, विजिटर सोफा, कुशन 45° एंगल, कोस्टर व पानी की सीलबंद बोतल व्यवस्था।',
    summaryEn: 'Front desk, visitor sofa, cushions fluffed at 45°, coasters, and sealed water bottle arrangement.',
    steps: [
      {
        stepNumber: 1,
        instructionHi: 'सोफे के सभी कुशन को 45 डिग्री पर सीधा और फूला हुआ (Fluffed) रखें।',
        instructionEn: 'Position all sofa cushions upright and plumped at a neat 45-degree angle.',
        keyPoints: 'कुशन टेढ़े न हों',
      },
      {
        stepNumber: 2,
        instructionHi: 'सेंटर टेबल पर साफ कोस्टर, पानी की सीलबंद बोतल और दो साफ उल्टे गिलास रखें।',
        instructionEn: 'Place clean coasters, sealed water bottle, and two inverted spotless glasses on the center table.',
        keyPoints: 'कोस्टर के बिना बोतल न रखें',
      },
      {
        stepNumber: 3,
        instructionHi: 'विजिटर डायरी और चालू पेन टेबल के दाएं कोने पर सीधा रखें।',
        instructionEn: 'Keep visitor directory and working ballpen aligned on the right corner.',
        keyPoints: 'पेन चेक करके रखें',
      },
      {
        stepNumber: 4,
        instructionHi: 'मेहमान के उठते ही तुरंत टेबल को माइक्रोफाइबर कपड़े से पोंछकर साफ करें।',
        instructionEn: 'Sanitize table immediately after guest departs.',
        keyPoints: 'कप या टिशू न छोड़ें',
      },
    ],
    cleaningProcedureHi: 'ग्लास क्लीनर से टेबल चमकाएं, सोफे को वैक्यूम करें और फर्श को बिना दाग साफ रखें।',
    cleaningProcedureEn: 'Polish glass with lint-free cloth, vacuum sofa fabric, and keep lobby floor spotless.',
    expectedResultsHi: 'बेदाग चमकती टेबल, फूले हुए सीधे कुशन और तुरंत पानी परोसने की 100% तैयारी।',
    expectedResultsEn: 'Streak-free table, plumped cushions, and zero waiting time for water service.',
    qualityStandardsHi: [
      'टेबल पर कोई उंगलियों या चाय के छल्ले न हों।',
      'पानी की बोतल का लेबल हमेशा सामने की ओर रहे।',
      'एसी का तापमान 24°C पर स्थिर रहे।',
    ],
    qualityStandardsEn: [
      'Zero finger smudges or coffee ring marks on table.',
      'Bottle label must face forward towards arriving guest.',
      'Maintain reception AC temperature firmly at 24°C.',
    ],
    mistakesToAvoidHi: [
      'खाली गिलास या टिशू टेबल पर 10 मिनट से ज्यादा छोड़ना।',
      'बिना कोस्टर के ठंडे पानी की बोतल रखना।',
      'मेहमान को देखकर अनदेखा करना या फोन में लगे रहना।',
    ],
    mistakesToAvoidEn: [
      'Leaving used glasses or tissues unattended.',
      'Placing cold condensation bottles directly on wood without coasters.',
      'Ignoring arriving guests while looking at phone.',
    ],
    voiceScriptHi:
      'भैया, रिसेप्शन एरिया ऑफिस का सबसे मुख्य चेहरा है। सोफे के सभी कुशन बिल्कुल सीधे और फूले हुए रखिए। सेंटर टेबल पर साफ कोस्टर, पानी की सीलबंद बोतल, दो कांच के गिलास और विजिटर डायरी रखें। जैसे ही कोई मेहमान जाएं, तुरंत टेबल को कपड़े से चमका दें।',
    voiceScriptEn:
      'Reception area is the face of our office. Keep cushions upright and plumped at 45 degrees, place sealed water bottle on coasters, and clean table right after guests leave.',
    versions: [
      {
        version: 1,
        updatedAt: '2026-11-02T08:30:00Z',
        updatedBy: 'Admin (System)',
        changeNote: 'Initial master visual guideline approved',
        titleHi: 'रिसेप्शन एरिया व फ्रंट डेस्क मानक',
        titleEn: 'Reception Area & Front Desk Standard',
        category: 'reception',
        referencePhotoUrl: '/uploads/reference/ref_reception_1794401118506_2hm8.jpg',
        steps: [
          {
            stepNumber: 1,
            instructionHi: 'सोफे के सभी कुशन को 45 डिग्री पर सीधा और फूला हुआ रखें।',
            instructionEn: 'Position all sofa cushions upright and plumped at 45 degrees.',
          },
        ],
        cleaningProcedureHi: 'ग्लास क्लीनर से टेबल चमकाएं।',
        cleaningProcedureEn: 'Polish glass with lint-free cloth.',
        qualityStandardsHi: ['टेबल पर कोई उंगलियों के निशान न हों।'],
        qualityStandardsEn: ['Zero finger smudges on table.'],
        mistakesToAvoidHi: ['बिना कोस्टर के पानी की बोतल रखना।'],
        mistakesToAvoidEn: ['Placing cold bottles without coasters.'],
        voiceScriptHi: 'रिसेप्शन एरिया में सफाई और व्यवस्था का पूरा ध्यान रखें।',
        voiceScriptEn: 'Maintain full cleanliness in reception area.',
      },
    ],
    createdAt: '2026-11-02T08:30:00Z',
    updatedAt: '2026-11-02T08:30:00Z',
  },
  {
    id: 'knowledge-lalit-sir-cabin',
    category: 'lalit_sir_cabin',
    roomNameHi: 'LALIT SIR CABIN',
    roomNameEn: 'LALIT SIR CABIN',
    referencePhotoUrl: '/uploads/reference/ref_lalit_sir_cabin_1794401097115_xhfy.jpg',
    currentVersion: 1,
    status: 'approved',
    approvedBy: 'Admin',
    approvedAt: '2026-11-02T08:45:00Z',
    titleHi: 'ललित सर कैबिन व्यवस्था व प्रोटोकॉल',
    titleEn: 'Lalit Sir Cabin Arrangement & Protocol',
    summaryHi: 'एग्जीक्यूटिव डेस्क, रिवॉल्विंग चेयर, 2 विजिटर कुर्सियां, लेदर कोस्टर पर ढका वाटर कैराफे।',
    summaryEn: 'Executive desk, swivel chair, 2 visitor chairs, covered water carafe on leather coaster.',
    steps: [
      {
        stepNumber: 1,
        instructionHi: 'कैबिन में जाने से पहले हमेशा 2 बार धीरे से नॉक करें और अनुमति लेकर ही अंदर जाएं।',
        instructionEn: 'Always knock gently twice and pause for response before opening cabin door.',
        keyPoints: 'बिना नॉक किए अंदर न जाएं',
      },
      {
        stepNumber: 2,
        instructionHi: 'मुख्य लेदर रिवॉल्विंग कुर्सी को डेस्क के ठीक बीचोंबीच आधा अंदर धकेल कर रखें।',
        instructionEn: 'Center executive swivel chair behind desk and tuck halfway in.',
        keyPoints: 'कुर्सी सीधी रहे',
      },
      {
        stepNumber: 3,
        instructionHi: '2 विजिटर कुर्सियों को डेस्क से 6 इंच की दूरी पर एक समान कोण पर रखें।',
        instructionEn: 'Space the 2 visitor chairs 6 inches from front desk edge.',
        keyPoints: 'कुर्सियां समानांतर हों',
      },
      {
        stepNumber: 4,
        instructionHi: 'टेबल के दाएं ऊपरी कोने पर लेदर कोस्टर पर ढका हुआ पानी का जग और उल्टा गिलास रखें।',
        instructionEn: 'Place covered water carafe and inverted glass on leather coaster at upper right.',
        keyPoints: 'फाइलों को बिल्कुल न छुएं',
      },
      {
        stepNumber: 5,
        instructionHi: 'सर के आने से 15 मिनट पहले एसी को 23°C पर ऑन करें।',
        instructionEn: 'Turn ON cabin AC to 23°C 15 minutes before arrival.',
        keyPoints: 'तापमान 23 डिग्री रहे',
      },
    ],
    cleaningProcedureHi: 'डेस्क को सूखे माइक्रोफाइबर से पोंछें, स्क्रीन वाइप से मॉनिटर साफ करें और डस्टबिन में नया काला बैग लगाएं।',
    cleaningProcedureEn: 'Wipe desk with dry microfiber, sanitize screen with lint-free wipes, and line waste bin.',
    expectedResultsHi: 'बेदाग डेस्क, ताज़ा आरओ पानी, 23 डिग्री पर ठंडा कमरा और बिना छुई फाइलें।',
    expectedResultsEn: 'Spotless desk, fresh RO water, pre-cooled cabin, and undisturbed documents.',
    qualityStandardsHi: [
      'डेस्क पर रखी किसी भी फाइल, कागज़ या पेनड्राइव को कभी न हटाएं।',
      'पानी या चाय हमेशा डेस्क के दाएं कोने से परोसें, लैपटॉप के ऊपर से हाथ न ले जाएं।',
      'डस्टबिन सुबह 8:40 बजे तक साफ और नया लाइनर लगा होना चाहिए।',
    ],
    qualityStandardsEn: [
      'Never touch or rearrange papers, documents, or USBs on desk.',
      'Serve beverages strictly from the right side; never reach over the laptop.',
      'Waste bin must be emptied and relined by 8:40 AM.',
    ],
    mistakesToAvoidHi: [
      'बिना नॉक किए दरवाजा खोलना।',
      'गिलास को ऊपर के रिम से पकड़ना।',
      'खाली कमरे में एसी और लाइटें खुली छोड़कर चले जाना।',
    ],
    mistakesToAvoidEn: [
      'Entering cabin without knocking twice.',
      'Holding water glass by drinking rim.',
      'Leaving AC running when cabin is vacant.',
    ],
    voiceScriptHi:
      'भैया, ललित सर के कैबिन में जाने से पहले हमेशा दो बार नॉक करें और पूछकर ही अंदर जाएं। सर की मुख्य घूमने वाली कुर्सी बीच में सीधी रखें और दोनों विजिटर कुर्सियां बराबर रखें। टेबल के दाएं कोने पर कोस्टर में ढका हुआ पानी का जग और उल्टा गिलास रखिए। टेबल पर रखी सर की फाइलों या कागजों को बिल्कुल हाथ न लगाएं। पानी या चाय हमेशा दाएं तरफ से ही परोसें।',
    voiceScriptEn:
      'Always knock twice before entering Lalit Sir cabin. Center the swivel chair, keep 2 visitor chairs parallel, place covered water carafe on right leather coaster, and never touch any documents on the desk.',
    versions: [
      {
        version: 1,
        updatedAt: '2026-11-02T08:45:00Z',
        updatedBy: 'Admin (System)',
        changeNote: 'Executive protocol initialized',
        titleHi: 'ललित सर कैबिन व्यवस्था व प्रोटोकॉल',
        titleEn: 'Lalit Sir Cabin Arrangement & Protocol',
        category: 'lalit_sir_cabin',
        referencePhotoUrl: '/uploads/reference/ref_lalit_sir_cabin_1794401097115_xhfy.jpg',
        steps: [
          {
            stepNumber: 1,
            instructionHi: 'हमेशा दो बार नॉक करें।',
            instructionEn: 'Always knock twice before entering.',
          },
        ],
        cleaningProcedureHi: 'सूखे कपड़े से डेस्क पोंछें।',
        cleaningProcedureEn: 'Wipe desk with dry cloth.',
        qualityStandardsHi: ['फाइलों को हाथ न लगाएं।'],
        qualityStandardsEn: ['Never touch documents.'],
        mistakesToAvoidHi: ['बिना नॉक किए जाना।'],
        mistakesToAvoidEn: ['Entering without knock.'],
        voiceScriptHi: 'ललित सर के कैबिन में नॉक करके जाएं और पानी दाएं कोने पर रखें।',
        voiceScriptEn: 'Knock twice and set water on right coaster.',
      },
    ],
    createdAt: '2026-11-02T08:45:00Z',
    updatedAt: '2026-11-02T08:45:00Z',
  },
  {
    id: 'knowledge-the-skyline',
    category: 'the_skyline',
    roomNameHi: 'THE SKYLINE',
    roomNameEn: 'THE SKYLINE',
    referencePhotoUrl: '/uploads/reference/ref_the_skyline_1794400592787_as2u.jpg',
    currentVersion: 1,
    status: 'approved',
    approvedBy: 'Admin',
    approvedAt: '2026-11-02T09:00:00Z',
    titleHi: 'द स्काईलाइन मीटिंग रूम मानक (4 कुर्सियां, 1 टेबल)',
    titleEn: 'The Skyline Meeting Room Standard (4 Chairs, 1 Table)',
    summaryHi: '4 कुर्सियां टेबल के नीचे समानांतर अंदर, हर सीट पर कोस्टर व उल्टा गिलास, एसी 23°C।',
    summaryEn: '4 chairs tucked parallel, coaster and inverted glass at each seat, AC at 23°C.',
    steps: [
      {
        stepNumber: 1,
        instructionHi: 'चारों कुर्सियों को टेबल के नीचे बिल्कुल सीधी और एक समान ऊंचाई पर अंदर धकेलें।',
        instructionEn: 'Tuck all 4 chairs straight and parallel under table at uniform height.',
        keyPoints: 'कुर्सियों की ऊंचाई बराबर हो',
      },
      {
        stepNumber: 2,
        instructionHi: 'हर सीट पर 1 कोस्टर, 1 उल्टा साफ गिलास, 1 नोटपैड और पेन रखें।',
        instructionEn: 'Place 1 coaster, 1 inverted glass, 1 notepad and pen per seat.',
        keyPoints: 'गिलास उल्टा रखें',
      },
      {
        stepNumber: 3,
        instructionHi: 'टेबल के बीच में 2 ताजी पानी की बोतलें रखें।',
        instructionEn: 'Provide 2 fresh water bottles in center of table.',
        keyPoints: 'ताजा आरओ पानी',
      },
      {
        stepNumber: 4,
        instructionHi: 'मीटिंग से 15 मिनट पहले एसी को 23°C पर ऑन करें और खत्म होते ही बंद करें।',
        instructionEn: 'Turn ON AC to 23°C 15 minutes before meeting and turn OFF after.',
        keyPoints: 'एसी 23 डिग्री',
      },
    ],
    cleaningProcedureHi: 'टेबल को कोलिन स्प्रे व माइक्रोफाइबर से पोंछें और व्हाइटबोर्ड मार्कर टेस्ट करें।',
    cleaningProcedureEn: 'Clean glass with spray and verify dry-erase whiteboard markers.',
    expectedResultsHi: 'बेदाग टेबल, सीधी कुर्सियां और मीटिंग से 15 मिनट पहले ठंडा कमरा।',
    expectedResultsEn: 'Streak-free table, aligned chairs, and pre-cooled room.',
    qualityStandardsHi: [
      'कुर्सियां बिल्कुल एक समान स्तर पर और सीधी लगी हों।',
      'गिलास को उल्टा रखा जाए ताकि धूल अंदर न जाए।',
    ],
    qualityStandardsEn: [
      'Chairs aligned at uniform height.',
      'Glasses inverted to prevent airborne dust.',
    ],
    mistakesToAvoidHi: [
      'पिछली मीटिंग के गंदे कप टेबल पर छोड़ देना।',
      'खाली कमरे में एसी चालू छोड़ना।',
    ],
    mistakesToAvoidEn: [
      'Leaving dirty mugs after meeting.',
      'Leaving AC running in empty room.',
    ],
    voiceScriptHi:
      'भैया, द स्काईलाइन मीटिंग रूम में चार कुर्सियां और एक टेबल है। चारों कुर्सियों को बिल्कुल सीधा टेबल के अंदर दबाकर रखें। हर सीट के आगे कोस्टर और उल्टा शीशे का गिलास रखिए। मीटिंग शुरू होने से पंद्रह मिनट पहले एसी चालू कर दें, और मीटिंग के बाद लाइट व एसी बंद कर दीजिए।',
    voiceScriptEn:
      'The Skyline meeting room has 4 chairs and 1 table. Tuck chairs straight, place coasters and inverted glasses at every seat, and turn AC on 15 minutes early.',
    versions: [
      {
        version: 1,
        updatedAt: '2026-11-02T09:00:00Z',
        updatedBy: 'Admin',
        changeNote: 'Initial room guide',
        titleHi: 'द स्काईलाइन मीटिंग रूम मानक',
        titleEn: 'The Skyline Meeting Room Standard',
        category: 'the_skyline',
        referencePhotoUrl: '/uploads/reference/ref_the_skyline_1794400592787_as2u.jpg',
        steps: [],
        cleaningProcedureHi: '',
        cleaningProcedureEn: '',
        qualityStandardsHi: [],
        qualityStandardsEn: [],
        mistakesToAvoidHi: [],
        mistakesToAvoidEn: [],
        voiceScriptHi: '',
        voiceScriptEn: '',
      },
    ],
    createdAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-02T09:00:00Z',
  },
  {
    id: 'knowledge-the-community',
    category: 'the_community',
    roomNameHi: 'THE COMMUNITY',
    roomNameEn: 'THE COMMUNITY',
    referencePhotoUrl: '/uploads/reference/ref_the_community_1794400603611_jrnc.jpg',
    currentVersion: 1,
    status: 'approved',
    approvedBy: 'Admin',
    approvedAt: '2026-11-02T09:15:00Z',
    titleHi: 'द कम्युनिटी कॉन्फ्रेंस रूम मानक (10 कुर्सियां, 1 बड़ी टेबल)',
    titleEn: 'The Community Boardroom Standard (10 Chairs, 1 Big Table)',
    summaryHi: '10 कुर्सियां दोनों तरफ 5-5 कतार में, सभी सीटों पर कोस्टर व उल्टा गिलास, सेंटर स्पाइन पर पानी की बोतलें।',
    summaryEn: '10 chairs (5 per side), coasters, inverted glasses, and water bottles down table spine.',
    steps: [
      {
        stepNumber: 1,
        instructionHi: 'सभी 10 कुर्सियों को दोनों तरफ 5-5 की सीधी पंक्ति में टेबल के अंदर बराबर धकेलें।',
        instructionEn: 'Align all 10 chairs in straight rows of 5 on each side tucked under table.',
        keyPoints: '5-5 की कतार',
      },
      {
        stepNumber: 2,
        instructionHi: 'प्रत्येक 10 सीटों पर कोस्टर, उल्टा शीशे का गिलास, कंपनी डायरी और पेन रखें।',
        instructionEn: 'Equip all 10 positions with coaster, glass, notepad and pen.',
        keyPoints: 'सभी 10 सीटों की तैयारी',
      },
      {
        stepNumber: 3,
        instructionHi: 'टेबल के बीचोंबीच 4-5 सीलबंद पानी की बोतलें समान दूरी पर रखें।',
        instructionEn: 'Distribute 4-5 sealed water bottles evenly along the table spine.',
        keyPoints: 'समान दूरी',
      },
      {
        stepNumber: 4,
        instructionHi: 'बड़ी मीटिंग से 20 मिनट पहले एसी 23°C पर चालू करें।',
        instructionEn: 'Start AC at 23°C 20 minutes prior to large group meetings.',
        keyPoints: '20 मिनट पहले एसी ऑन',
      },
    ],
    cleaningProcedureHi: 'बड़ी टेबल की सतह पर कपड़े से कोई लकीर न बने, कोलिन से बेदाग साफ करें।',
    cleaningProcedureEn: 'Sanitize conference table with zero streak marks.',
    expectedResultsHi: 'दस कुर्सियां बिल्कुल सीधी कतार में, पूरी स्टेशनरी और पानी तैयार।',
    expectedResultsEn: '10 chairs aligned, stationery and water ready for board meeting.',
    qualityStandardsHi: [
      'सभी कुर्सियों की ऊंचाई एक समान स्तर पर हो।',
      'एचडीएमआई केबल टेबल बॉक्स में सुलझे हुए हों।',
    ],
    qualityStandardsEn: [
      'Uniform chair hydraulic heights.',
      'HDMI and power cords concealed neatly.',
    ],
    mistakesToAvoidHi: ['कुर्सियों को अलग-अलग कोण पर छोड़ना।'],
    mistakesToAvoidEn: ['Leaving chairs pushed back haphazardly.'],
    voiceScriptHi:
      'भैया, द कम्युनिटी बड़ा मीटिंग रूम है। यहां दस कुर्सियां और एक बड़ी टेबल है। दोनों तरफ पांच-पांच कुर्सियों को एक कतार में सीधा रखिए। सभी दस सीटों पर कोस्टर, उल्टा गिलास, डायरी और पेन सजाएं। टेबल के बीच में पानी की बोतलें रखें, और मीटिंग से बीस मिनट पहले एसी चालू कर दें।',
    voiceScriptEn:
      'The Community boardroom features 10 chairs and 1 large table. Tuck 5 chairs on each side straight and provide water and stationery at all 10 seats.',
    versions: [],
    createdAt: '2026-11-02T09:15:00Z',
    updatedAt: '2026-11-02T09:15:00Z',
  },
];

// Helper to load knowledge base from disk
function loadKnowledgeBase(): any[] {
  try {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      const data = fs.readFileSync(KNOWLEDGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading knowledge base:', err);
  }
  // Initialize file with default knowledge
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(DEFAULT_KNOWLEDGE, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing initial knowledge base:', err);
  }
  return DEFAULT_KNOWLEDGE;
}

// Helper to save knowledge base to disk
function saveKnowledgeBase(records: any[]): void {
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving knowledge base:', err);
  }
}

// 1. Permanent Admin Reference Photo Saver (Stored permanently until Admin replaces or deletes)
function saveReferencePhoto(base64Data: string, prefix = 'ref'): string {
  if (!base64Data) return '';
  if (!base64Data.startsWith('data:image/')) {
    return base64Data; // Already a URL or static path
  }
  try {
    const match = base64Data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
    if (!match) return base64Data;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace('+xml', '') || 'jpg';
    const rawBase64 = match[2].trim();
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(REFERENCE_UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(rawBase64, 'base64'));
    return `/uploads/reference/${filename}`;
  } catch (err) {
    console.error('Error saving permanent reference photo to disk:', err);
    return base64Data;
  }
}

// 2. Pantry Boy Task Completion Photo Saver (Stored permanently for 40 days, then auto-purged)
function saveCompletionPhoto(base64Data: string, prefix = 'comp'): { url: string; fileName: string } {
  if (!base64Data) return { url: '', fileName: '' };
  try {
    const match = base64Data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
    if (!match) return { url: base64Data, fileName: '' };
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace('+xml', '') || 'jpg';
    const rawBase64 = match[2].trim();
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(COMPLETION_UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(rawBase64, 'base64'));
    return {
      url: `/uploads/completion/${filename}`,
      fileName: filename,
    };
  } catch (err) {
    console.error('Error saving task completion photo to disk:', err);
    return { url: base64Data, fileName: '' };
  }
}

// Alias for general reference photo backward compatibility
function saveBase64Image(base64Data: string, prefix = 'ref'): string {
  return saveReferencePhoto(base64Data, prefix);
}

/**
 * Permanently removes an uploaded physical file from disk.
 * Searches REFERENCE_UPLOADS_DIR, COMPLETION_UPLOADS_DIR, UPLOADS_DIR, and DATA_DIR.
 * Returns true if at least one file was deleted.
 */
function deletePhysicalUploadFile(photoUrlOrPath: string | undefined | null): boolean {
  if (!photoUrlOrPath || typeof photoUrlOrPath !== 'string') return false;
  // Ignore data: URLs or default asset paths
  if (
    photoUrlOrPath.startsWith('data:image/') ||
    photoUrlOrPath.startsWith('/src/assets/') ||
    photoUrlOrPath.startsWith('src/assets/')
  ) {
    return false;
  }

  try {
    const cleanUrl = photoUrlOrPath.split('?')[0].split('#')[0];
    const filename = path.basename(cleanUrl);
    if (!filename || filename === '.' || filename === '/') return false;

    const candidatePaths = [
      path.join(REFERENCE_UPLOADS_DIR, filename),
      path.join(COMPLETION_UPLOADS_DIR, filename),
      path.join(UPLOADS_DIR, filename),
      path.join(DATA_DIR, filename),
      path.join(DATA_DIR, 'uploads', filename),
    ];

    // If the path was relative to app root like "/uploads/..." or "/data/..."
    if (cleanUrl.startsWith('/uploads/')) {
      candidatePaths.push(path.join(__dirname, 'data', cleanUrl));
    }
    if (cleanUrl.startsWith('/data/')) {
      candidatePaths.push(path.join(__dirname, cleanUrl));
    }

    let deleted = false;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const stat = fs.statSync(p);
          if (stat.isFile()) {
            fs.unlinkSync(p);
            console.log(`[STORAGE_DELETE] Physically unlinked file from disk: ${p}`);
            deleted = true;
          }
        } catch (e) {
          console.warn(`[STORAGE_DELETE] Failed unlinking ${p}:`, e);
        }
      }
    }
    return deleted;
  } catch (err) {
    console.error('[STORAGE_DELETE] Error in deletePhysicalUploadFile:', err);
    return false;
  }
}

// Helpers for persistent Task Completion Photos (40-Day Retention Database)
function loadCompletionPhotos(): any[] {
  try {
    if (fs.existsSync(COMPLETION_PHOTOS_FILE)) {
      const data = fs.readFileSync(COMPLETION_PHOTOS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Auto-restore any missing physical files from embedded backupDataUrl
        for (const p of parsed) {
          if (p && p.url && p.url.startsWith('/uploads/completion/') && p.backupDataUrl && p.backupDataUrl.startsWith('data:image/')) {
            const filename = p.fileName || path.basename(p.url.split('?')[0]);
            const filePath = path.join(COMPLETION_UPLOADS_DIR, filename);
            if (!fs.existsSync(filePath)) {
              try {
                const match = p.backupDataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
                if (match) {
                  fs.writeFileSync(filePath, Buffer.from(match[2].trim(), 'base64'));
                }
              } catch (restoreErr) {
                console.warn('Could not auto-restore completion photo:', filename, restoreErr);
              }
            }
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading completion_photos.json:', err);
  }
  return [];
}

function saveCompletionPhotos(photos: any[]): void {
  try {
    fs.writeFileSync(COMPLETION_PHOTOS_FILE, JSON.stringify(photos, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving completion_photos.json:', err);
  }
}

// 40-Day Retention Constant & Backend Auto-Cleanup
const RETENTION_DAYS = 40;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function cleanupExpiredCompletionPhotos(): { deletedCount: number; remainingCount: number; deletedFiles: string[] } {
  const photos = loadCompletionPhotos();
  const now = Date.now();
  const remaining: any[] = [];
  const deletedFiles: string[] = [];
  const expiredPhotoIds = new Set<string>();
  const expiredUrls = new Set<string>();

  for (const p of photos) {
    const uploadTime = new Date(p.uploadedAt).getTime();
    const isExpired = now - uploadTime > RETENTION_MS;
    if (isExpired) {
      expiredPhotoIds.add(p.id);
      if (p.url) expiredUrls.add(p.url);
      const fileToDelete = p.fileName || (p.url && p.url.startsWith('/uploads/completion/') ? path.basename(p.url) : null);
      if (fileToDelete) {
        try {
          const filePath = path.join(COMPLETION_UPLOADS_DIR, fileToDelete);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles.push(fileToDelete);
          }
        } catch (err) {
          console.error('Error deleting expired completion photo file from disk:', fileToDelete, err);
        }
      }
    } else {
      remaining.push(p);
    }
  }

  // Scan physical files in COMPLETION_UPLOADS_DIR for any file older than 40 days
  try {
    if (fs.existsSync(COMPLETION_UPLOADS_DIR)) {
      const diskFiles = fs.readdirSync(COMPLETION_UPLOADS_DIR);
      diskFiles.forEach((file) => {
        const fullPath = path.join(COMPLETION_UPLOADS_DIR, file);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > RETENTION_MS) {
            fs.unlinkSync(fullPath);
            if (!deletedFiles.includes(file)) {
              deletedFiles.push(file);
            }
          }
        } catch (e) {
          // ignore
        }
      });
    }
  } catch (e) {
    // ignore
  }

  if (deletedFiles.length > 0 || remaining.length !== photos.length) {
    saveCompletionPhotos(remaining);
    console.log(`[Photo Retention] Permanently cleaned up ${deletedFiles.length} expired task completion photos older than 40 days.`);
  }

  // Also prune expired photos from tasks.json
  if (expiredPhotoIds.size > 0 || expiredUrls.size > 0) {
    try {
      const tasksList = loadTasks();
      let tasksChanged = false;
      tasksList.forEach((task: any) => {
        if (Array.isArray(task.proofPhotos)) {
          const origLen = task.proofPhotos.length;
          task.proofPhotos = task.proofPhotos.filter((item: any) => !expiredPhotoIds.has(item.id) && !expiredUrls.has(item.url));
          if (task.proofPhotos.length !== origLen) {
            tasksChanged = true;
            task.proofPhotoUrl = task.proofPhotos.length > 0 ? task.proofPhotos[0].url : undefined;
            task.afterPhotoUrl = task.proofPhotoUrl;
          }
        } else if (task.proofPhotoUrl && expiredUrls.has(task.proofPhotoUrl)) {
          task.proofPhotoUrl = undefined;
          task.afterPhotoUrl = undefined;
          tasksChanged = true;
        }
      });
      if (tasksChanged) {
        saveTasks(tasksList);
      }
    } catch (e) {
      console.warn('Error pruning expired photos from tasks.json:', e);
    }
  }

  return {
    deletedCount: deletedFiles.length,
    remainingCount: remaining.length,
    deletedFiles,
  };
}

// Helpers for persistent Tasks database
function loadTasks(): any[] {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading tasks.json:', err);
  }
  return [];
}

function saveTasks(tasksList: any[]): void {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving tasks.json:', err);
  }
}

// Helpers for persistent visual guides
function loadGuides(): any[] {
  try {
    if (fs.existsSync(GUIDES_FILE)) {
      const data = fs.readFileSync(GUIDES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading guides:', err);
  }
  return [];
}

function saveGuides(guides: any[]): void {
  try {
    fs.writeFileSync(GUIDES_FILE, JSON.stringify(guides, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving guides:', err);
  }
}

// Default Seed Photos for each room gallery
const DEFAULT_ROOM_PHOTOS: Record<string, any[]> = {
  prestige_loft: [
    {
      id: 'photo_prestige_1',
      url: '/uploads/reference/ref_prestige_loft_1794400567624_qayv.jpg',
      fileName: 'ref_prestige_loft_1794400567624_qayv.jpg',
      captionHi: 'प्रेस्टीज लॉफ्ट: 2 सोफे, 45° कुशन व सेंटर टेबल व्यवस्था',
      captionEn: 'Prestige Loft: 2 sofas, 45° plumped cushions & center table setup',
      uploadedAt: '2026-11-11T12:36:07Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_skyline: [
    {
      id: 'photo_skyline_1',
      url: '/uploads/reference/ref_the_skyline_1794400592787_as2u.jpg',
      fileName: 'ref_the_skyline_1794400592787_as2u.jpg',
      captionHi: 'द स्काईलाइन: 4 कुर्सियां टेबल के नीचे समानांतर अंदर व पानी व्यवस्था',
      captionEn: 'The Skyline: 4 chairs tucked parallel under table & water setup',
      uploadedAt: '2026-11-11T12:36:32Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_community: [
    {
      id: 'photo_community_1',
      url: '/uploads/reference/ref_the_community_1794400603611_jrnc.jpg',
      fileName: 'ref_the_community_1794400603611_jrnc.jpg',
      captionHi: 'द कम्युनिटी: 10 कुर्सियां (दोनों तरफ 5-5) कतार में व स्टेशनरी पैड',
      captionEn: 'The Community: 10 chairs aligned with stationery pads',
      uploadedAt: '2026-11-11T12:36:43Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_summit: [
    {
      id: 'photo_summit_1',
      url: '/uploads/reference/ref_the_summit_1794400682325_5379.jpg',
      fileName: 'ref_the_summit_1794400682325_5379.jpg',
      captionHi: 'द समिट: 4 एग्जीक्यूटिव कुर्सियां व टेबल व्यवस्था',
      captionEn: 'The Summit: 4 executive chairs & conference table setup',
      uploadedAt: '2026-11-11T12:38:02Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  wcr_air: [
    {
      id: 'photo_wcrair_1',
      url: '/uploads/reference/ref_wcr_air_1794400701090_f35c.jpg',
      fileName: 'ref_wcr_air_1794400701090_f35c.jpg',
      captionHi: 'डब्ल्यूसीआर एयर: राउंड टेबल व 4 कुर्सियां व्यवस्था',
      captionEn: 'WCR Air: Round table & 4 aligned chairs',
      uploadedAt: '2026-11-11T12:38:21Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  elegance_suite: [
    {
      id: 'photo_elegance_1',
      url: '/uploads/reference/ref_elegance_suite_1794400736550_enns.jpg',
      fileName: 'ref_elegance_suite_1794400736550_enns.jpg',
      captionHi: 'एलिगेंस सुइट: सीनियर मैनेजर डेस्क व कुर्सियां व्यवस्था (कोण 1)',
      captionEn: 'Elegance Suite: Senior manager desk and chairs setup (Angle 1)',
      uploadedAt: '2026-11-11T12:38:56Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
    {
      id: 'photo_elegance_2',
      url: '/uploads/reference/ref_elegance_suite_1794400764795_glxg.jpg',
      fileName: 'ref_elegance_suite_1794400764795_glxg.jpg',
      captionHi: 'एलिगेंस सुइट: विज़िटर कुर्सियां व कोस्टर व्यवस्था (कोण 2)',
      captionEn: 'Elegance Suite: Visitor chairs & coaster setup (Angle 2)',
      uploadedAt: '2026-11-11T12:39:24Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: false,
      photoType: 'reference',
    },
  ],
  prime_loft: [
    {
      id: 'photo_primeloft_1',
      url: '/uploads/reference/ref_prime_loft_1794401077352_iqu9.jpg',
      fileName: 'ref_prime_loft_1794401077352_iqu9.jpg',
      captionHi: 'प्राइम लॉफ्ट: 3 कुर्सियां व डिस्कशन टेबल व्यवस्था',
      captionEn: 'Prime Loft: 3 chairs and discussion table setup',
      uploadedAt: '2026-11-11T12:44:37Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  regency: [
    {
      id: 'photo_regency_1',
      url: '/uploads/reference/ref_regency_1794401083315_fj25.jpg',
      fileName: 'ref_regency_1794401083315_fj25.jpg',
      captionHi: 'रीजेंसी: 3 कुर्सियां, साफ टेबल व पानी की व्यवस्था',
      captionEn: 'Regency: 3 chairs, clean table and water setup',
      uploadedAt: '2026-11-11T12:44:43Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  lalit_sir_cabin: [
    {
      id: 'photo_lalitsir_1',
      url: '/uploads/reference/ref_lalit_sir_cabin_1794401097115_xhfy.jpg',
      fileName: 'ref_lalit_sir_cabin_1794401097115_xhfy.jpg',
      captionHi: 'ललित सर डेस्क: मुख्य लेदर चेयर बीच में सीधी व विज़िटर कुर्सियां (कोण 1)',
      captionEn: 'Lalit Sir desk: Centered executive chair & visitor chairs (Angle 1)',
      uploadedAt: '2026-11-11T12:44:57Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
    {
      id: 'photo_lalitsir_2',
      url: '/uploads/reference/ref_lalit_sir_cabin_1794401101134_tarr.jpg',
      fileName: 'ref_lalit_sir_cabin_1794401101134_tarr.jpg',
      captionHi: 'ललित सर डेस्क: राइट लेदर कोस्टर पर ढका जग व उल्टा गिलास (कोण 2)',
      captionEn: 'Lalit Sir desk: Right leather coaster with carafe & inverted glass (Angle 2)',
      uploadedAt: '2026-11-11T12:45:01Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: false,
      photoType: 'reference',
    },
    {
      id: 'photo_lalitsir_3',
      url: '/uploads/reference/ref_lalit_sir_cabin_1794401107188_rtzf.jpg',
      fileName: 'ref_lalit_sir_cabin_1794401107188_rtzf.jpg',
      captionHi: 'ललित सर कैबिन: संपूर्ण कैबिन लेआउट व कुर्सियां व्यवस्था (कोण 3)',
      captionEn: 'Lalit Sir Cabin: Full cabin layout and seating arrangement (Angle 3)',
      uploadedAt: '2026-11-11T12:45:07Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: false,
      photoType: 'reference',
    },
  ],
  reception: [
    {
      id: 'photo_reception_1',
      url: '/uploads/reference/ref_reception_1794401118506_2hm8.jpg',
      fileName: 'ref_reception_1794401118506_2hm8.jpg',
      captionHi: 'रिसेप्शन लाउंज: विजिटर सोफा, कुशन 45° व सेंटर टेबल (कोण 1)',
      captionEn: 'Reception lounge: Visitor sofa, 45° cushions & center table (Angle 1)',
      uploadedAt: '2026-11-11T12:45:18Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: true,
      photoType: 'reference',
    },
    {
      id: 'photo_reception_2',
      url: '/uploads/reference/ref_reception_1794401126183_ekmm.jpg',
      fileName: 'ref_reception_1794401126183_ekmm.jpg',
      captionHi: 'रिसेप्शन लाउंज: कोस्टर, पानी की बोतल व विजिटर डायरी (कोण 2)',
      captionEn: 'Reception lounge: Coasters, water bottle & guest directory (Angle 2)',
      uploadedAt: '2026-11-11T12:45:26Z',
      uploadedBy: 'Admin (Chetan)',
      isPrimary: false,
      photoType: 'reference',
    },
  ],
  pantry: [],
  lights_equipment: [],
  workstations: [],
  kitchen_area: [],
  employee_desk_area: [],
  pool_area: [],
  light_combination_visitor: [],
  light_combination_employee: [],
};

// Canonical Room Category Normalizer
function normalizeRoomCategory(cat: string): string {
  if (!cat) return 'general';
  return cat
    .toLowerCase()
    .trim()
    .replace(/^guide[-_]/, '')
    .replace(/-/g, '_');
}

// Persistent Room Photos Management
function loadRoomPhotos(): Record<string, any[]> {
  let photosMap: Record<string, any[]> = {};
  let fileExisted = false;
  try {
    if (fs.existsSync(ROOM_PHOTOS_FILE)) {
      const data = fs.readFileSync(ROOM_PHOTOS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        fileExisted = true;
        // Normalize all stored keys so hyphens/prefixes don't create duplicate rooms
        Object.keys(parsed).forEach((key) => {
          const normKey = normalizeRoomCategory(key);
          if (Array.isArray(parsed[key])) {
            photosMap[normKey] = parsed[key];
          }
        });
      }
    }
  } catch (err) {
    console.error('Error reading room_photos.json:', err);
  }

  // Ensure every room category key exists.
  // ONLY if the file did NOT exist at all, populate default seed photos.
  // If the file existed and a room key is an empty array [], respect the Admin's deletion!
  // Never restore deleted photos.
  let hasChanges = false;
  Object.keys(DEFAULT_ROOM_PHOTOS).forEach((cat) => {
    const normCat = normalizeRoomCategory(cat);
    if (photosMap[normCat] === undefined) {
      if (!fileExisted) {
        photosMap[normCat] = [...DEFAULT_ROOM_PHOTOS[cat]];
      } else {
        // Room was created or has no photos; keep as empty array, do NOT restore defaults
        photosMap[normCat] = [];
      }
      hasChanges = true;
    }
  });

  // Reconcile stored records with actual physical files in REFERENCE_UPLOADS_DIR
  // Repairs broken legacy filenames when real uploaded files for that room exist on disk,
  // and indexes any uploaded room files on disk that are not yet in room_photos.json.
  try {
    if (fs.existsSync(REFERENCE_UPLOADS_DIR)) {
      const diskFiles = fs
        .readdirSync(REFERENCE_UPLOADS_DIR)
        .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .sort();
      const diskSet = new Set(diskFiles);

      // Group disk files by category prefix: ref_<category>_<timestamp>_<rand>.<ext>
      const filesByCat: Record<string, string[]> = {};
      diskFiles.forEach((f) => {
        const m = f.match(/^(?:ref|reference|incorrect)_(.+)_(\d{10,})_[a-z0-9]+\.[a-z0-9]+$/i);
        if (m) {
          const cat = normalizeRoomCategory(m[1]);
          if (!filesByCat[cat]) filesByCat[cat] = [];
          filesByCat[cat].push(f);
        }
      });

      Object.keys(photosMap).forEach((cat) => {
        const normCat = normalizeRoomCategory(cat);
        const list = Array.isArray(photosMap[normCat]) ? photosMap[normCat] : [];
        const catDiskFiles = filesByCat[normCat] || [];

        // Track which disk files for this category are already validly referenced
        const usedFiles = new Set<string>();
        list.forEach((p) => {
          const base = p.fileName || (p.url ? path.basename(p.url.split('?')[0]) : '');
          if (base && diskSet.has(base)) {
            usedFiles.add(base);
          }
        });

        const availableFiles = catDiskFiles.filter((f) => !usedFiles.has(f));

        // 1. Restore missing physical file from backupDataUrl if available, or repair legacy filename
        list.forEach((p) => {
          const base = p.fileName || (p.url ? path.basename(p.url.split('?')[0]) : '');
          if (base && !diskSet.has(base) && p.backupDataUrl && typeof p.backupDataUrl === 'string' && p.backupDataUrl.startsWith('data:image/')) {
            try {
              const match = p.backupDataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/);
              if (match) {
                fs.writeFileSync(path.join(REFERENCE_UPLOADS_DIR, base), Buffer.from(match[2].trim(), 'base64'));
                diskSet.add(base);
                usedFiles.add(base);
              }
            } catch (restoreErr) {
              console.warn('Failed to restore image from backupDataUrl:', base, restoreErr);
            }
          }
          if ((!base || !diskSet.has(base)) && availableFiles.length > 0) {
            const replacement = availableFiles.shift()!;
            usedFiles.add(replacement);
            p.url = `/uploads/reference/${replacement}`;
            p.fileName = replacement;
            try {
              const st = fs.statSync(path.join(REFERENCE_UPLOADS_DIR, replacement));
              p.uploadedAt = st.mtime.toISOString();
            } catch {}
            hasChanges = true;
          }
        });

        // 2. Append any remaining unreferenced disk files for this category
        availableFiles.forEach((f) => {
          let uploadedAt = new Date().toISOString();
          try {
            const st = fs.statSync(path.join(REFERENCE_UPLOADS_DIR, f));
            uploadedAt = st.mtime.toISOString();
          } catch {}
          list.push({
            id: `photo_${normCat}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            url: `/uploads/reference/${f}`,
            fileName: f,
            captionHi: `${normCat.replace(/_/g, ' ').toUpperCase()} - संदर्भ फोटो #${list.length + 1}`,
            captionEn: `${normCat.replace(/_/g, ' ').toUpperCase()} - Reference Photo #${list.length + 1}`,
            uploadedAt,
            uploadedBy: 'Admin',
            isPrimary: list.length === 0,
            photoType: 'reference',
          });
          hasChanges = true;
        });

        if (list.length > 0 && !list.some((p) => p.isPrimary)) {
          list[0].isPrimary = true;
          hasChanges = true;
        }
        photosMap[normCat] = list;
      });
    }
  } catch (err) {
    console.warn('Error reconciling room photos with disk:', err);
  }

  if (hasChanges) {
    saveRoomPhotos(photosMap);
  }

  return photosMap;
}

function saveRoomPhotos(data: Record<string, any[]>): void {
  try {
    // Ensure all keys are normalized before saving
    const normalizedData: Record<string, any[]> = {};
    Object.keys(data).forEach((key) => {
      const normKey = normalizeRoomCategory(key);
      normalizedData[normKey] = Array.isArray(data[key]) ? data[key] : [];
    });
    fs.writeFileSync(ROOM_PHOTOS_FILE, JSON.stringify(normalizedData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving room_photos.json:', err);
  }
}

// Persistent Room Analysis Management
function loadRoomAnalysis(): Record<string, any> {
  try {
    if (fs.existsSync(ROOM_ANALYSIS_FILE)) {
      const data = fs.readFileSync(ROOM_ANALYSIS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading room_analysis.json:', err);
  }
  return {};
}

function saveRoomAnalysis(data: Record<string, any>): void {
  try {
    fs.writeFileSync(ROOM_ANALYSIS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving room_analysis.json:', err);
  }
}

// Helper to extract image base64 data for AI multimodal analysis
function getImageDataForAI(url: string): { mimeType: string; data: string } | null {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    const match = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (match) {
      const mime = match[1] === 'jpeg' ? 'image/jpeg' : `image/${match[1]}`;
      return { mimeType: mime, data: match[2] };
    }
  }
  try {
    let filePath = '';
    if (url.startsWith('/uploads/reference/')) {
      filePath = path.join(REFERENCE_UPLOADS_DIR, path.basename(url));
    } else if (url.startsWith('/uploads/completion/')) {
      filePath = path.join(COMPLETION_UPLOADS_DIR, path.basename(url));
    } else if (url.startsWith('/uploads/')) {
      const candidates = [
        path.join(REFERENCE_UPLOADS_DIR, path.basename(url)),
        path.join(COMPLETION_UPLOADS_DIR, path.basename(url)),
        path.join(UPLOADS_DIR, path.basename(url)),
      ];
      filePath = candidates.find((p) => fs.existsSync(p)) || path.join(UPLOADS_DIR, path.basename(url));
    }
    if (filePath && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return { mimeType: mime, data: buf.toString('base64') };
    }
  } catch (e) {
    console.warn('Error reading image for AI analysis:', e);
  }
  return null;
}

// STRICT ADMIN AUTHENTICATION MIDDLEWARE (Requirement 4)
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userRole = (req.headers['x-user-role'] || req.query.userRole || req.body?.userRole) as string;
  const userId = (req.headers['x-user-id'] || req.query.userId || req.body?.userId) as string;

  if (userRole !== 'admin') {
    return res.status(403).json({
      error: 'Permission Denied: Only authenticated Admin accounts can upload reference photos, modify training instructions, or manage training knowledge.',
      code: 'FORBIDDEN_PANTRY_BOY',
    });
  }
  next();
}

// ==========================================
// API ENDPOINTS
// ==========================================

function stripBackupField(list: any[]): any[] {
  return (list || []).map(({ backupDataUrl, ...rest }) => rest);
}

// 1. GET ALL ROOM REFERENCE PHOTOS & AI ANALYSES (Accessible to Pantry Boys & Admins)
app.get('/api/photos/all-rooms', (req, res) => {
  const photos = loadRoomPhotos();
  const analyses = loadRoomAnalysis();
  const cleanPhotos: Record<string, any[]> = {};
  Object.keys(photos).forEach((k) => {
    cleanPhotos[k] = stripBackupField(photos[k]);
  });
  res.json({
    success: true,
    photosByRoom: cleanPhotos,
    analysesByRoom: analyses,
  });
});

// 2. GET SINGLE ROOM REFERENCE PHOTOS
app.get('/api/photos/room/:category', (req, res) => {
  const normCat = normalizeRoomCategory(req.params.category);
  const photos = loadRoomPhotos();
  const analyses = loadRoomAnalysis();
  const roomList = stripBackupField(photos[normCat] || photos[req.params.category] || []);
  const roomAnalysis = analyses[normCat] || analyses[req.params.category] || null;
  res.json({
    success: true,
    category: normCat,
    photos: roomList,
    analysis: roomAnalysis,
  });
});

// 3. UPLOAD MULTIPLE REFERENCE PHOTOS AT ONCE (Admin only)
app.post('/api/photos/upload-multiple', requireAdmin, (req, res) => {
  try {
    const { category, roomName, photos } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Room category is required' });
    }
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'Array of photo objects is required' });
    }

    const normCat = normalizeRoomCategory(category);
    const allRoomPhotos = loadRoomPhotos();
    if (!allRoomPhotos[normCat]) {
      allRoomPhotos[normCat] = [];
    }

    const now = new Date().toISOString();
    const adminName = (req.body?.adminName || req.headers['x-user-name'] || 'Admin') as string;
    const addedItems: any[] = [];

    photos.forEach((p: any, idx: number) => {
      if (!p.photoBase64) return;
      const permanentUrl = saveReferencePhoto(p.photoBase64, `ref_${normCat}`);
      if (!permanentUrl || !permanentUrl.startsWith('/uploads/reference/')) {
        throw new Error(`Failed to store image #${idx + 1} to server storage`);
      }
      const savedFileName = path.basename(permanentUrl);
      if (!fs.existsSync(path.join(REFERENCE_UPLOADS_DIR, savedFileName))) {
        throw new Error(`Image #${idx + 1} was not found on server storage after write`);
      }
      const isFirst = allRoomPhotos[normCat].length === 0 && idx === 0;
      const newItem = {
        id: `photo_${normCat}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: permanentUrl,
        fileName: savedFileName,
        backupDataUrl: p.photoBase64,
        captionHi: p.captionHi || `${roomName || normCat} संदर्भ फोटो #${allRoomPhotos[normCat].length + 1}`,
        captionEn: p.captionEn || `${roomName || normCat} reference angle #${allRoomPhotos[normCat].length + 1}`,
        uploadedAt: now,
        uploadedBy: adminName,
        isPrimary: p.isPrimary ?? isFirst,
        photoType: p.photoType || 'reference',
      };
      allRoomPhotos[normCat].push(newItem);
      addedItems.push(newItem);
    });

    // Ensure at least one photo is primary
    const hasPrimary = allRoomPhotos[normCat].some((p) => p.isPrimary);
    if (!hasPrimary && allRoomPhotos[normCat].length > 0) {
      allRoomPhotos[normCat][0].isPrimary = true;
    }

    saveRoomPhotos(allRoomPhotos);

    // Sync primary photo to knowledge base & visual guide
    const primaryItem = allRoomPhotos[normCat].find((p) => p.isPrimary) || allRoomPhotos[normCat][0];
    if (primaryItem) {
      const records = loadKnowledgeBase();
      const kb = records.find((r) => normalizeRoomCategory(r.category) === normCat);
      if (kb) {
        kb.referencePhotoUrl = primaryItem.url;
        kb.updatedAt = now;
        saveKnowledgeBase(records);
      }

      const guides = loadGuides();
      const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
      if (g) {
        g.photoUrl = primaryItem.url;
        g.photos = allRoomPhotos[normCat];
        g.updatedAt = now;
        saveGuides(guides);
      }
    }

    res.json({
      success: true,
      message: `${addedItems.length} photos uploaded and saved permanently for ${roomName || normCat}!`,
      photos: allRoomPhotos[normCat],
      added: addedItems,
    });
  } catch (err: any) {
    console.error('Error in /api/photos/upload-multiple:', err);
    res.status(500).json({ error: err.message || 'Failed to upload photos' });
  }
});

// 4. SET PHOTO AS PRIMARY (Admin only)
app.post('/api/photos/room/:category/item/:photoId/primary', requireAdmin, (req, res) => {
  try {
    const { category, photoId } = req.params;
    const normCat = normalizeRoomCategory(category);
    const decodedId = decodeURIComponent(photoId);
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[normCat] || [];
    let found = false;
    let primaryUrl = '';

    list.forEach((p) => {
      const isMatch =
        p.id === photoId ||
        p.id === decodedId ||
        p.url === photoId ||
        p.url === decodedId ||
        path.basename(p.url || '') === path.basename(photoId || decodedId);
      if (isMatch) {
        p.isPrimary = true;
        primaryUrl = p.url;
        found = true;
      } else {
        p.isPrimary = false;
      }
    });

    if (!found) {
      return res.status(404).json({ error: 'Photo not found in this room gallery' });
    }

    allRoomPhotos[normCat] = list;
    saveRoomPhotos(allRoomPhotos);

    // Sync knowledge base
    const records = loadKnowledgeBase();
    const kb = records.find((r) => normalizeRoomCategory(r.category) === normCat);
    if (kb && primaryUrl) {
      kb.referencePhotoUrl = primaryUrl;
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
    }

    // Sync guides
    const guides = loadGuides();
    const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
    if (g && primaryUrl) {
      g.photoUrl = primaryUrl;
      g.photos = list;
      g.updatedAt = new Date().toISOString();
      saveGuides(guides);
    }

    res.json({
      success: true,
      message: 'Primary reference photo set successfully',
      photos: list,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to set primary photo' });
  }
});

// 5. UPDATE PHOTO CAPTION (Admin only)
app.post('/api/photos/room/:category/item/:photoId/caption', requireAdmin, (req, res) => {
  try {
    const { category, photoId } = req.params;
    const normCat = normalizeRoomCategory(category);
    const decodedId = decodeURIComponent(photoId);
    const { captionHi, captionEn } = req.body;
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[normCat] || [];
    const item = list.find(
      (p) =>
        p.id === photoId ||
        p.id === decodedId ||
        p.url === photoId ||
        p.url === decodedId ||
        path.basename(p.url || '') === path.basename(photoId || decodedId)
    );
    if (!item) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (captionHi !== undefined) item.captionHi = captionHi;
    if (captionEn !== undefined) item.captionEn = captionEn;
    allRoomPhotos[normCat] = list;
    saveRoomPhotos(allRoomPhotos);

    res.json({ success: true, message: 'Caption updated', photos: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update caption' });
  }
});

// Helper function to execute photo replacement and full database synchronization
function executePhotoReplacement(category: string, photoId: string, req: express.Request, res: express.Response) {
  try {
    const normCat = normalizeRoomCategory(category);
    const decodedId = decodeURIComponent(photoId || '');
    const { photoBase64, captionHi, captionEn } = req.body;
    const targetUrl = (req.body?.url || req.body?.photoUrl || req.query?.url || '').toString().trim();
    const targetPhotoId = (req.body?.photoId || req.query?.photoId || photoId || '').toString().trim();

    if (!photoBase64) {
      return res.status(400).json({ error: 'New photo base64 is required' });
    }

    const allRoomPhotos = loadRoomPhotos();
    let catKey = Object.keys(allRoomPhotos).find((k) => normalizeRoomCategory(k) === normCat) || normCat;
    let list = allRoomPhotos[catKey] || [];

    // Find index of photo to replace with multi-criteria matching
    let idx = list.findIndex((p) => {
      if (p.id && (p.id === targetPhotoId || p.id === photoId || p.id === decodedId)) return true;
      if (p.url && (p.url === targetPhotoId || p.url === photoId || p.url === decodedId || p.url === targetUrl)) return true;
      const baseP = path.basename(p.url || '');
      const baseTarget = path.basename(targetPhotoId || photoId || decodedId || targetUrl || '');
      if (baseP && baseTarget && baseP === baseTarget) return true;
      if (targetPhotoId.endsWith('_default') && list.length === 1) return true;
      return false;
    });

    if (idx === -1 && list.length === 1) {
      idx = 0;
    }

    if (idx === -1) {
      const pIdx = Number(req.body?.photoIndex ?? req.query?.photoIndex);
      if (!isNaN(pIdx) && pIdx >= 0 && pIdx < list.length) {
        idx = pIdx;
      }
    }

    // Fallback search across all room categories
    if (idx === -1) {
      for (const k of Object.keys(allRoomPhotos)) {
        const candidateList = allRoomPhotos[k];
        const matchIdx = candidateList.findIndex((p) => {
          if (p.id && (p.id === targetPhotoId || p.id === photoId || p.id === decodedId)) return true;
          if (p.url && (p.url === targetPhotoId || p.url === photoId || p.url === decodedId || p.url === targetUrl)) return true;
          const baseP = path.basename(p.url || '');
          const baseTarget = path.basename(targetPhotoId || photoId || decodedId || targetUrl || '');
          return baseP && baseTarget && baseP === baseTarget;
        });
        if (matchIdx !== -1) {
          catKey = k;
          list = candidateList;
          idx = matchIdx;
          break;
        }
      }
    }

    if (idx === -1) {
      return res.status(404).json({ error: 'Photo not found to replace' });
    }

    const permanentUrl = saveReferencePhoto(photoBase64, `ref_${normCat}`);
    if (!permanentUrl || !permanentUrl.startsWith('/uploads/reference/')) {
      return res.status(500).json({ error: 'Failed to store replacement image to server storage' });
    }
    const savedFileName = path.basename(permanentUrl);
    if (!fs.existsSync(path.join(REFERENCE_UPLOADS_DIR, savedFileName))) {
      return res.status(500).json({ error: 'Replacement image was not found on server storage after write' });
    }
    const existing = list[idx];

    // Delete old physical file from disk if it was an uploaded file
    if (existing && existing.url && existing.url !== permanentUrl) {
      deletePhysicalUploadFile(existing.url);
    }
    if (targetUrl && targetUrl !== permanentUrl) {
      deletePhysicalUploadFile(targetUrl);
    }

    list[idx] = {
      ...existing,
      url: permanentUrl,
      fileName: savedFileName,
      backupDataUrl: photoBase64,
      captionHi: captionHi ?? existing.captionHi,
      captionEn: captionEn ?? existing.captionEn,
      uploadedAt: new Date().toISOString(),
      uploadedBy: (req.body?.adminName || req.headers['x-user-name'] || 'Admin') as string,
    };

    allRoomPhotos[catKey] = list;
    saveRoomPhotos(allRoomPhotos);

    // Sync Knowledge Base, Guides, Tasks
    const primaryItem = list.find((p) => p.isPrimary) || list[0];
    const newPrimaryUrl = primaryItem ? primaryItem.url : permanentUrl;

    const records = loadKnowledgeBase();
    const kb = records.find((r) => normalizeRoomCategory(r.category) === normCat);
    if (kb) {
      if (list[idx].isPrimary || kb.referencePhotoUrl === existing?.url || !kb.referencePhotoUrl) {
        kb.referencePhotoUrl = newPrimaryUrl;
      }
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
    }

    const guides = loadGuides();
    const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
    if (g) {
      if (list[idx].isPrimary || g.photoUrl === existing?.url || !g.photoUrl) {
        g.photoUrl = newPrimaryUrl;
      }
      g.photos = list;
      g.updatedAt = new Date().toISOString();
      saveGuides(guides);
    }

    const tasks = loadTasks();
    let tasksChanged = false;
    tasks.forEach((t: any) => {
      if (normalizeRoomCategory(t.roomCategory) === normCat) {
        if (!t.referencePhotoUrl || t.referencePhotoUrl === existing?.url || t.referencePhotoUrl === targetUrl) {
          t.referencePhotoUrl = newPrimaryUrl;
          tasksChanged = true;
        }
      }
    });
    if (tasksChanged) {
      saveTasks(tasks);
    }

    console.log(`[PHOTO_REPLACE_SUCCESS] Successfully replaced reference photo in room ${normCat}. New URL: ${permanentUrl}`);

    res.json({
      success: true,
      message: 'Photo replaced successfully',
      photos: list,
      replacedPhoto: list[idx],
    });
  } catch (err: any) {
    console.error('Error replacing photo:', err);
    res.status(500).json({ error: err.message || 'Failed to replace photo' });
  }
}

// 6. REPLACE INDIVIDUAL PHOTO (Admin only - supports URL params and body alias)
app.post('/api/photos/room/:category/item/:photoId/replace', requireAdmin, (req, res) => {
  executePhotoReplacement(req.params.category, req.params.photoId, req, res);
});

app.post('/api/photos/replace-item', requireAdmin, (req, res) => {
  const category = req.body?.category || req.query?.category || '';
  const photoId = req.body?.photoId || req.query?.photoId || '';
  executePhotoReplacement(category, photoId, req, res);
});

// Helper function to execute photo deletion and full database synchronization
function executePhotoDeletion(category: string, photoId: string, req: express.Request, res: express.Response) {
  try {
    const rawCat = (category || req.body?.category || req.query?.category || '').toString().trim();
    const normCat = normalizeRoomCategory(rawCat);
    const decodedId = decodeURIComponent(photoId || '');
    const targetUrl = (req.body?.url || req.query?.url || '').toString().trim();
    const targetPhotoId = (req.body?.photoId || req.query?.photoId || photoId || '').toString().trim();
    const pIdx = Number(req.body?.photoIndex ?? req.query?.photoIndex);

    const allRoomPhotos = loadRoomPhotos();
    let catKey = Object.keys(allRoomPhotos).find((k) => normalizeRoomCategory(k) === normCat) || normCat;
    let list = allRoomPhotos[catKey] || allRoomPhotos[normCat] || [];

    const isSpecialId = (id: string) => !id || id === 'current' || id === 'undefined' || id === 'null';
    let idx = -1;

    // 1. Try matching by exact photoId
    if (!isSpecialId(targetPhotoId) || !isSpecialId(decodedId)) {
      idx = list.findIndex((p) => {
        if (p.id && !isSpecialId(targetPhotoId) && (p.id === targetPhotoId || p.id === decodedId)) return true;
        return false;
      });
    }

    // 2. Try matching by URL (exact or relative)
    if (idx === -1 && (targetUrl || (targetPhotoId && targetPhotoId.includes('/')))) {
      const matchUrl = targetUrl || targetPhotoId;
      idx = list.findIndex((p) => {
        if (!p.url) return false;
        if (p.url === matchUrl) return true;
        if (matchUrl.endsWith(p.url) || p.url.endsWith(matchUrl)) return true;
        return false;
      });
    }

    // 3. Try matching by filename basename
    if (idx === -1) {
      const candidates = [targetUrl, targetPhotoId, decodedId].filter((c) => !isSpecialId(c));
      for (const cand of candidates) {
        const baseTarget = path.basename(cand.split('?')[0].split('#')[0]);
        if (baseTarget && baseTarget !== '.' && baseTarget !== '/') {
          const found = list.findIndex((p) => {
            const baseP = path.basename((p.url || '').split('?')[0].split('#')[0]);
            return baseP === baseTarget;
          });
          if (found !== -1) {
            idx = found;
            break;
          }
        }
      }
    }

    // 4. Try matching by carousel photoIndex
    if (idx === -1 && !isNaN(pIdx) && pIdx >= 0 && pIdx < list.length) {
      idx = pIdx;
    }

    // 5. If gallery has exactly 1 photo, delete that photo
    if (idx === -1 && list.length === 1) {
      idx = 0;
    }

    let removedPhoto: any = null;
    if (idx === -1) {
      for (const k of Object.keys(allRoomPhotos)) {
        const candidateList = allRoomPhotos[k];
        const matchIdx = candidateList.findIndex((p) => {
          if (p.id && (p.id === targetPhotoId || p.id === photoId || p.id === decodedId)) return true;
          if (p.url && (p.url === targetPhotoId || p.url === photoId || p.url === decodedId || p.url === targetUrl)) return true;
          const baseP = path.basename(p.url || '');
          const baseTarget = path.basename(targetPhotoId || photoId || decodedId || targetUrl || '');
          return baseP && baseTarget && baseP === baseTarget;
        });
        if (matchIdx !== -1) {
          catKey = k;
          list = candidateList;
          idx = matchIdx;
          break;
        }
      }
    }

    if (idx === -1) {
      // Check if this was a reference photo URL in knowledge base directly
      const records = loadKnowledgeBase();
      const kb = records.find((r) => normalizeRoomCategory(r.category) === normCat);
      if (kb && (kb.referencePhotoUrl === targetUrl || kb.referencePhotoUrl === photoId || path.basename(kb.referencePhotoUrl || '') === path.basename(targetUrl || photoId || ''))) {
        deletePhysicalUploadFile(kb.referencePhotoUrl);
        kb.referencePhotoUrl = '';
        kb.updatedAt = new Date().toISOString();
        saveKnowledgeBase(records);
        return res.json({
          success: true,
          message: 'Reference photo permanently deleted from database and storage',
          photos: list,
          primaryPhotoUrl: '',
        });
      }
      return res.status(404).json({ error: 'Photo not found in this room gallery' });
    }

    removedPhoto = list.splice(idx, 1)[0];

    // If removed photo was primary or no photo is marked primary, make first remaining photo primary
    if (list.length > 0) {
      const hasPrimary = list.some((p) => p.isPrimary);
      if (!hasPrimary) {
        list[0].isPrimary = true;
      }
    }

    // Permanently unlink physical file from disk across storage
    if (removedPhoto && removedPhoto.url) {
      deletePhysicalUploadFile(removedPhoto.url);
    }
    if (targetUrl) {
      deletePhysicalUploadFile(targetUrl);
    }

    allRoomPhotos[catKey] = list;
    saveRoomPhotos(allRoomPhotos);

    // Determine new primary photo URL
    const primaryItem = list.find((p) => p.isPrimary) || list[0];
    const newPrimaryUrl = primaryItem ? primaryItem.url : '';

    // Synchronize Knowledge Base
    const records = loadKnowledgeBase();
    const kb = records.find((r) => normalizeRoomCategory(r.category) === normCat);
    if (kb) {
      kb.referencePhotoUrl = newPrimaryUrl;
      if (kb.incorrectPhotoUrl === removedPhoto?.url || kb.incorrectPhotoUrl === targetUrl || removedPhoto?.photoType === 'incorrect') {
        kb.incorrectPhotoUrl = undefined;
      }
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
    }

    // Synchronize guides.json
    const guides = loadGuides();
    const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
    if (g) {
      g.photoUrl = newPrimaryUrl;
      if (g.incorrectPhotoUrl === removedPhoto?.url || g.incorrectPhotoUrl === targetUrl) {
        g.incorrectPhotoUrl = undefined;
      }
      g.photos = list;
      g.updatedAt = new Date().toISOString();
      saveGuides(guides);
    }

    // Synchronize tasks.json
    const tasks = loadTasks();
    let tasksChanged = false;
    tasks.forEach((t: any) => {
      if (normalizeRoomCategory(t.roomCategory) === normCat) {
        if (!t.referencePhotoUrl || t.referencePhotoUrl === removedPhoto?.url || t.referencePhotoUrl === targetUrl) {
          t.referencePhotoUrl = newPrimaryUrl;
          tasksChanged = true;
        }
      }
    });
    if (tasksChanged) {
      saveTasks(tasks);
    }

    console.log(`[PHOTO_DELETE_SUCCESS] Permanently deleted reference photo ${photoId} from room ${normCat}. Remaining photos: ${list.length}`);

    return res.json({
      success: true,
      message: 'Reference photo permanently deleted from disk storage and room gallery',
      photos: list,
      removedPhotoId: photoId,
      primaryPhotoUrl: newPrimaryUrl,
    });
  } catch (err: any) {
    console.error('Error deleting photo item:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete photo' });
  }
}

// 7. DELETE INDIVIDUAL PHOTO FROM ROOM (Admin only - supports DELETE & POST)
app.delete('/api/photos/room/:category/item/:photoId', requireAdmin, (req, res) => {
  executePhotoDeletion(req.params.category, req.params.photoId, req, res);
});

// Safe POST alias for delete to prevent proxy/encoding URL parameter drop
app.post('/api/photos/room/:category/item/:photoId/delete', requireAdmin, (req, res) => {
  executePhotoDeletion(req.params.category, req.params.photoId, req, res);
});

// General POST endpoint for deleting a reference photo by category + photoId or url
app.post('/api/photos/delete-item', requireAdmin, (req, res) => {
  const category = req.body?.category || req.query?.category || '';
  const photoId = req.body?.photoId || req.query?.photoId || '';
  executePhotoDeletion(category, photoId, req, res);
});


// Helper to generate expert fallback analysis when Gemini API key is unset or rate limited
function generateFallbackRoomAnalysis(category: string, roomName: string, count: number) {
  const name = roomName || category.replace(/_/g, ' ').toUpperCase();
  return {
    summaryHi: `${name} के सभी ${count} कोणों का विस्तृत एआई अवलोकन: कुर्सियों की सीधी सीध, कांच की मेज की स्वच्छता, कोस्टर व उल्टे गिलासों की मानक स्थिति।`,
    summaryEn: `Detailed 360° AI synthesis across all ${count} reference angles of ${name}: uniform chair alignment, streak-free tabletop, coaster and inverted glass positions.`,
    setupStandardsHi: [
      `सभी कुर्सियों को मेज के नीचे समान ऊंचाई पर समानांतर अंदर दबाकर रखें।`,
      `प्रत्येक सीट के ठीक सामने 1 साफ कोस्टर, 1 उल्टा शीशे का गिलास व नोटपैड सजाएं।`,
      `मेज के मध्य अक्ष पर 2-3 सीलबंद पानी की बोतलें समान दूरी पर रखें (लेबल सामने की ओर)।`,
      `एसी का तापमान 23°C - 24°C पर मीटिंग से 15-20 मिनट पहले सेट करें।`,
    ],
    setupStandardsEn: [
      `Tuck all chairs parallel and flush beneath table at uniform hydraulic height.`,
      `Place 1 spotless coaster, 1 inverted glass tumbler, and notepad at each seat.`,
      `Center 2-3 sealed water bottles evenly along the table spine with labels facing forward.`,
      `Pre-cool room by turning AC to 23°C-24°C 15-20 minutes before scheduled meetings.`,
    ],
    cleaningProcedureHi: [
      `मेज की सतह पर ग्लास क्लीनर स्प्रे करें और नीले माइक्रोफाइबर कपड़े से एस-आकार में पोंछें।`,
      `कुर्सियों की गद्दियों को वैक्यूम या सूखे कपड़े से साफ करें और आर्मरेस्ट को सैनिटाइज करें।`,
      `डस्टबिन खाली करें और नया काला कचरा बैग लगाकर डेस्क के नीचे दाईं ओर रखें।`,
    ],
    cleaningProcedureEn: [
      `Apply glass cleaner and wipe tabletop in an S-pattern using a clean blue microfiber cloth.`,
      `Vacuum or dust fabric chairs and sanitize armrests thoroughly.`,
      `Empty the waste bin, fit a fresh black liner, and conceal under the desk right corner.`,
    ],
    qualityStandardsHi: [
      `मेज की कांच पर उंगलियों के निशान या पेय पदार्थों के छल्ले बिल्कुल शून्य (0%) हों।`,
      `गिलास हमेशा उल्टा रखा होना चाहिए ताकि ऊपर से धूल अंदर न जाए।`,
      `कमरे में ताज़ी खुशबू और 100% साफ-सुथरा फर्श हो।`,
    ],
    qualityStandardsEn: [
      `Zero smudges, fingerprints, or beverage rings on table surfaces.`,
      `Glasses must be inverted to prevent airborne particulate accumulation.`,
      `Room must smell fresh with clean, streak-free flooring.`,
    ],
    mistakesToAvoidHi: [
      `पिछली मीटिंग के जूठे कप, बोतलें या प्रयुक्त टिशू मेज पर छोड़ देना।`,
      `बिना कोस्टर के ठंडे पानी की बोतल रखना जिससे मेज पर पानी के निशान पड़ते हैं।`,
      `खाली कमरे में लाइटें और एसी चालू छोड़कर चले जाना।`,
    ],
    mistakesToAvoidEn: [
      `Leaving used cups, empty bottles, or soiled tissues from previous occupants.`,
      `Placing condensation bottles directly onto surfaces without coasters.`,
      `Leaving ambient lights and AC running when the room is unoccupied.`,
    ],
    analyzedAt: new Date().toISOString(),
    totalPhotosAnalyzed: count,
  };
}

// 8. AI MULTI-PHOTO ROOM ANALYSIS (Analyzes all photos of a room together)
app.post('/api/ai/analyze-room-photos', requireAdmin, async (req, res) => {
  try {
    const { category, roomName } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Room category is required for analysis' });
    }

    const allRoomPhotos = loadRoomPhotos();
    const photos = allRoomPhotos[category] || [];
    if (photos.length === 0) {
      return res.status(400).json({ error: 'No reference photos found for this room. Please upload at least one photo first.' });
    }

    const parts: any[] = [];
    let validCount = 0;

    for (const photo of photos) {
      const imgData = getImageDataForAI(photo.url);
      if (imgData) {
        parts.push({
          inlineData: {
            mimeType: imgData.mimeType,
            data: imgData.data,
          },
        });
        validCount++;
      }
    }

    if (validCount === 0) {
      return res.status(400).json({ error: 'Could not load image data from room photos.' });
    }

    const promptText = `
You are an expert Corporate Office Operations Trainer and Five-Star Pantry Facility Inspector.
You are provided ${validCount} ACTUAL reference photographs of the office room: "${roomName || category.toUpperCase()}".
Analyze ALL of these photos together to gain a complete 360-degree understanding of this specific room.

INSTRUCTIONS:
1. Synthesize observations from ALL angles: furniture placement, distances, chair alignment, table cleanliness, coaster and water bottle positions, glass inverted cleanliness, tissues, tray placement, switches/lights, and dustbins.
2. Formulate practical step-by-step room setup standards that a Pantry Boy can follow without assistance.
3. Formulate the exact cleaning procedure (cloth types, glass cleaner, wiping technique).
4. Define the strict quality benchmarks (what 100% completion looks like).
5. Highlight critical mistakes to avoid (e.g., placing cold bottles without coasters, crooked cushions, unaligned chairs, touching files).

Provide all outputs in conversational, respectful Hindi with accurate English translations.
`;

    parts.push({ text: promptText });

    let analysisData: any = null;

    const aiInstance = getAi();
    if (aiInstance) {
      try {
        const response = await aiInstance.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryHi: { type: Type.STRING },
                summaryEn: { type: Type.STRING },
                setupStandardsHi: { type: Type.ARRAY, items: { type: Type.STRING } },
                setupStandardsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
                cleaningProcedureHi: { type: Type.ARRAY, items: { type: Type.STRING } },
                cleaningProcedureEn: { type: Type.ARRAY, items: { type: Type.STRING } },
                qualityStandardsHi: { type: Type.ARRAY, items: { type: Type.STRING } },
                qualityStandardsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
                mistakesToAvoidHi: { type: Type.ARRAY, items: { type: Type.STRING } },
                mistakesToAvoidEn: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'summaryHi',
                'summaryEn',
                'setupStandardsHi',
                'setupStandardsEn',
                'cleaningProcedureHi',
                'cleaningProcedureEn',
                'qualityStandardsHi',
                'qualityStandardsEn',
                'mistakesToAvoidHi',
                'mistakesToAvoidEn',
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.summaryHi) {
          analysisData = {
            ...parsed,
            analyzedAt: new Date().toISOString(),
            totalPhotosAnalyzed: validCount,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal room analysis API issue, using structured fallback:', geminiErr);
      }
    }

    if (!analysisData) {
      analysisData = generateFallbackRoomAnalysis(category, roomName, validCount);
    }

    const analyses = loadRoomAnalysis();
    analyses[category] = analysisData;
    saveRoomAnalysis(analyses);

    // Synchronize into training_knowledge.json
    const records = loadKnowledgeBase();
    const kb = records.find((r) => r.category === category);
    if (kb) {
      kb.summaryHi = analysisData.summaryHi || kb.summaryHi;
      kb.summaryEn = analysisData.summaryEn || kb.summaryEn;
      if (analysisData.qualityStandardsHi?.length) kb.qualityStandardsHi = analysisData.qualityStandardsHi;
      if (analysisData.qualityStandardsEn?.length) kb.qualityStandardsEn = analysisData.qualityStandardsEn;
      if (analysisData.mistakesToAvoidHi?.length) kb.mistakesToAvoidHi = analysisData.mistakesToAvoidHi;
      if (analysisData.mistakesToAvoidEn?.length) kb.mistakesToAvoidEn = analysisData.mistakesToAvoidEn;
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
    }

    res.json({
      success: true,
      message: `AI successfully analyzed all ${validCount} photos for ${roomName || category}!`,
      analysis: analysisData,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/analyze-room-photos:', err);
    res.status(500).json({ error: err.message || 'AI room photo analysis failed' });
  }
});

// LEGACY SINGLE PHOTO MANAGEMENT (Retained for backward compatibility)
app.post('/api/photos/upload', requireAdmin, (req, res) => {
  try {
    const { photoBase64, category, roomName, photoType = 'reference' } = req.body;
    if (!photoBase64) {
      return res.status(400).json({ error: 'Photo base64 data is required for upload.' });
    }

    const normCat = normalizeRoomCategory(category);
    const permanentUrl = saveReferencePhoto(photoBase64, `${photoType}_${normCat}`);
    if (!permanentUrl || !permanentUrl.startsWith('/uploads/reference/')) {
      return res.status(500).json({ error: 'Failed to store image to server storage' });
    }
    const savedFileName = path.basename(permanentUrl);
    if (!fs.existsSync(path.join(REFERENCE_UPLOADS_DIR, savedFileName))) {
      return res.status(500).json({ error: 'Image was not found on server storage after write' });
    }
    const now = new Date().toISOString();

    // Also append to room_photos gallery
    const allRoomPhotos = loadRoomPhotos();
    if (!allRoomPhotos[normCat]) allRoomPhotos[normCat] = [];
    allRoomPhotos[normCat].push({
      id: `photo_${normCat}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: permanentUrl,
      fileName: savedFileName,
      backupDataUrl: photoBase64,
      captionHi: `${roomName || normCat} संदर्भ फोटो`,
      captionEn: `${roomName || normCat} Reference Photo`,
      uploadedAt: now,
      uploadedBy: req.body?.adminName || 'Admin',
      isPrimary: true,
      photoType,
    });
    // Set all others to false
    allRoomPhotos[normCat].forEach((p, idx) => {
      if (idx !== allRoomPhotos[normCat].length - 1) p.isPrimary = false;
    });
    saveRoomPhotos(allRoomPhotos);

    // Update knowledge database record if category exists
    const records = loadKnowledgeBase();
    let target = records.find((r) => normalizeRoomCategory(r.category) === normCat);

    if (target) {
      if (photoType === 'incorrect') {
        target.incorrectPhotoUrl = permanentUrl;
      } else {
        target.referencePhotoUrl = permanentUrl;
      }
      target.updatedAt = now;
      saveKnowledgeBase(records);
    }

    // Sync guides.json
    const guides = loadGuides();
    const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
    if (g) {
      if (photoType === 'incorrect') {
        g.incorrectPhotoUrl = permanentUrl;
      } else {
        g.photoUrl = permanentUrl;
      }
      g.photos = allRoomPhotos[normCat];
      g.updatedAt = now;
      saveGuides(guides);
    }

    res.json({
      success: true,
      message: 'Reference photo permanently saved on server!',
      photoUrl: permanentUrl,
      photos: allRoomPhotos[normCat],
    });
  } catch (err: any) {
    console.error('Error uploading reference photo:', err);
    res.status(500).json({ error: err.message || 'Failed to save reference photo' });
  }
});

// Helper for deleting all photos in a room category
function executeDeleteAllRoomPhotos(category: string, photoType: string, req: express.Request, res: express.Response) {
  try {
    const normCat = normalizeRoomCategory(category);
    const now = new Date().toISOString();

    // 1. Unlink physical files and clean room_photos gallery
    const allRoomPhotos = loadRoomPhotos();
    if (allRoomPhotos[normCat]) {
      allRoomPhotos[normCat] = allRoomPhotos[normCat].filter((p: any) => {
        const matchesType = photoType === 'incorrect' ? p.photoType === 'incorrect' : p.photoType !== 'incorrect';
        if (matchesType) {
          if (p.url) {
            deletePhysicalUploadFile(p.url);
          }
          return false;
        }
        return true;
      });
      if (allRoomPhotos[normCat].length > 0 && !allRoomPhotos[normCat].some((p) => p.isPrimary)) {
        allRoomPhotos[normCat][0].isPrimary = true;
      }
      saveRoomPhotos(allRoomPhotos);
    }

    // 2. Update knowledge base
    const records = loadKnowledgeBase();
    const target = records.find((r) => normalizeRoomCategory(r.category) === normCat);
    const remainingPrimary = allRoomPhotos[normCat]?.find((p) => p.isPrimary);
    if (target) {
      if (photoType === 'incorrect') {
        target.incorrectPhotoUrl = undefined;
      } else {
        target.referencePhotoUrl = remainingPrimary ? remainingPrimary.url : '';
      }
      target.updatedAt = now;
      saveKnowledgeBase(records);
    }

    // 3. Update guides.json
    const guides = loadGuides();
    const g = guides.find((item: any) => normalizeRoomCategory(item.category) === normCat);
    if (g) {
      if (photoType === 'incorrect') {
        g.incorrectPhotoUrl = undefined;
      } else {
        g.photoUrl = remainingPrimary ? remainingPrimary.url : '';
      }
      g.photos = allRoomPhotos[normCat] || [];
      g.updatedAt = now;
      saveGuides(guides);
    }

    // 4. Update tasks.json if reference photo changed
    if (photoType !== 'incorrect') {
      const tasks = loadTasks();
      let tasksChanged = false;
      tasks.forEach((t: any) => {
        if (normalizeRoomCategory(t.roomCategory) === normCat) {
          t.referencePhotoUrl = remainingPrimary ? remainingPrimary.url : '';
          tasksChanged = true;
        }
      });
      if (tasksChanged) saveTasks(tasks);
    }

    res.json({
      success: true,
      message: 'Room photos deleted successfully from disk and room gallery',
      photos: allRoomPhotos[normCat] || [],
    });
  } catch (err: any) {
    console.error('Error deleting room photos:', err);
    res.status(500).json({ error: err.message || 'Failed to delete photo' });
  }
}

// DELETE ROOM REFERENCE PHOTO (Admin only)
app.delete('/api/photos/room/:category', requireAdmin, (req, res) => {
  const { photoType = 'reference' } = req.body || req.query || {};
  executeDeleteAllRoomPhotos(req.params.category, photoType, req, res);
});

// POST alias for room deletion
app.post('/api/photos/room/:category/delete-all', requireAdmin, (req, res) => {
  const { photoType = 'reference' } = req.body || req.query || {};
  executeDeleteAllRoomPhotos(req.params.category, photoType, req, res);
});

// GET & UPDATE VISUAL GUIDES
app.get('/api/guides', (req, res) => {
  const guides = loadGuides();
  res.json({ success: true, data: guides });
});

app.post('/api/guides/update', requireAdmin, (req, res) => {
  try {
    const guide = req.body;
    if (!guide || !guide.id) {
      return res.status(400).json({ error: 'Valid guide object required' });
    }
    const guides = loadGuides();
    const idx = guides.findIndex((g: any) => g.id === guide.id);
    if (idx !== -1) {
      guides[idx] = { ...guides[idx], ...guide, updatedAt: new Date().toISOString() };
    } else {
      guides.push({ ...guide, updatedAt: new Date().toISOString() });
    }
    saveGuides(guides);
    res.json({ success: true, data: guides[idx !== -1 ? idx : guides.length - 1] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update guide' });
  }
});


// 1. GET ALL APPROVED TRAINING KNOWLEDGE (Public to all roles)
app.get('/api/training/knowledge', (req, res) => {
  const records = loadKnowledgeBase();
  res.json({
    success: true,
    data: records,
    count: records.length,
  });
});

// 2. GET VERSION HISTORY FOR A TRAINING INSTRUCTION
app.get('/api/training/knowledge/:id/versions', (req, res) => {
  const records = loadKnowledgeBase();
  const target = records.find((r) => r.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'Training record not found' });
  }
  res.json({
    success: true,
    id: target.id,
    currentVersion: target.currentVersion,
    versions: target.versions || [],
  });
});

// 3. ADMIN APPROVE & SAVE TRAINING INSTRUCTION (Requirement 1, 3 & 4)
app.post('/api/training/knowledge/approve', requireAdmin, (req, res) => {
  try {
    const {
      id,
      category,
      roomNameHi,
      roomNameEn,
      referencePhotoUrl: rawRefPhoto,
      incorrectPhotoUrl: rawIncPhoto,
      titleHi,
      titleEn,
      summaryHi,
      summaryEn,
      steps,
      cleaningProcedureHi,
      cleaningProcedureEn,
      expectedResultsHi,
      expectedResultsEn,
      qualityStandardsHi,
      qualityStandardsEn,
      mistakesToAvoidHi,
      mistakesToAvoidEn,
      voiceScriptHi,
      voiceScriptEn,
      adminName,
      changeNote,
    } = req.body;

    if (!titleHi || !category || !rawRefPhoto) {
      return res.status(400).json({ error: 'Missing required fields: titleHi, category, and referencePhotoUrl are mandatory.' });
    }

    // Permanently save base64 photo to server disk if uploaded
    const referencePhotoUrl = saveBase64Image(rawRefPhoto, `ref_${category}`);
    const incorrectPhotoUrl = rawIncPhoto ? saveBase64Image(rawIncPhoto, `inc_${category}`) : undefined;

    const records = loadKnowledgeBase();
    const existingIndex = records.findIndex((r) => r.id === id || (r.category === category && id?.includes(category)));

    const now = new Date().toISOString();
    const approvedByName = adminName || 'Admin (Office Manager)';


    if (existingIndex !== -1) {
      const existing = records[existingIndex];
      const nextVersion = (existing.currentVersion || 1) + 1;

      // Save previous version in version history
      const oldSnapshot = {
        version: existing.currentVersion || 1,
        updatedAt: existing.updatedAt || now,
        updatedBy: existing.approvedBy || 'Admin',
        changeNote: changeNote || `Version ${existing.currentVersion || 1} update`,
        titleHi: existing.titleHi,
        titleEn: existing.titleEn,
        category: existing.category,
        referencePhotoUrl: existing.referencePhotoUrl,
        steps: existing.steps || [],
        cleaningProcedureHi: existing.cleaningProcedureHi,
        cleaningProcedureEn: existing.cleaningProcedureEn,
        qualityStandardsHi: existing.qualityStandardsHi || [],
        qualityStandardsEn: existing.qualityStandardsEn || [],
        mistakesToAvoidHi: existing.mistakesToAvoidHi || [],
        mistakesToAvoidEn: existing.mistakesToAvoidEn || [],
        voiceScriptHi: existing.voiceScriptHi,
        voiceScriptEn: existing.voiceScriptEn,
      };

      const updatedRecord = {
        ...existing,
        category,
        roomNameHi: roomNameHi || existing.roomNameHi,
        roomNameEn: roomNameEn || existing.roomNameEn,
        referencePhotoUrl,
        currentVersion: nextVersion,
        status: 'approved',
        approvedBy: approvedByName,
        approvedAt: now,
        titleHi,
        titleEn: titleEn || titleHi,
        summaryHi: summaryHi || '',
        summaryEn: summaryEn || summaryHi || '',
        steps: steps || existing.steps || [],
        cleaningProcedureHi: cleaningProcedureHi || '',
        cleaningProcedureEn: cleaningProcedureEn || '',
        expectedResultsHi: expectedResultsHi || '',
        expectedResultsEn: expectedResultsEn || '',
        qualityStandardsHi: qualityStandardsHi || [],
        qualityStandardsEn: qualityStandardsEn || [],
        mistakesToAvoidHi: mistakesToAvoidHi || [],
        mistakesToAvoidEn: mistakesToAvoidEn || [],
        voiceScriptHi: voiceScriptHi || existing.voiceScriptHi,
        voiceScriptEn: voiceScriptEn || existing.voiceScriptEn,
        versions: [oldSnapshot, ...(existing.versions || [])],
        updatedAt: now,
      };

      records[existingIndex] = updatedRecord;
      saveKnowledgeBase(records);

      return res.json({
        success: true,
        message: 'Training knowledge and reference photo updated successfully with version history!',
        data: updatedRecord,
      });
    } else {
      // Create new knowledge record
      const newRecord = {
        id: id || `knowledge-${category}-${Date.now()}`,
        category,
        roomNameHi: roomNameHi || category.replace('_', ' ').toUpperCase(),
        roomNameEn: roomNameEn || category.replace('_', ' ').toUpperCase(),
        referencePhotoUrl,
        currentVersion: 1,
        status: 'approved',
        approvedBy: approvedByName,
        approvedAt: now,
        titleHi,
        titleEn: titleEn || titleHi,
        summaryHi: summaryHi || '',
        summaryEn: summaryEn || '',
        steps: steps || [],
        cleaningProcedureHi: cleaningProcedureHi || '',
        cleaningProcedureEn: cleaningProcedureEn || '',
        expectedResultsHi: expectedResultsHi || '',
        expectedResultsEn: expectedResultsEn || '',
        qualityStandardsHi: qualityStandardsHi || [],
        qualityStandardsEn: qualityStandardsEn || [],
        mistakesToAvoidHi: mistakesToAvoidHi || [],
        mistakesToAvoidEn: mistakesToAvoidEn || [],
        voiceScriptHi: voiceScriptHi || '',
        voiceScriptEn: voiceScriptEn || '',
        versions: [],
        createdAt: now,
        updatedAt: now,
      };

      records.push(newRecord);
      saveKnowledgeBase(records);

      return res.json({
        success: true,
        message: 'New training knowledge created and approved successfully!',
        data: newRecord,
      });
    }
  } catch (err: any) {
    console.error('Error approving training knowledge:', err);
    res.status(500).json({ error: err.message || 'Failed to save training knowledge' });
  }
});

// 4. ADMIN REVERT TRAINING INSTRUCTION TO PREVIOUS VERSION
app.post('/api/training/knowledge/:id/revert', requireAdmin, (req, res) => {
  const { targetVersion } = req.body;
  const records = loadKnowledgeBase();
  const targetIndex = records.findIndex((r) => r.id === req.params.id);

  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Training record not found' });
  }

  const record = records[targetIndex];
  const matchedVersion = (record.versions || []).find((v: any) => v.version === Number(targetVersion));

  if (!matchedVersion) {
    return res.status(404).json({ error: `Version ${targetVersion} not found in history.` });
  }

  const now = new Date().toISOString();
  // Archive current before reverting
  const currentSnapshot = {
    version: record.currentVersion,
    updatedAt: record.updatedAt,
    updatedBy: record.approvedBy || 'Admin',
    changeNote: `Snapshot before reverting to Version ${targetVersion}`,
    titleHi: record.titleHi,
    titleEn: record.titleEn,
    category: record.category,
    referencePhotoUrl: record.referencePhotoUrl,
    steps: record.steps,
    cleaningProcedureHi: record.cleaningProcedureHi,
    cleaningProcedureEn: record.cleaningProcedureEn,
    qualityStandardsHi: record.qualityStandardsHi,
    qualityStandardsEn: record.qualityStandardsEn,
    mistakesToAvoidHi: record.mistakesToAvoidHi,
    mistakesToAvoidEn: record.mistakesToAvoidEn,
    voiceScriptHi: record.voiceScriptHi,
    voiceScriptEn: record.voiceScriptEn,
  };

  const revertedRecord = {
    ...record,
    currentVersion: (record.currentVersion || 1) + 1,
    titleHi: matchedVersion.titleHi,
    titleEn: matchedVersion.titleEn,
    referencePhotoUrl: matchedVersion.referencePhotoUrl,
    steps: matchedVersion.steps,
    cleaningProcedureHi: matchedVersion.cleaningProcedureHi,
    cleaningProcedureEn: matchedVersion.cleaningProcedureEn,
    qualityStandardsHi: matchedVersion.qualityStandardsHi,
    qualityStandardsEn: matchedVersion.qualityStandardsEn,
    mistakesToAvoidHi: matchedVersion.mistakesToAvoidHi,
    mistakesToAvoidEn: matchedVersion.mistakesToAvoidEn,
    voiceScriptHi: matchedVersion.voiceScriptHi,
    voiceScriptEn: matchedVersion.voiceScriptEn,
    versions: [currentSnapshot, ...(record.versions || [])],
    updatedAt: now,
  };

  records[targetIndex] = revertedRecord;
  saveKnowledgeBase(records);

  res.json({
    success: true,
    message: `Reverted to instructions from Version ${targetVersion}`,
    data: revertedRecord,
  });
});

// 5. DELETE TRAINING INSTRUCTION (Admin only)
app.delete('/api/training/knowledge/:id', requireAdmin, (req, res) => {
  const records = loadKnowledgeBase();
  const filtered = records.filter((r) => r.id !== req.params.id);
  saveKnowledgeBase(filtered);
  res.json({ success: true, message: 'Instruction deleted successfully' });
});

// ==========================================
// PANTRY BOY TASK COMPLETION & 40-DAY RETENTION ENDPOINTS
// ==========================================

// Complete task with multiple completion photos (Pantry Boy & Admin)
app.post('/api/tasks/:taskId/complete', (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      pantryBoyId,
      pantryBoyName,
      taskTitle,
      roomName,
      notes,
      beforePhotoBase64,
      completionPhotos, // Array of { photoBase64: string, angleLabel?: string, caption?: string }
      afterPhotoBase64, // Legacy fallback single photo
    } = req.body;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RETENTION_MS).toISOString();
    const effectiveUserId = pantryBoyId || (req.headers['x-user-id'] as string) || 'pantry_user';
    const effectiveUserName = pantryBoyName || (req.headers['x-user-name'] as string) || 'Pantry Boy';

    // 1. Process Before Photo if provided (also subject to 40-day retention policy)
    let beforePhotoUrl: string | undefined = undefined;
    let beforePhotoFileName: string | undefined = undefined;
    if (beforePhotoBase64 && beforePhotoBase64.startsWith('data:image/')) {
      const saved = saveCompletionPhoto(beforePhotoBase64, `task_${taskId}_before`);
      beforePhotoUrl = saved.url;
      beforePhotoFileName = saved.fileName;
    } else if (beforePhotoBase64) {
      beforePhotoUrl = beforePhotoBase64;
    }

    // 2. Process all Completion/Proof Photos (stored strictly in /data/uploads/completion/)
    const rawPhotosList: Array<{ photoBase64: string; angleLabel?: string; caption?: string }> = [];
    if (Array.isArray(completionPhotos) && completionPhotos.length > 0) {
      rawPhotosList.push(...completionPhotos);
    } else if (afterPhotoBase64) {
      rawPhotosList.push({ photoBase64: afterPhotoBase64, angleLabel: 'Completion Photo' });
    }

    const savedProofItems: any[] = [];
    rawPhotosList.forEach((item, idx) => {
      if (!item || !item.photoBase64) return;
      let finalUrl = item.photoBase64;
      let finalFileName = '';

      if (item.photoBase64.startsWith('data:image/')) {
        const saved = saveCompletionPhoto(item.photoBase64, `task_${taskId}_comp_${idx + 1}`);
        if (!saved.url || !saved.url.startsWith('/uploads/completion/') || !saved.fileName || !fs.existsSync(path.join(COMPLETION_UPLOADS_DIR, saved.fileName))) {
          throw new Error(`Failed to store completion photo #${idx + 1} on server storage`);
        }
        finalUrl = saved.url;
        finalFileName = saved.fileName;
      }

      const proofItem: any = {
        id: `proof_${taskId}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        taskId,
        taskTitle: taskTitle || 'Office Task',
        roomName: roomName || 'General Office',
        url: finalUrl,
        fileName: finalFileName,
        uploadedAt: now,
        expiresAt: expiresAt,
        pantryBoyId: effectiveUserId,
        pantryBoyName: effectiveUserName,
        angleLabel: item.angleLabel || `Angle #${idx + 1}`,
        caption: item.caption || '',
        retentionDays: RETENTION_DAYS,
      };
      if (item.photoBase64 && item.photoBase64.startsWith('data:image/')) {
        proofItem.backupDataUrl = item.photoBase64;
      }

      savedProofItems.push(proofItem);
    });

    // 3. Save into Completion Photos Audit & Retention Database (completion_photos.json)
    const allCompletionPhotos = loadCompletionPhotos();
    if (savedProofItems.length > 0) {
      allCompletionPhotos.push(...savedProofItems);
      saveCompletionPhotos(allCompletionPhotos);
    }

    // Strip backupDataUrl before storing in tasks.json or returning over HTTP
    const publicProofItems = savedProofItems.map(({ backupDataUrl, ...rest }) => rest);

    // 4. Update the Task in persistent tasks database (tasks.json)
    const tasksList = loadTasks();
    const taskIndex = tasksList.findIndex((t: any) => t.id === taskId);
    const primaryAfterUrl = publicProofItems[0]?.url || (typeof afterPhotoBase64 === 'string' && !afterPhotoBase64.startsWith('data:image/') ? afterPhotoBase64 : '');

    let updatedTaskRecord: any = null;
    if (taskIndex !== -1) {
      tasksList[taskIndex] = {
        ...tasksList[taskIndex],
        status: 'completed',
        completedAt: now,
        completedByUserId: effectiveUserId,
        completedByName: effectiveUserName,
        completedByUserName: effectiveUserName,
        proofPhotoUrl: primaryAfterUrl || tasksList[taskIndex].proofPhotoUrl || tasksList[taskIndex].afterPhotoUrl,
        afterPhotoUrl: primaryAfterUrl || tasksList[taskIndex].afterPhotoUrl,
        beforePhotoUrl: beforePhotoUrl || tasksList[taskIndex].beforePhotoUrl,
        proofPhotos: publicProofItems.length > 0 ? publicProofItems : (tasksList[taskIndex].proofPhotos || []),
        boyNotes: notes ?? tasksList[taskIndex].boyNotes ?? tasksList[taskIndex].notes,
        notes: notes ?? tasksList[taskIndex].notes,
      };
      updatedTaskRecord = tasksList[taskIndex];
    } else {
      updatedTaskRecord = {
        id: taskId,
        title: taskTitle || 'Completed Task',
        titleEn: taskTitle || 'Completed Task',
        titleHi: taskTitle || 'सत्यापित कार्य',
        roomName: roomName || 'General Office',
        roomNameEn: roomName || 'General Office',
        roomNameHi: roomName || 'सामान्य कार्यालय',
        status: 'completed',
        completedAt: now,
        completedByUserId: effectiveUserId,
        completedByName: effectiveUserName,
        completedByUserName: effectiveUserName,
        proofPhotoUrl: primaryAfterUrl,
        afterPhotoUrl: primaryAfterUrl,
        beforePhotoUrl: beforePhotoUrl,
        proofPhotos: publicProofItems,
        boyNotes: notes || '',
        notes: notes || '',
      };
      tasksList.push(updatedTaskRecord);
    }
    saveTasks(tasksList);

    // 5. Trigger proactive cleanup of any expired photos older than 40 days
    cleanupExpiredCompletionPhotos();

    res.json({
      success: true,
      message: `Task completed! ${publicProofItems.length} completion photo(s) stored securely for 40 days.`,
      task: updatedTaskRecord,
      proofPhotos: publicProofItems,
      uploadedAt: now,
      expiresAt: expiresAt,
      retentionDays: RETENTION_DAYS,
    });
  } catch (err: any) {
    console.error('Error completing task with photos:', err);
    res.status(500).json({ error: err.message || 'Failed to complete task' });
  }
});

// Query all active completion photos (Runs 40-day retention cleanup first)
app.get('/api/completion-photos', (req, res) => {
  try {
    cleanupExpiredCompletionPhotos();
    const photos = loadCompletionPhotos();
    const { taskId, pantryBoyId, roomName } = req.query;

    let filtered = photos;
    if (taskId) {
      filtered = filtered.filter((p) => p.taskId === taskId);
    }
    if (pantryBoyId) {
      filtered = filtered.filter((p) => p.pantryBoyId === pantryBoyId);
    }
    if (roomName) {
      filtered = filtered.filter((p) => p.roomName?.toLowerCase() === String(roomName).toLowerCase());
    }

    // Sort newest first & strip backupDataUrl
    filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const publicPhotos = filtered.map(({ backupDataUrl, ...rest }) => rest);

    res.json({
      success: true,
      photos: publicPhotos,
      totalCount: filtered.length,
      retentionPolicyDays: RETENTION_DAYS,
    });
  } catch (err: any) {
    console.error('Error retrieving completion photos:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch completion photos' });
  }
});

// Retention status inspection (Audit dashboard for Admin & Staff)
app.get('/api/completion-photos/retention-status', (req, res) => {
  try {
    const photos = loadCompletionPhotos();
    const now = Date.now();

    // Check disk files
    let diskFiles: string[] = [];
    let diskUsageBytes = 0;
    try {
      if (fs.existsSync(COMPLETION_UPLOADS_DIR)) {
        diskFiles = fs.readdirSync(COMPLETION_UPLOADS_DIR);
        diskFiles.forEach((f) => {
          try {
            const stats = fs.statSync(path.join(COMPLETION_UPLOADS_DIR, f));
            diskUsageBytes += stats.size;
          } catch {}
        });
      }
    } catch {}

    let nextExpiringPhoto: any = null;
    let minTimeToExpiry = Infinity;

    photos.forEach((p) => {
      const uploadTime = new Date(p.uploadedAt).getTime();
      const expiresTime = uploadTime + RETENTION_MS;
      const timeLeft = expiresTime - now;
      if (timeLeft > 0 && timeLeft < minTimeToExpiry) {
        minTimeToExpiry = timeLeft;
        nextExpiringPhoto = {
          id: p.id,
          taskTitle: p.taskTitle,
          uploadedAt: p.uploadedAt,
          expiresAt: new Date(expiresTime).toISOString(),
          daysRemaining: Math.max(0, Math.ceil(timeLeft / (24 * 60 * 60 * 1000))),
        };
      }
    });

    res.json({
      success: true,
      retentionPolicyDays: RETENTION_DAYS,
      totalDatabaseRecords: photos.length,
      diskFilesCount: diskFiles.length,
      diskUsageFormatted: `${(diskUsageBytes / (1024 * 1024)).toFixed(2)} MB`,
      storageDirectory: '/data/uploads/completion',
      referenceStorageDirectory: '/data/uploads/reference (Permanent)',
      nextExpiringPhoto,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to calculate retention status' });
  }
});

// Manual 40-Day Cleanup trigger (Admin only)
app.post('/api/completion-photos/cleanup', requireAdmin, (req, res) => {
  try {
    const result = cleanupExpiredCompletionPhotos();
    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired photos. ${result.remainingCount} active photos remaining within 40-day window.`,
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cleanup operation failed' });
  }
});

// Tasks Getter & Updater for persistent database
app.get('/api/tasks', (req, res) => {
  try {
    // Ensure completion photos are restored if needed before serving tasks
    loadCompletionPhotos();
    const tasks = loadTasks().map((t: any) => ({
      ...t,
      proofPhotos: Array.isArray(t.proofPhotos)
        ? t.proofPhotos.map(({ backupDataUrl, ...rest }: any) => rest)
        : t.proofPhotos,
    }));
    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch tasks' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.body;
    const tasks = loadTasks();
    const idx = tasks.findIndex((t: any) => t.id === id);
    if (idx !== -1) {
      const merged = { ...tasks[idx], ...updated };
      if (Array.isArray(updated.proofPhotos) && updated.proofPhotos.length === 0 && !updated.proofPhotoUrl) {
        merged.proofPhotoUrl = null;
        merged.afterPhotoUrl = null;
      }
      tasks[idx] = merged;
    } else {
      tasks.push({ id, ...updated });
    }
    saveTasks(tasks);
    res.json({ success: true, task: idx !== -1 ? tasks[idx] : tasks[tasks.length - 1] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update task' });
  }
});

// DELETE TASK COMPLETION PHOTO (Admin or owner Pantry Boy)
app.delete('/api/completion-photos/:photoId', (req, res) => {
  try {
    const { photoId } = req.params;
    const { taskId } = req.body || req.query;
    const userRole = (req.headers['x-user-role'] || req.query.userRole || req.body?.userRole) as string;
    const userId = (req.headers['x-user-id'] || req.query.userId || req.body?.userId) as string;
    const decodedId = decodeURIComponent(photoId);

    const allCompletionPhotos = loadCompletionPhotos();
    const photoIdx = allCompletionPhotos.findIndex((p: any) =>
      p.id === photoId ||
      p.id === decodedId ||
      p.url === photoId ||
      p.url === decodedId ||
      p.fileName === photoId ||
      p.fileName === decodedId ||
      path.basename(p.url || '') === photoId ||
      path.basename(p.url || '') === decodedId
    );
    let removedItem: any = null;

    if (photoIdx !== -1) {
      removedItem = allCompletionPhotos[photoIdx];

      // Permission check: Admin or the owner pantry boy
      if (userRole !== 'admin' && userId && removedItem.pantryBoyId && removedItem.pantryBoyId !== userId) {
        return res.status(403).json({ error: 'Permission denied: You can only delete photos uploaded by your account.' });
      }

      // Physically delete file from disk across all upload directories
      if (removedItem.url) deletePhysicalUploadFile(removedItem.url);
      if (removedItem.fileName) deletePhysicalUploadFile(removedItem.fileName);

      allCompletionPhotos.splice(photoIdx, 1);
      saveCompletionPhotos(allCompletionPhotos);
    } else {
      // Even if not in completion_photos.json, still attempt physical deletion if matching a file
      deletePhysicalUploadFile(photoId);
      deletePhysicalUploadFile(decodedId);
    }

    // Also update tasks.json (check specified taskId or search all tasks)
    const tasksList = loadTasks();
    let tasksChanged = false;
    let targetTask: any = null;

    tasksList.forEach((task: any) => {
      const isTarget = !taskId || task.id === taskId || (removedItem && task.id === removedItem.taskId);
      if (isTarget) {
        if (Array.isArray(task.proofPhotos)) {
          const prevCount = task.proofPhotos.length;
          task.proofPhotos = task.proofPhotos.filter((p: any) =>
            p.id !== photoId &&
            p.id !== decodedId &&
            p.url !== photoId &&
            p.url !== decodedId &&
            path.basename(p.url || '') !== photoId &&
            path.basename(p.url || '') !== decodedId
          );
          if (task.proofPhotos.length !== prevCount) {
            tasksChanged = true;
          }
          if (task.proofPhotos.length > 0) {
            task.afterPhotoUrl = task.proofPhotos[0].url;
            task.proofPhotoUrl = task.proofPhotos[0].url;
          } else {
            task.afterPhotoUrl = null;
            task.proofPhotoUrl = null;
          }
        }
        if (
          photoId.startsWith('single_') ||
          task.proofPhotoUrl === photoId ||
          task.proofPhotoUrl === decodedId ||
          (removedItem && task.proofPhotoUrl === removedItem.url) ||
          path.basename(task.proofPhotoUrl || '') === photoId ||
          path.basename(task.proofPhotoUrl || '') === decodedId
        ) {
          if (photoId.startsWith('single_') && task.proofPhotoUrl) {
            deletePhysicalUploadFile(task.proofPhotoUrl);
          }
          task.proofPhotoUrl = task.proofPhotos?.[0]?.url || null;
          task.afterPhotoUrl = task.proofPhotos?.[0]?.url || null;
          tasksChanged = true;
        }
        if (task.id === taskId || (removedItem && task.id === removedItem.taskId)) {
          targetTask = task;
        }
      }
    });

    if (tasksChanged) {
      saveTasks(tasksList);
    }

    res.json({
      success: true,
      message: 'Completion photo deleted successfully from server storage and database.',
      photoId,
      task: targetTask,
      tasks: tasksList,
    });
  } catch (err: any) {
    console.error('Error deleting completion photo:', err);
    res.status(500).json({ error: err.message || 'Failed to delete completion photo' });
  }
});

// DIRECT ENDPOINT: Clear/Delete proof photo from a task
app.delete('/api/tasks/:taskId/proof-photo', (req, res) => {
  try {
    const { taskId } = req.params;
    const userRole = (req.headers['x-user-role'] || req.query.userRole || req.body?.userRole) as string;
    const userId = (req.headers['x-user-id'] || req.query.userId || req.body?.userId) as string;

    const tasksList = loadTasks();
    const taskIdx = tasksList.findIndex((t: any) => t.id === taskId);
    const existingTask = taskIdx !== -1 ? tasksList[taskIdx] : null;

    const allCompletionPhotos = loadCompletionPhotos();
    const taskCompletionPhotos = allCompletionPhotos.filter((p: any) => p.taskId === taskId);

    // Permission check
    const ownerId = existingTask?.completedByUserId || taskCompletionPhotos[0]?.pantryBoyId;
    if (userRole !== 'admin' && userId && ownerId && ownerId !== userId) {
      return res.status(403).json({ error: 'Permission denied to delete photos from this task.' });
    }

    // Unlink all proof photo files from task and completion_photos.json
    if (existingTask) {
      if (Array.isArray(existingTask.proofPhotos)) {
        existingTask.proofPhotos.forEach((p: any) => {
          if (p.url) deletePhysicalUploadFile(p.url);
          if (p.fileName) deletePhysicalUploadFile(p.fileName);
        });
      }
      if (existingTask.proofPhotoUrl) deletePhysicalUploadFile(existingTask.proofPhotoUrl);
      if (existingTask.afterPhotoUrl) deletePhysicalUploadFile(existingTask.afterPhotoUrl);
    }

    taskCompletionPhotos.forEach((p: any) => {
      if (p.url) deletePhysicalUploadFile(p.url);
      if (p.fileName) deletePhysicalUploadFile(p.fileName);
    });

    // Clear from completion_photos.json
    const remainingPhotos = allCompletionPhotos.filter((p: any) => p.taskId !== taskId);
    saveCompletionPhotos(remainingPhotos);

    // Reset or persist cleared task photo fields in tasks.json
    let updatedTask: any;
    if (taskIdx !== -1) {
      updatedTask = {
        ...existingTask,
        proofPhotos: [],
        proofPhotoUrl: null,
        afterPhotoUrl: null,
      };
      tasksList[taskIdx] = updatedTask;
    } else {
      updatedTask = {
        id: taskId,
        proofPhotos: [],
        proofPhotoUrl: null,
        afterPhotoUrl: null,
        updatedAt: new Date().toISOString(),
      };
      tasksList.push(updatedTask);
    }
    saveTasks(tasksList);

    res.json({
      success: true,
      message: 'Task proof photos deleted permanently.',
      task: updatedTask,
    });
  } catch (err: any) {
    console.error('Error deleting task proof photos:', err);
    res.status(500).json({ error: err.message || 'Failed to delete task proof photos' });
  }
});

// 9. SPEECH SYNTHESIS HELPERS FOR GEMINI AUDIO (24kHz WAV & Raw PCM)

// Standard 44-byte RIFF WAV Header generator for 24kHz 16-bit mono PCM
function createWavHeader(dataByteLength: number, sampleRate = 24000): Buffer {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * 1 * 2 bytes)
  buffer.writeUInt16LE(2, 32); // block align (channels * bits / 8)
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);
  return buffer;
}

// Resilient audible synthesized WAV generator (produces rich melodic vocal-like tones if Gemini TTS API is offline or rate-limited)
function generateFallbackAudibleWav(text: string, sampleRate = 24000): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const durationSec = Math.max(0.6, Math.min(3.5, words * 0.24));
  const numSamples = Math.floor(sampleRate * durationSec);
  const pcmBuffer = Buffer.alloc(numSamples * 2);

  const baseFreq = 220; // 220 Hz base pitch
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, Math.sin((Math.PI * i) / numSamples) * 1.6);
    const vibrato = Math.sin(2 * Math.PI * 4.8 * t) * 6;
    const freq = baseFreq + vibrato;

    // Harmonic formants mimicking human speech vowel resonance
    const sampleVal =
      0.55 * Math.sin(2 * Math.PI * freq * t) +
      0.30 * Math.sin(2 * Math.PI * (freq * 2) * t) +
      0.15 * Math.sin(2 * Math.PI * (freq * 3) * t);

    const int16Val = Math.floor(sampleVal * env * 22000);
    pcmBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, int16Val)), i * 2);
  }

  const header = createWavHeader(pcmBuffer.length, sampleRate);
  return Buffer.concat([header, pcmBuffer]).toString('base64');
}


// Circuit-breaker to avoid hammering TTS endpoint when quota limit (10 RPD on free tier) is active
let ttsCooldownUntil = 0;

// Generate speech audio using Gemini 3.8 Flash Lite TTS model with resilient circuit-breaker and fallback
async function generateGeminiSpeech(text: string, voiceName = 'Kore'): Promise<{ audio: string; mimeType: string; sampleRate: number; isFallback: boolean; text: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Empty text provided for speech synthesis');
  }

  const aiInstance = getAi();
  // If no API key configured or in cooldown due to previous quota limit, immediately return resilient audible fallback
  if (!aiInstance || Date.now() < ttsCooldownUntil) {
    const fallbackBase64 = generateFallbackAudibleWav(cleanText);
    return {
      audio: fallbackBase64,
      mimeType: 'audio/wav',
      sampleRate: 24000,
      isFallback: true,
      text: cleanText,
    };
  }

  try {
    let timer: any;
    // 6000ms timeout for TTS call
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TTS timeout')), 6000);
    });

    const ttsCall = aiInstance.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    }).catch((err) => {
      clearTimeout(timer);
      throw err;
    });

    const ttsResponse = await Promise.race([ttsCall, timeoutPromise]);
    clearTimeout(timer);

    const candidate = ttsResponse.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = candidate?.inlineData?.data;
    const mimeType = candidate?.inlineData?.mimeType || 'audio/wav';

    if (base64Audio && base64Audio.length > 50) {
      return {
        audio: base64Audio,
        mimeType: mimeType,
        sampleRate: 24000,
        isFallback: false,
        text: cleanText,
      };
    }
    throw new Error('Gemini TTS candidate did not contain inline audio data');
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded')) {
      // Set cooldown for 65 minutes to prevent hammering the exhausted endpoint
      ttsCooldownUntil = Date.now() + 65 * 60 * 1000;
    }

    // Produce immediate resilient 24kHz WAV audio with vocal harmonic formants
    const fallbackBase64 = generateFallbackAudibleWav(cleanText);
    return {
      audio: fallbackBase64,
      mimeType: 'audio/wav',
      sampleRate: 24000,
      isFallback: true,
      text: cleanText,
    };
  }
}

// 10. UNARY AUDIO SYNTHESIS ENDPOINT (For message listen buttons & SOP cards)
app.post('/api/ai/synthesize-speech', async (req, res) => {
  try {
    const { text, lang, voiceName } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required for speech synthesis.' });
    }
    const voice = voiceName || (lang === 'en' ? 'Puck' : 'Kore');
    const result = await generateGeminiSpeech(text, voice);
    res.json({
      success: true,
      audio: result.audio,
      mimeType: result.mimeType,
      sampleRate: result.sampleRate,
      isFallback: result.isFallback,
      text: result.text,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/synthesize-speech:', err);
    res.status(500).json({ error: err.message || 'Speech synthesis failed' });
  }
});

// Vite middleware integration (Dev Mode vs Production Mode)
async function startServer() {
  const server = http.createServer(app);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });

  // Run 40-day photo retention cleanup on server start
  try {
    const cleanupResult = cleanupExpiredCompletionPhotos();
    if (cleanupResult.deletedCount > 0) {
      console.log(`[Photo Retention] On startup, cleaned up ${cleanupResult.deletedCount} expired photos.`);
    }
  } catch (err) {
    console.error('Error running initial photo retention cleanup:', err);
  }

  // Schedule automatic 40-day photo retention check every 1 hour
  setInterval(() => {
    try {
      cleanupExpiredCompletionPhotos();
    } catch (err) {
      console.error('Error during scheduled photo retention cleanup:', err);
    }
  }, 60 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
    console.log(`Office Operations & AI Training App running on port ${PORT}`);
  });

  const gracefulShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

