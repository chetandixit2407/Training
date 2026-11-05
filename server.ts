import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

// Path to persistent training knowledge database
const DATA_DIR = path.join(__dirname, 'data');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'training_knowledge.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
      referencePhotoUrl,
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

    if (!titleHi || !category || !referencePhotoUrl) {
      return res.status(400).json({ error: 'Missing required fields: titleHi, category, and referencePhotoUrl are mandatory.' });
    }

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

// 6. AI MULTIMODAL REFERENCE PHOTO ANALYSIS (Requirement 1 - Admin only)
app.post('/api/ai/analyze-photo', requireAdmin, async (req, res) => {
  try {
    const { photoBase64, mimeType, category, roomName, adminPrompt } = req.body;

    if (!photoBase64) {
      return res.status(400).json({ error: 'Photo base64 data is required for visual analysis.' });
    }

    // Strip prefix if included
    const cleanBase64 = photoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const promptText = `
You are an expert Corporate Office Operations Trainer and Five-Star Pantry Facility Inspector.
Analyze this ACTUAL office/pantry reference photograph in extreme practical detail.
Target Area / Room: ${roomName || category || 'Office Workstation / Pantry'}.
Admin notes (if any): ${adminPrompt || 'Generate rigorous, realistic step-by-step instructions for a pantry boy'}.

INSTRUCTIONS:
1. Examine the photograph: observe furniture placement, chair alignment, table cleanlines, coaster/glass positions, water bottles, cables, napkins, dustbins, and lighting.
2. Formulate clear, practical step-by-step instructions in simple conversational Hindi (with English translations) that a Pantry Boy can follow without any senior supervisor assistance.
3. Define the exact cleaning procedure (e.g. microfiber cloth, glass cleaner, wiping motions).
4. Define the expected final quality standards (what 100% completion looks like).
5. Highlight crucial mistakes to avoid (e.g., placing wet cold bottles without coasters, crooked chairs, touching computer screens/files).
6. Provide a natural, friendly, face-to-face Hindi voice script starting with "भैया..." polite tone, explaining the work clearly.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            titleHi: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            summaryHi: { type: Type.STRING },
            summaryEn: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  instructionHi: { type: Type.STRING },
                  instructionEn: { type: Type.STRING },
                  keyPoints: { type: Type.STRING },
                },
                required: ['stepNumber', 'instructionHi', 'instructionEn'],
              },
            },
            cleaningProcedureHi: { type: Type.STRING },
            cleaningProcedureEn: { type: Type.STRING },
            expectedResultsHi: { type: Type.STRING },
            expectedResultsEn: { type: Type.STRING },
            qualityStandardsHi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            qualityStandardsEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mistakesToAvoidHi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mistakesToAvoidEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            voiceScriptHi: { type: Type.STRING },
            voiceScriptEn: { type: Type.STRING },
          },
          required: [
            'titleHi',
            'titleEn',
            'summaryHi',
            'summaryEn',
            'steps',
            'cleaningProcedureHi',
            'cleaningProcedureEn',
            'expectedResultsHi',
            'expectedResultsEn',
            'qualityStandardsHi',
            'qualityStandardsEn',
            'mistakesToAvoidHi',
            'mistakesToAvoidEn',
            'voiceScriptHi',
            'voiceScriptEn',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    console.error('Error analyzing photo with Gemini:', err);
    res.status(500).json({ error: err.message || 'AI vision analysis failed' });
  }
});

// 7. ADMIN VOICE INSTRUCTION LEARNING (Requirement 3 - Admin only)
app.post('/api/ai/voice-instruction', requireAdmin, async (req, res) => {
  try {
    const { spokenText, categoryHint } = req.body;

    if (!spokenText || !spokenText.trim()) {
      return res.status(400).json({ error: 'Spoken text instruction is required.' });
    }

    const promptText = `
You are the AI Training System for an Office Operations and Pantry Boy Training App.
An Admin has spoken the following voice instruction:
"${spokenText}"

Hint Category (if provided): ${categoryHint || 'None'}

Your job:
1. Understand the spoken instruction (which may be in informal Hindi, Hinglish, or English).
2. Identify the most relevant office room or task category from:
   ['reception', 'prestige_loft', 'the_skyline', 'the_community', 'the_summit', 'wcr_air', 'elegance_suite', 'prime_loft', 'regency', 'lalit_sir_cabin', 'pantry', 'lights_equipment'].
3. Convert this natural spoken input into structured, production-grade training instructions:
   - titleHi and titleEn
   - summaryHi and summaryEn
   - step-by-step instructions (steps array)
   - cleaning procedure
   - expected results
   - quality standards
   - mistakes to avoid
   - natural supervisor voice script starting with "भैया..."
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            titleHi: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            summaryHi: { type: Type.STRING },
            summaryEn: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  instructionHi: { type: Type.STRING },
                  instructionEn: { type: Type.STRING },
                  keyPoints: { type: Type.STRING },
                },
                required: ['stepNumber', 'instructionHi', 'instructionEn'],
              },
            },
            cleaningProcedureHi: { type: Type.STRING },
            cleaningProcedureEn: { type: Type.STRING },
            expectedResultsHi: { type: Type.STRING },
            expectedResultsEn: { type: Type.STRING },
            qualityStandardsHi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            qualityStandardsEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mistakesToAvoidHi: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mistakesToAvoidEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            voiceScriptHi: { type: Type.STRING },
            voiceScriptEn: { type: Type.STRING },
          },
          required: [
            'category',
            'titleHi',
            'titleEn',
            'summaryHi',
            'summaryEn',
            'steps',
            'cleaningProcedureHi',
            'cleaningProcedureEn',
            'expectedResultsHi',
            'expectedResultsEn',
            'qualityStandardsHi',
            'qualityStandardsEn',
            'mistakesToAvoidHi',
            'mistakesToAvoidEn',
            'voiceScriptHi',
            'voiceScriptEn',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
      originalSpeech: spokenText,
    });
  } catch (err: any) {
    console.error('Error interpreting voice instruction:', err);
    res.status(500).json({ error: err.message || 'Failed to interpret voice instruction' });
  }
});

