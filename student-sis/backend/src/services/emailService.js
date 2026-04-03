const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'SIS <noreply@school.edu>';
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

async function sendMail(to, subject, html) {
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Email send error:', err);
    throw err;
  }
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3f4f6; margin:0; padding:20px; }
  .card { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .logo { font-size:24px; font-weight:700; color:#1d4ed8; margin-bottom:32px; }
  .btn { display:inline-block; background:#1d4ed8; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; margin:20px 0; }
  .footer { margin-top:32px; color:#6b7280; font-size:12px; border-top:1px solid #e5e7eb; padding-top:16px; }
</style></head>
<body><div class="card">
  <div class="logo">🎓 Student Information System</div>
  ${content}
  <div class="footer">This email was sent by your school's SIS platform. Do not reply to this email.</div>
</div></body></html>`;
}

async function sendVerificationEmail(to, token) {
  const link = `${FRONTEND}/auth/verify-email?token=${token}`;
  await sendMail(to, 'Verify Your Email Address', baseTemplate(`
    <h2 style="margin:0 0 16px">Verify Your Email</h2>
    <p>Click the button below to verify your email address and activate your account.</p>
    <a href="${link}" class="btn">Verify Email</a>
    <p style="color:#6b7280;font-size:14px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
  `));
}

async function sendInviteEmail(to, role, inviterName, token, schoolName) {
  const link = `${FRONTEND}/auth/invite/${token}`;
  const roleLabel = { TEACHER: 'Teacher', PARENT: 'Parent', SCHOOL_ADMIN: 'Administrator' }[role] || role;
  await sendMail(to, `You're invited to join ${schoolName}`, baseTemplate(`
    <h2 style="margin:0 0 16px">You've been invited!</h2>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${schoolName}</strong> as a <strong>${roleLabel}</strong>.</p>
    <p>Click the button below to create your account and get started.</p>
    <a href="${link}" class="btn">Accept Invitation</a>
    <p style="color:#6b7280;font-size:14px">This invitation expires in 7 days. If you have any questions, contact your school administrator.</p>
  `));
}

async function sendPasswordResetEmail(to, token) {
  const link = `${FRONTEND}/auth/reset-password?token=${token}`;
  await sendMail(to, 'Reset Your Password', baseTemplate(`
    <h2 style="margin:0 0 16px">Reset Your Password</h2>
    <p>We received a request to reset your password. Click the button below to proceed.</p>
    <a href="${link}" class="btn">Reset Password</a>
    <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
  `));
}

async function sendAttendanceAlert(to, studentName, date, status, className) {
  const statusLabels = { ABSENT: 'absent', LATE: 'late', EXCUSED: 'excused' };
  await sendMail(to, `Attendance Alert: ${studentName}`, baseTemplate(`
    <h2 style="margin:0 0 16px">Attendance Alert</h2>
    <p>This is an automated notice that <strong>${studentName}</strong> was marked
    <strong>${statusLabels[status] || status}</strong> from <strong>${className}</strong> on ${date}.</p>
    <p>Log in to the Parent Portal to view details or contact the school.</p>
    <a href="${FRONTEND}/dashboard/parent" class="btn">View Parent Portal</a>
  `));
}

module.exports = {
  sendVerificationEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
  sendAttendanceAlert,
};
