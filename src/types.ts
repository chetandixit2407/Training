export type Language = 'hi' | 'en';

export type UserRole = 'pantry_boy' | 'admin';

export interface User {
  id: string;
  name: string;
  nameHi: string;
  username: string;
  pin: string;
  role: UserRole;
  shift: string;
  shiftHi: string;
  avatarColor: string;
}

export type RoomCategory =
  | 'reception'
  | 'prestige_loft'
  | 'the_skyline'
  | 'the_community'
  | 'the_summit'
  | 'wcr_air'
  | 'elegance_suite'
  | 'prime_loft'
  | 'regency'
  | 'lalit_sir_cabin'
  | 'pantry'
  | 'workstations'
  | 'lights_equipment'
  | 'kitchen_area'
  | 'employee_desk_area'
  | 'pool_area'
  | 'light_combination_visitor'
  | 'light_combination_employee';

export interface RoomPhotoItem {
  id: string;
  url: string;
  captionHi?: string;
  captionEn?: string;
  uploadedAt: string;
  uploadedBy?: string;
  isPrimary?: boolean;
  photoType?: 'reference' | 'incorrect';
}

export interface AIRoomAnalysis {
  analyzedAt: string;
  summaryHi: string;
  summaryEn: string;
  setupStandardsHi: string[];
  setupStandardsEn: string[];
  cleaningProcedureHi: string[];
  cleaningProcedureEn: string[];
  qualityStandardsHi: string[];
  qualityStandardsEn: string[];
  mistakesToAvoidHi: string[];
  mistakesToAvoidEn: string[];
  totalPhotosAnalyzed: number;
}

export interface VisualGuide {
  id: string;
  category: RoomCategory;
  titleHi: string;
  titleEn: string;
  subtitleHi: string;
  subtitleEn: string;
  furnitureDetailsHi: string; // e.g. "2 सोफे, 1 टेबल"
  furnitureDetailsEn: string; // e.g. "2 sofas, 1 table"
  photoUrl: string;
  photoCaptionHi: string;
  photoCaptionEn: string;
  incorrectPhotoUrl?: string;
  incorrectCaptionHi?: string;
  incorrectCaptionEn?: string;

  // Multi-photo gallery per room
  photos?: RoomPhotoItem[];

  // Multi-photo AI Analysis
  aiRoomAnalysis?: AIRoomAnalysis;
  
  // Specific visual placement guidance
  furniturePlacementHi: string[];
  furniturePlacementEn: string[];
  waterAndItemsHi: string[];
  waterAndItemsEn: string[];
  cleaningStandardHi: string[];
  cleaningStandardEn: string[];
  lightsAndSwitchesHi: string[];
  lightsAndSwitchesEn: string[];

  // Correct vs Incorrect rules
  correctRulesHi: string[];
  correctRulesEn: string[];
  incorrectMistakesHi: string[];
  incorrectMistakesEn: string[];

  // Voice narration text
  voiceScriptHi: string;
  voiceScriptEn: string;

  updatedAt: string;
  updatedBy?: string;
}

export interface SOPStep {
  stepNumber: number;
  titleHi: string;
  titleEn: string;
  detailHi: string;
  detailEn: string;
  audioTextHi: string;
  audioTextEn: string;
  doTipHi: string;
  doTipEn: string;
  dontTipHi: string;
  dontTipEn: string;
}

export interface SOP {
  id: string;
  category: 'client_arrival' | 'candidate_arrival' | 'meeting_prep' | 'lighting_power' | 'daily_routine';
  titleHi: string;
  titleEn: string;
  summaryHi: string;
  summaryEn: string;
  badgeHi: string;
  badgeEn: string;
  iconName: string;
  steps: SOPStep[];
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface DailyTask {
  id: string;
  titleHi: string;
  titleEn: string;
  category: RoomCategory;
  roomNameHi: string;
  roomNameEn: string;
  scheduledTime: string;
  assignedToUserId: string; // User ID or 'ALL'
  referencePhotoUrl: string;
  instructionsHi: string;
  instructionsEn: string;
  audioTextHi: string;
  audioTextEn: string;
  status: TaskStatus;
  
  // Proof info
  completedByUserId?: string;
  completedByName?: string;
  completedAt?: string;
  proofPhotoUrl?: string;
  beforePhotoUrl?: string;
  proofPhotos?: CompletionPhotoItem[]; // Multiple task completion photos (40-day retention)
  boyNotes?: string;

  // Admin Review
  adminStatus?: 'pending_review' | 'approved' | 'needs_rework';
  adminFeedback?: string;
  adminReviewedAt?: string;
}

export interface CompletionPhotoItem {
  id: string;
  taskId: string;
  taskTitle: string;
  taskTitleHi?: string;
  roomName: string;
  roomCategory?: RoomCategory | string;
  pantryBoyId: string;
  pantryBoyName: string;
  url: string;
  fileName: string;
  uploadedAt: string; // Exact ISO timestamp
  expiresAt: string; // uploadedAt + 40 days
  angleLabel?: string;
  caption?: string;
  photoType?: 'before' | 'after';
  retentionDays?: number;
}

export interface TrainingInstructionStep {
  stepNumber: number;
  instructionHi: string;
  instructionEn: string;
  keyPoints?: string;
}

export interface TrainingInstructionVersion {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeNote?: string;
  titleHi: string;
  titleEn: string;
  category: RoomCategory;
  referencePhotoUrl: string;
  steps: TrainingInstructionStep[];
  cleaningProcedureHi: string;
  cleaningProcedureEn: string;
  qualityStandardsHi: string[];
  qualityStandardsEn: string[];
  mistakesToAvoidHi: string[];
  mistakesToAvoidEn: string[];
  voiceScriptHi: string;
  voiceScriptEn: string;
}

export interface TrainingKnowledgeRecord {
  id: string;
  category: RoomCategory;
  roomNameHi: string;
  roomNameEn: string;
  referencePhotoUrl: string;
  incorrectPhotoUrl?: string;
  currentVersion: number;
  status: 'draft' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
  titleHi: string;
  titleEn: string;
  summaryHi: string;
  summaryEn: string;
  steps: TrainingInstructionStep[];
  cleaningProcedureHi: string;
  cleaningProcedureEn: string;
  expectedResultsHi: string;
  expectedResultsEn: string;
  qualityStandardsHi: string[];
  qualityStandardsEn: string[];
  mistakesToAvoidHi: string[];
  mistakesToAvoidEn: string[];
  voiceScriptHi: string;
  voiceScriptEn: string;
  versions: TrainingInstructionVersion[];
  createdAt: string;
  updatedAt: string;
}

