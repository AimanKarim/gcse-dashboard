import { google } from 'googleapis';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function POST(req: Request) {
  try {
    const { rowNum } = await req.json();
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read current scoring data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GSHEET_ID,
      range: `Sheet1!K${rowNum}`,
    });

    const currentVal = res.data.values?.[0]?.[0] || '{}';
    let scoring: Record<string, unknown> = {};
    try { scoring = JSON.parse(currentVal); } catch {}

    scoring.status = 'approved';
    scoring.overall_pass = true;
    scoring.approved_at = new Date().toISOString();

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GSHEET_ID,
      range: `Sheet1!K${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[JSON.stringify(scoring)]] },
    });

} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}