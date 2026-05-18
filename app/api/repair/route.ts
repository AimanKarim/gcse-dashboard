import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
export const dynamic = 'force-dynamic';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const CATEGORY_EXPECTATIONS: Record<string, string> = {
  'Correct Answer': 'Should receive FULL marks. If failing, the marking instructions are too strict.',
  'Incorrect Answer': 'Should receive 0 marks. If failing, the marking instructions are too lenient.',
  'Incomplete Answer': 'Should receive 0 marks (for 1-mark questions) or partial marks (for multi-mark). The answer is missing key information.',
  'Hallucinations': 'Should receive 0 marks. The answer contains made-up false information and should not be rewarded.',
  'Correct Answer but outside of Points to Discuss': 'Should receive FULL marks. The answer is correct even if it discusses points beyond the main marking points.',
  'Partially Correct with Incorrect Information': 'Should receive 0 marks for 1-mark questions, or partial marks for multi-mark. Contains mix of right and wrong.',
  'Invalid Answer': 'Should receive 0 marks. Gibberish or nonsensical responses must always score 0.',
  'Correct Answer with New Line': 'Should receive FULL marks. Extra whitespace or line breaks should not affect the score.',
  'Incorrect Answer with Formatting/Grammar Issue': 'Should receive 0 marks. Bad formatting does not make a wrong answer correct.',
  'Correct Answer with Formatting/Grammar Issue': 'Should receive FULL marks. Minor spelling or grammar issues should not penalise a correct answer.',
};

export async function POST(req: Request) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { rowNum, identity, scoring, marks } = await req.json();
    const maxMarks = parseInt(marks) || 1;

    // Build detailed failure analysis
    const failures = Object.entries(scoring.results || {})
      .filter(([, v]: any) => !v.pass)
      .map(([cat, v]: any) => {
        const expectation = CATEGORY_EXPECTATIONS[cat] || '';
        return `FAILING: ${cat}
  Expected behaviour: ${expectation}
  Got score: ${v.score}/${v.max}
  Sample answer used: "${v.answer}"
  Evaluator gave: "${v.feedback?.substring(0, 200)}"`;
      })
      .join('\n\n');

    const repairResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert GCSE evaluation prompt engineer fixing a broken marking prompt.

The prompt is failing certain test categories. Your job is to fix the marking instructions so:
- Correct answers always get FULL marks (${maxMarks}/${maxMarks})
- Incorrect/gibberish/hallucinated answers always get 0 marks
- Answers with only formatting/grammar issues still get full marks if content is correct
- For 1-mark questions: incomplete or partially correct answers must get 0 — no middle ground
- For multi-mark questions (2+): incomplete answers can earn partial marks per correct point
- Answers with incorrect information mixed in should not earn marks for those incorrect points
- "Correct Answer but outside of Points to Discuss" gets FULL marks — extra irrelevant info is fine
- "Partially Correct with Incorrect Information" gets 0 for 1-mark, partial for multi-mark

To fix:
1. Make marking instructions more explicit about what earns marks
2. Add clear instructions to ignore formatting/spelling issues
3. Add instructions to give 0 for gibberish/hallucinations
4. Add instruction that correct content with extra discussion still earns full marks
5. Keep the exact question text and scenario unchanged
6. Keep the same total marks
7. Keep the **Student Response:** placeholder at the end

Return ONLY the complete fixed prompt, nothing else.`,
        },
        {
          role: 'user',
          content: `Current prompt:\n${identity}\n\nFailing categories:\n${failures}\n\nMax marks: ${maxMarks}\n\nFix the prompt.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const repairedPrompt = repairResponse.choices[0].message.content?.trim() || '';

    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GSHEET_ID,
      range: `Sheet1!J${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[repairedPrompt]] },
    });

    return NextResponse.json({ success: true, repairedPrompt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}