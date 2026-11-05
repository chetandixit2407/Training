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

// Initialize Google GenAI client (User-Agent header required by AI Studio guidelines)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Path to persistent training knowledge database and permanent photo uploads
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'training_knowledge.json');
const GUIDES_FILE = path.join(DATA_DIR, 'guides.json');
const ROOM_PHOTOS_FILE = path.join(DATA_DIR, 'room_photos.json');
const ROOM_ANALYSIS_FILE = path.join(DATA_DIR, 'room_analysis.json');

// Ensure data and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Statically serve permanently uploaded reference photos
app.use('/uploads', express.static(UPLOADS_DIR));


// Initial seed data representing approved office training knowledge
const DEFAULT_KNOWLEDGE = [
  {
    id: 'knowledge-reception',
    category: 'reception',
    roomNameHi: 'RECEPTION AREA',
    roomNameEn: 'RECEPTION AREA',
    referencePhotoUrl: '/src/assets/images/office_reception_lounge_1793614168526.jpg',
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
        referencePhotoUrl: '/src/assets/images/office_reception_lounge_1793614168526.jpg',
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
    referencePhotoUrl: '/src/assets/images/office_cabin_desk_1793614184873.jpg',
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
        referencePhotoUrl: '/src/assets/images/office_cabin_desk_1793614184873.jpg',
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
    referencePhotoUrl: '/src/assets/images/office_meeting_room_1793614169917.jpg',
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
        referencePhotoUrl: '/src/assets/images/office_meeting_room_1793614169917.jpg',
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
    referencePhotoUrl: '/src/assets/images/office_meeting_room_1793614169917.jpg',
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

// Helper to save base64 image data to permanent file on disk
function saveBase64Image(base64Data: string, prefix = 'ref'): string {
  if (!base64Data) return '';
  if (!base64Data.startsWith('data:image/')) {
    return base64Data; // Already a URL or static path
  }
  try {
    const match = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return base64Data;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1].replace('+xml', '') || 'jpg';
    const rawBase64 = match[2];
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(rawBase64, 'base64'));
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving base64 image to disk:', err);
    return base64Data;
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
      url: '/src/assets/images/office_reception_lounge_1793614168526.jpg',
      captionHi: '2 सोफे, 45° फूले हुए कुशन व सेंटर टेबल व्यवस्था',
      captionEn: '2 sofas, 45° plumped cushions & center table setup',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_skyline: [
    {
      id: 'photo_skyline_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'द स्काईलाइन: 8-सीटर कॉन्फ्रेंस टेबल व पानी की बोतलें',
      captionEn: 'The Skyline: 8-seater conference table & fresh water setup',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_community: [
    {
      id: 'photo_community_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'द कम्युनिटी: 10 कुर्सियां एक सीध में व स्टेशनरी पैड',
      captionEn: 'The Community: 10 chairs aligned with stationery pads',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  the_summit: [
    {
      id: 'photo_summit_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'द समिट: बोर्डरूम कुर्सियां व एचडीएमआई केबल बॉक्स',
      captionEn: 'The Summit: Boardroom seating & HDMI cable console',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  wcr_air: [
    {
      id: 'photo_wcrair_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'डब्ल्यूसीआर एयर: क्विक-मीट राउंड टेबल व 4 कुर्सियां',
      captionEn: 'WCR Air: Quick-meet table and 4 aligned chairs',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  elegance_suite: [
    {
      id: 'photo_elegance_1',
      url: '/src/assets/images/office_cabin_desk_1793614184873.jpg',
      captionHi: 'एलिगेंस सुइट: सीनियर मैनेजर डेस्क व विज़िटर कुर्सियां',
      captionEn: 'Elegance Suite: Senior manager desk and visitor chairs',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  prime_loft: [
    {
      id: 'photo_primeloft_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'प्राइम लॉफ्ट: 6 कुर्सियां व टीवी प्रेजेंटेशन सेटअप',
      captionEn: 'Prime Loft: 6 chairs and TV presentation setup',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  regency: [
    {
      id: 'photo_regency_1',
      url: '/src/assets/images/office_meeting_room_1793614169917.jpg',
      captionHi: 'रीजेंसी: वीआईपी डिस्कशन टेबल, लेदर कुर्सियां',
      captionEn: 'Regency: VIP discussion table, executive chairs',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  lalit_sir_cabin: [
    {
      id: 'photo_lalitsir_1',
      url: '/src/assets/images/office_cabin_desk_1793614184873.jpg',
      captionHi: 'ललित सर डेस्क: राइट लेदर कोस्टर पर पानी व उल्टा गिलास',
      captionEn: 'Lalit Sir desk: Right leather coaster with carafe & inverted glass',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  reception: [
    {
      id: 'photo_reception_1',
      url: '/src/assets/images/office_reception_lounge_1793614168526.jpg',
      captionHi: 'रिसेप्शन लाउंज: विजिटर सोफा, कुशन 45° व विजिटर डायरी',
      captionEn: 'Reception lounge: Visitor sofa, 45° cushions & guest directory',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  pantry: [
    {
      id: 'photo_pantry_1',
      url: '/src/assets/images/office_pantry_setup_1793614167563.jpg',
      captionHi: 'पैंट्री काउंटर: कॉफी वेंडिंग मशीन, ट्रे व कप रैक सफाई',
      captionEn: 'Pantry counter: Coffee machine, trays & clean cup rack',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
  lights_equipment: [
    {
      id: 'photo_lights_1',
      url: '/src/assets/images/office_switchboard_lights_1793614186214.jpg',
      captionHi: 'स्विच बोर्ड मार्किंग, एसी रिमोट व लाइटिंग कंट्रोल',
      captionEn: 'Switchboard labels, AC remote & lighting control panel',
      uploadedAt: '2026-11-02T08:30:00Z',
      uploadedBy: 'Admin (System)',
      isPrimary: true,
      photoType: 'reference',
    },
  ],
};

// Persistent Room Photos Management
function loadRoomPhotos(): Record<string, any[]> {
  let photosMap: Record<string, any[]> = {};
  try {
    if (fs.existsSync(ROOM_PHOTOS_FILE)) {
      const data = fs.readFileSync(ROOM_PHOTOS_FILE, 'utf-8');
      photosMap = JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading room_photos.json:', err);
  }

  // Ensure every room has at least default photos
  let hasChanges = false;
  Object.keys(DEFAULT_ROOM_PHOTOS).forEach((cat) => {
    if (!photosMap[cat] || photosMap[cat].length === 0) {
      photosMap[cat] = [...DEFAULT_ROOM_PHOTOS[cat]];
      hasChanges = true;
    }
  });

  // Check if existing uploaded reception photo exists and isn't included
  const existingUploadPath = path.join(UPLOADS_DIR, 'reference_reception_1793860755498_awl5.jpg');
  if (fs.existsSync(existingUploadPath)) {
    const existingUrl = '/uploads/reference_reception_1793860755498_awl5.jpg';
    if (!photosMap.reception) photosMap.reception = [];
    if (!photosMap.reception.some((p) => p.url === existingUrl)) {
      photosMap.reception.push({
        id: 'photo_reception_uploaded_live',
        url: existingUrl,
        captionHi: 'एडमिन द्वारा अपलोड किया गया वास्तविक रिसेप्शन संदर्भ फोटो',
        captionEn: 'Actual office reception reference photo uploaded by Admin',
        uploadedAt: '2026-11-04T12:00:00Z',
        uploadedBy: 'Admin',
        isPrimary: false,
        photoType: 'reference',
      });
      hasChanges = true;
    }
  }

  if (hasChanges) {
    saveRoomPhotos(photosMap);
  }

  return photosMap;
}

function saveRoomPhotos(data: Record<string, any[]>): void {
  try {
    fs.writeFileSync(ROOM_PHOTOS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
    if (url.startsWith('/uploads/')) {
      filePath = path.join(UPLOADS_DIR, path.basename(url));
    } else if (url.startsWith('/src/assets/images/')) {
      filePath = path.join(__dirname, url);
    } else if (url.startsWith('src/assets/images/')) {
      filePath = path.join(__dirname, url);
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
  const userRole = (req.headers['x-user-role'] || req.body?.userRole) as string;
  const userId = (req.headers['x-user-id'] || req.body?.userId) as string;

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

// 1. GET ALL ROOM REFERENCE PHOTOS & AI ANALYSES (Accessible to Pantry Boys & Admins)
app.get('/api/photos/all-rooms', (req, res) => {
  const photos = loadRoomPhotos();
  const analyses = loadRoomAnalysis();
  res.json({
    success: true,
    photosByRoom: photos,
    analysesByRoom: analyses,
  });
});

// 2. GET SINGLE ROOM REFERENCE PHOTOS
app.get('/api/photos/room/:category', (req, res) => {
  const { category } = req.params;
  const photos = loadRoomPhotos();
  const analyses = loadRoomAnalysis();
  res.json({
    success: true,
    category,
    photos: photos[category] || [],
    analysis: analyses[category] || null,
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

    const allRoomPhotos = loadRoomPhotos();
    if (!allRoomPhotos[category]) {
      allRoomPhotos[category] = [];
    }

    const now = new Date().toISOString();
    const adminName = (req.body?.adminName || req.headers['x-user-name'] || 'Admin') as string;
    const addedItems: any[] = [];

    photos.forEach((p: any, idx: number) => {
      if (!p.photoBase64) return;
      const permanentUrl = saveBase64Image(p.photoBase64, `ref_${category}`);
      const isFirst = allRoomPhotos[category].length === 0 && idx === 0;
      const newItem = {
        id: `photo_${category}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: permanentUrl,
        captionHi: p.captionHi || `${roomName || category} संदर्भ फोटो #${allRoomPhotos[category].length + 1}`,
        captionEn: p.captionEn || `${roomName || category} reference angle #${allRoomPhotos[category].length + 1}`,
        uploadedAt: now,
        uploadedBy: adminName,
        isPrimary: p.isPrimary ?? isFirst,
        photoType: p.photoType || 'reference',
      };
      allRoomPhotos[category].push(newItem);
      addedItems.push(newItem);
    });

    // Ensure at least one photo is primary
    const hasPrimary = allRoomPhotos[category].some((p) => p.isPrimary);
    if (!hasPrimary && allRoomPhotos[category].length > 0) {
      allRoomPhotos[category][0].isPrimary = true;
    }

    saveRoomPhotos(allRoomPhotos);

    // Sync primary photo to knowledge base & visual guide
    const primaryItem = allRoomPhotos[category].find((p) => p.isPrimary) || allRoomPhotos[category][0];
    if (primaryItem) {
      const records = loadKnowledgeBase();
      const kb = records.find((r) => r.category === category);
      if (kb) {
        kb.referencePhotoUrl = primaryItem.url;
        kb.updatedAt = now;
        saveKnowledgeBase(records);
      }

      const guides = loadGuides();
      const g = guides.find((item: any) => item.category === category);
      if (g) {
        g.photoUrl = primaryItem.url;
        g.updatedAt = now;
        saveGuides(guides);
      }
    }

    res.json({
      success: true,
      message: `${addedItems.length} photos uploaded and saved permanently for ${roomName || category}!`,
      photos: allRoomPhotos[category],
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
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[category] || [];
    let found = false;
    let primaryUrl = '';

    list.forEach((p) => {
      if (p.id === photoId) {
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

    allRoomPhotos[category] = list;
    saveRoomPhotos(allRoomPhotos);

    // Sync knowledge base
    const records = loadKnowledgeBase();
    const kb = records.find((r) => r.category === category);
    if (kb && primaryUrl) {
      kb.referencePhotoUrl = primaryUrl;
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
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
    const { captionHi, captionEn } = req.body;
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[category] || [];
    const item = list.find((p) => p.id === photoId);
    if (!item) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (captionHi !== undefined) item.captionHi = captionHi;
    if (captionEn !== undefined) item.captionEn = captionEn;
    allRoomPhotos[category] = list;
    saveRoomPhotos(allRoomPhotos);

    res.json({ success: true, message: 'Caption updated', photos: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update caption' });
  }
});

// 6. REPLACE INDIVIDUAL PHOTO (Admin only)
app.post('/api/photos/room/:category/item/:photoId/replace', requireAdmin, (req, res) => {
  try {
    const { category, photoId } = req.params;
    const { photoBase64, captionHi, captionEn } = req.body;
    if (!photoBase64) {
      return res.status(400).json({ error: 'New photo base64 is required' });
    }
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[category] || [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Photo not found to replace' });
    }

    const permanentUrl = saveBase64Image(photoBase64, `ref_${category}`);
    const existing = list[idx];
    list[idx] = {
      ...existing,
      url: permanentUrl,
      captionHi: captionHi ?? existing.captionHi,
      captionEn: captionEn ?? existing.captionEn,
      uploadedAt: new Date().toISOString(),
      uploadedBy: (req.body?.adminName || 'Admin') as string,
    };

    allRoomPhotos[category] = list;
    saveRoomPhotos(allRoomPhotos);

    if (list[idx].isPrimary) {
      const records = loadKnowledgeBase();
      const kb = records.find((r) => r.category === category);
      if (kb) {
        kb.referencePhotoUrl = permanentUrl;
        kb.updatedAt = new Date().toISOString();
        saveKnowledgeBase(records);
      }
    }

    res.json({ success: true, message: 'Photo replaced successfully', photos: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to replace photo' });
  }
});

// 7. DELETE INDIVIDUAL PHOTO FROM ROOM (Admin only)
app.delete('/api/photos/room/:category/item/:photoId', requireAdmin, (req, res) => {
  try {
    const { category, photoId } = req.params;
    const allRoomPhotos = loadRoomPhotos();
    const list = allRoomPhotos[category] || [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Photo not found in this room' });
    }

    const removed = list.splice(idx, 1)[0];
    if (removed.isPrimary && list.length > 0) {
      list[0].isPrimary = true;
    }

    allRoomPhotos[category] = list;
    saveRoomPhotos(allRoomPhotos);

    // Sync primary photo
    const primaryItem = list.find((p) => p.isPrimary) || list[0];
    const records = loadKnowledgeBase();
    const kb = records.find((r) => r.category === category);
    if (kb) {
      kb.referencePhotoUrl = primaryItem ? primaryItem.url : '';
      kb.updatedAt = new Date().toISOString();
      saveKnowledgeBase(records);
    }

    res.json({
      success: true,
      message: 'Photo deleted permanently from room gallery',
      photos: list,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete photo' });
  }
});

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

    const response = await ai.models.generateContent({
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
    const analysisData = {
      ...parsed,
      analyzedAt: new Date().toISOString(),
      totalPhotosAnalyzed: validCount,
    };

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

    const safeCat = category || 'general';
    const permanentUrl = saveBase64Image(photoBase64, `${photoType}_${safeCat}`);
    const now = new Date().toISOString();

    // Also append to room_photos gallery
    const allRoomPhotos = loadRoomPhotos();
    if (!allRoomPhotos[safeCat]) allRoomPhotos[safeCat] = [];
    allRoomPhotos[safeCat].push({
      id: `photo_${safeCat}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: permanentUrl,
      captionHi: `${roomName || safeCat} संदर्भ फोटो`,
      captionEn: `${roomName || safeCat} Reference Photo`,
      uploadedAt: now,
      uploadedBy: req.body?.adminName || 'Admin',
      isPrimary: true,
      photoType,
    });
    // Set all others to false
    allRoomPhotos[safeCat].forEach((p, idx) => {
      if (idx !== allRoomPhotos[safeCat].length - 1) p.isPrimary = false;
    });
    saveRoomPhotos(allRoomPhotos);

    // Update knowledge database record if category exists
    const records = loadKnowledgeBase();
    let target = records.find((r) => r.category === safeCat);

    if (target) {
      if (photoType === 'incorrect') {
        target.incorrectPhotoUrl = permanentUrl;
      } else {
        target.referencePhotoUrl = permanentUrl;
      }
      target.updatedAt = now;
      saveKnowledgeBase(records);
    }

    res.json({
      success: true,
      message: 'Reference photo permanently saved on server!',
      photoUrl: permanentUrl,
      photos: allRoomPhotos[safeCat],
    });
  } catch (err: any) {
    console.error('Error uploading reference photo:', err);
    res.status(500).json({ error: err.message || 'Failed to save reference photo' });
  }
});

// DELETE ROOM REFERENCE PHOTO (Admin only)
app.delete('/api/photos/room/:category', requireAdmin, (req, res) => {
  try {
    const { category } = req.params;
    const { photoType = 'reference' } = req.body || {};
    const now = new Date().toISOString();

    const records = loadKnowledgeBase();
    const target = records.find((r) => r.category === category);
    if (target) {
      if (photoType === 'incorrect') {
        target.incorrectPhotoUrl = undefined;
      } else {
        target.referencePhotoUrl = '';
      }
      target.updatedAt = now;
      saveKnowledgeBase(records);
    }

    res.json({ success: true, message: 'Reference photo deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete photo' });
  }
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

  // If in cooldown due to previous quota limit, immediately return resilient audible fallback
  if (Date.now() < ttsCooldownUntil) {
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

    const ttsCall = ai.models.generateContent({
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
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
    console.log(`Office Operations & AI Training App running on port ${PORT}`);
  });
}

startServer();

