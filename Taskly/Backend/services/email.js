import nodemailer from 'nodemailer';

let transporter;

export const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️  Nie skonfigurowano SMTP - powiadomienia e-mail będą pomijane.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    return false;
  }

  const { EMAIL_FROM = 'Taskly <no-reply@taskly.app>' } = process.env;

  await mailer.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html
  });
  return true;
};

export const buildReminderHtml = ({ username, tasks }) => {
  const items = tasks
    .map(
      (task) => `
        <li style="margin-bottom:12px;background:#1e1e24;padding:16px;border-radius:12px;">
          <strong style="color:#f1f5f9;">${task.title}</strong><br />
          <span style="color:#cbd5f5;">Termin: ${new Date(task.due_date).toLocaleString('pl-PL')}</span>
        </li>
      `
    )
    .join('');

  return `
    <div style="background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',sans-serif;padding:24px;">
      <h1 style="color:#38bdf8;">Cześć ${username || ''}!</h1>
      <p>Oto zadania, których termin zbliża się w ciągu najbliższych 24 godzin:</p>
      <ul style="list-style:none;padding:0;">${items}</ul>
      <p style="margin-top:16px;">Powodzenia!<br />Zespół Taskly</p>
    </div>
  `;
};