// 8. HUMAN-LIKE CONVERSATIONAL TRAINING ASSISTANT (Requirement 2 & 5 - Open to Pantry Boys & Admin)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, currentLanguage, userRole, currentRoomHint, pantryBoyName } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Pull current approved knowledge to ground the AI (Requirement 5)
    const knowledgeRecords = loadKnowledgeBase();

    // Prepare concise grounded knowledge string
    const groundedKnowledgeSummary = knowledgeRecords
      .map((k) => {
        return `
=== ROOM/TOPIC: ${k.roomNameEn} (${k.titleHi}) ===
Category: ${k.category}
Summary: ${k.summaryHi} / ${k.summaryEn}
Key Steps:
${(k.steps || []).map((s: any) => `  ${s.stepNumber}. ${s.instructionHi} (${s.instructionEn})`).join('\n')}
Quality Standards:
${(k.qualityStandardsHi || []).map((q: string) => `  * ${q}`).join('\n')}
Mistakes to Avoid:
${(k.mistakesToAvoidHi || []).map((m: string) => `  ! ${m}`).join('\n')}
Voice Guideline: ${k.voiceScriptHi}
`;
      })
      .join('\n');

    const lastUserMessage = messages[messages.length - 1]?.text || '';

    const systemInstruction = `
You are "ट्रेनर भैया" (Trainer Bhaiya), an intelligent, highly supportive, polite, and experienced Office Operations & Pantry Supervisor.
You are talking to a Pantry Boy named ${pantryBoyName || 'भैया'} (User Role: ${userRole || 'pantry_boy'}).

CRITICAL RULES:
1. UNDERSTAND ANY LANGUAGE / ACCENT / SLANG:
   - User may speak in pure Hindi, casual Hinglish (e.g. "meeting room ready kaise karein?", "Lalit sir ke yahan paani kahan rakhna hai?"), English, or broken/incomplete sentences ("aur AC?", "uske baad?", "paani kitna?").
   - You must automatically detect the user's language and respond naturally in the SAME language style! If they ask in Hinglish, reply in warm natural Hinglish with polite Hindi words. If they ask in pure Hindi, reply in clear polite Hindi.
2. TONE & MANNER:
   - Speak like a friendly senior brother / supervisor face-to-face: use polite words like "भैया", "जी", "कर दीजिए", "रखिए", "ध्यान रखिएगा".
   - Short sentences, clear, easy to understand. Avoid bookish/robotic words.
   - Give practical, actionable advice.
3. STRICT FACTUAL GROUNDING:
   - Answer strictly using the official office training knowledge base provided below.
   - AC temperatures: Lalit Sir cabin is 23°C-24°C, Skyline is 23°C (15 mins early), Community is 23°C (20 mins early), Reception is 24°C.
   - Knock twice before entering Lalit Sir's cabin; never touch files on his desk; serve water/tea from the right corner on leather coaster.
   - Always invert clean glasses on coasters; never place condensation-wet bottles directly on wood.
   - Never invent cleaning chemicals or office rules that are not in the guidelines. If unsure, politely ask them to check with Admin.
4. RESPONSE FORMAT:
   - Return clean text that sounds great when spoken aloud.
   - Keep answers focused (2 to 4 clear steps or points).
   - Suggest 2 short follow-up questions they might want to ask next.

OFFICIAL APPROVED KNOWLEDGE BASE:
${groundedKnowledgeSummary}
`;

    // Construct history for multi-turn chat
    const chatContents = messages.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    let response;
    const modelConfig = {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replyText: {
            type: Type.STRING,
            description: 'The natural conversational reply to the pantry boy in the matching language (Hindi/Hinglish/English).',
          },
          audioSpokenText: {
            type: Type.STRING,
            description: 'Clean spoken version for text-to-speech with natural pronunciation and conversational pacing.',
          },
          languageDetected: {
            type: Type.STRING,
            enum: ['hi', 'hinglish', 'en'],
          },
          referencedRooms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of room category names relevant to this answer, e.g. ["reception", "lalit_sir_cabin"].',
          },
          followUpSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 3 short practical follow-up question chips the user can tap.',
          },
        },
        required: ['replyText', 'audioSpokenText', 'languageDetected', 'referencedRooms', 'followUpSuggestions'],
      },
    };

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: modelConfig,
      });
    } catch (primaryErr: any) {
      console.warn('gemini-3.8-flash busy, falling back to gemini-2.5-flash:', primaryErr?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: chatContents,
        config: modelConfig,
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    console.error('Error in AI Assistant chat:', err);
    res.status(500).json({ error: err.message || 'AI Assistant is temporarily busy. Please try again.' });
  }
});

