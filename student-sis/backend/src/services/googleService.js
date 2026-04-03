const { google } = require('googleapis');
const prisma = require('../config/database');
const { logger } = require('../utils/logger');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    ],
    state,
    prompt: 'consent',
  });
}

async function exchangeCode(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getUserInfo(tokens) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

async function getClassroomCourses(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  if (!user?.googleAccessToken) {
    throw new Error('Google not connected');
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  // Auto-refresh token
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.user.update({
        where: { id: userId },
        data: { googleAccessToken: tokens.access_token },
      });
    }
  });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
  const { data } = await classroom.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] });
  return data.courses || [];
}

async function syncClassroomRoster(userId, courseId, classId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
  const { data } = await classroom.courses.students.list({ courseId });

  logger.info(`Synced ${data.students?.length || 0} students from Google Classroom course ${courseId}`);
  return data.students || [];
}

module.exports = { getAuthUrl, exchangeCode, getUserInfo, getClassroomCourses, syncClassroomRoster };
