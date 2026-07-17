/**
 * Crisis detection system for Infinity mental health application.
 * Checks user input for safety-critical phrases and provides localized/specific helpline contacts.
 */

export interface Helpline {
  name: string;
  number: string;
  description: string;
}

export interface CrisisDetectionResult {
  isCrisis: boolean;
  type?: 'suicide_self_harm' | 'medical_emergency';
  message?: string;
  helplines?: Helpline[];
}

const SUICIDE_SELF_HARM_KEYWORDS = [
  /\bsuicide\b/i,
  /\bsuicidal\b/i,
  /\bkill\s+myself\b/i,
  /\bend\s+my\s+life\b/i,
  /\bending\s+my\s+life\b/i,
  /\bharm\s+myself\b/i,
  /\bself-harm\b/i,
  /\bself\s+harm\b/i,
  /\bcut\s+myself\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bend\s+it\s+all\b/i,
  /\boverdose\b/i,
];

const MEDICAL_EMERGENCY_KEYWORDS = [
  /\bchest\s+pain\b/i,
  /\bextreme\s+chest\s+pain\b/i,
  /\bheart\s+attack\b/i,
  /\bcannot\s+breathe\b/i,
  /\bchest\s+pressure\b/i,
  /\bdifficulty\s+breathing\b/i,
];

export function detectCrisis(text: string): CrisisDetectionResult {
  const normalizedText = text.trim();

  // 1. Check for suicide/self-harm
  for (const regex of SUICIDE_SELF_HARM_KEYWORDS) {
    if (regex.test(normalizedText)) {
      return {
        isCrisis: true,
        type: 'suicide_self_harm',
        message: 'It sounds like you might be going through an extremely difficult time. Please know that you are not alone and there is support available right now.',
        helplines: [
          {
            name: '988 Suicide & Crisis Lifeline',
            number: '988',
            description: 'Free, confidential support available 24/7. Call or text 988.',
          },
          {
            name: 'Crisis Text Line',
            number: 'Text HOME to 741741',
            description: 'Connect with a crisis counselor 24/7 via text.',
          },
          {
            name: 'The Trevor Project (for LGBTQ youth)',
            number: '1-866-488-7386',
            description: 'Call 1-866-488-7386 or text START to 678-678.',
          },
        ],
      };
    }
  }

  // 2. Check for medical emergency (chest pain)
  for (const regex of MEDICAL_EMERGENCY_KEYWORDS) {
    if (regex.test(normalizedText)) {
      return {
        isCrisis: true,
        type: 'medical_emergency',
        message: 'You are experiencing symptoms that could indicate a serious medical emergency (such as a heart attack or acute breathing difficulty). Please contact emergency services immediately.',
        helplines: [
          {
            name: 'Emergency Services',
            number: '911',
            description: 'Call 911 (US/Canada) or your local emergency number (e.g. 112 in Europe, 999 in UK) immediately.',
          },
        ],
      };
    }
  }

  return { isCrisis: false };
}