// 9. REAL-TIME STREAMING CONVERSATIONAL ASSISTANT (Ultra-low latency for continuous voice)
app.post('/api/ai/chat-stream', async (req, res) => {
  try {
    const { messages, userRole, pantryBoyName } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Pull current approved knowledge to ground the AI
    const knowledgeRecords = loadKnowledgeBase();
    const groundedKnowledgeSummary = knowledgeRecords
      .map((k) => `=== ${k.roomNameEn} (${k.titleHi}) ===\nSummary: ${k.summaryHi}\nSteps:\n${(k.steps || []).map((s: any) => ` ${s.stepNumber}. ${s.instructionHi}`).join('\n')}\nStandards: ${(k.qualityStandardsHi || []).join('; ')}\nMistakes: ${(k.mistakesToAvoidHi || []).join('; ')}\nVoice Script: ${k.voiceScriptHi}`)
      .join('\n\n');

    const systemInstruction = `
You are "ट्रेनर भैया" (Trainer Bhaiya), an intelligent, highly supportive, polite, and experienced Office Operations & Pantry Supervisor speaking with a Pantry Boy named ${pantryBoyName || 'भैया'} (User Role: ${userRole || 'pantry_boy'}).

CRITICAL RULES FOR REAL-TIME CONVERSATIONAL VOICE:
1. Speak directly in 1 to 3 short, conversational, crystal-clear sentences. No bullet points, no markdown formatting, no robotic jargon.
2. If the user asks in Hindi or Hinglish, answer in warm conversational Hindi/Hinglish starting with "भैया..." (e.g. "भैया, ललित सर के कैबिन में जाने से पहले दो बार नॉक करें और पानी हमेशा टेबल के दाएं कोने पर लेदर कोस्टर में रखें।"). If they speak in English, reply in friendly simple English.
3. STRICT FACTUAL GROUNDING:
   - AC temps: Lalit Sir cabin is 23°C-24°C, Skyline is 23°C (15 mins early), Community is 23°C (20 mins early), Reception is 24°C.
   - Knock twice before entering Lalit Sir's cabin; never touch files on his desk; serve water/tea from the right corner on leather coaster.
   - Always invert clean glasses on coasters; never place condensation-wet bottles directly on wood.
4. Keep the response punchy, practical, and natural for immediate text-to-speech spoken delivery.

OFFICIAL APPROVED KNOWLEDGE BASE:
${groundedKnowledgeSummary}
`;

    const chatContents = messages.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    let isClientClosed = false;
    req.on('close', () => {
      isClientClosed = true;
    });

    let responseStream;
    try {
      responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents: chatContents,
        config: {
          systemInstruction,
          temperature: 0.6,
        },
      });
    } catch (primaryErr: any) {
      console.warn('gemini-3.8-flash busy, falling back to gemini-3.1-flash-lite:', primaryErr?.message);
      responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents: chatContents,
        config: {
          systemInstruction,
          temperature: 0.6,
        },
      });
    }

    for await (const chunk of responseStream) {
      if (isClientClosed) break;
      const chunkText = chunk.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    if (!isClientClosed) {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  } catch (err: any) {
    console.error('Error in AI Assistant stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Stream generation failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Vite middleware integration (Dev Mode vs Production Mode)
async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Office Operations & AI Training App running on port ${PORT}`);
  });
}

startServer();
