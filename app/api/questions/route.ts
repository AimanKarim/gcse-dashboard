import { google } from 'googleapis';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

export async function GET() {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_ID,
      range: 'Sheet1!A:N',
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ questions: [] });

    const questions = rows.slice(1).map((row, i) => {
      let scoring = null;
      try {
        scoring = row[10] ? JSON.parse(row[10]) : null;
      } catch {}

      return {
        rowNum: i + 2,
        question: row[2] || '',
        marks: row[3] || '',
        answer: row[4] || '',
        rewriting: row[7] || '',
        prompts: row[8] || '',
        identity: row[9] || '',
        scoring,
        paper: row[12] || '',
        qnum: row[13] || '',
      };
    }).filter(q => q.question);

    return NextResponse.json({ questions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}