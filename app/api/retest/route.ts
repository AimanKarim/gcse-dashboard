import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
export const dynamic = 'force-dynamic';



const CATEGORIES = [
  'Correct Answer',
  'Incorrect Answer',
  'Incomplete Answer',
  'Hallucinations',
  'Correct Answer but outside of Points to Discuss',
  'Partially Correct with Incorrect Information',
  'Invalid Answer',
  'Correct Answer with New Line',
  'Incorrect Answer with Formatting/Grammar Issue',
  'Correct Answer with Formatting/Grammar Issue',
];

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function evaluateCategoryResult(category: string, score: number, max: number): boolean {
  const correct = ['Correct Answer', 'Correct Answer but outside of Points to Discuss', 'Correct Answer with New Line', 'Correct Answer with Formatting/Grammar Issue'];
  const zero = ['Incorrect Answer', 'Hallucinations', 'Invalid Answer', 'Incorrect Answer with Formatting/Grammar Issue'];
  if (correct.includes(category)) return score === max;
  if (zero.includes(category)) return score === 0;
  return score > 0 && score < max || (max === 1 && score === 0);
}

export async function POST(req: Request) {
  try {
    const { rowNum, identity, samples, marks } = await req.json();
    const maxMarks = parseInt(marks) || 1;
    const results: any = {};
    let allPassed = true;

    for (const category of CATEGORIES) {
      const studentAnswer = samples[category] || '';
      if (!studentAnswer) {
        results[category] = { score: 0, max: maxMarks, pass: false, answer: '', feedback: '' };
        continue;
      }

      const evalPrompt = identity.replace(
        '**Student Response:**',
        `**Student Response:**\n${studentAnswer}\n**`
      );

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an exam marking officer. You must NEVER award more than ${maxMarks} mark(s). Maximum mark is ${maxMarks}.`,
          },
          { role: 'user', content: evalPrompt + `\n\nIMPORTANT: Maximum marks = ${maxMarks}. Do not exceed this.` },
        ],
        temperature: 0,
        max_tokens: 500,
      });

      const raw = response.choices[0].message.content?.trim() || '';
      const match = raw.match(/Final Mark[:\s]+(\d+)/i);
      const score = match ? parseInt(match[1]) : 0;
      const passed = evaluateCategoryResult(category, Math.min(score, maxMarks), maxMarks);
      if (!passed) allPassed = false;

      results[category] = { score: Math.min(score, maxMarks), max: maxMarks, pass: passed, answer: studentAnswer, feedback: raw };
    }

    // Write updated scoring to sheet
    const scoringData = {
      overall_pass: allPassed,
      status: allPassed ? 'approved' : 'needs_review',
      results,
      samples,
    };

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GSHEET_ID,
      range: `Sheet1!K${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[JSON.stringify(scoringData)]] },
    });

    return NextResponse.json({ success: true, scoring: scoringData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}