import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_STUDENTS,
  QUIZ_PACKS,
  DOXTER_QUESTION_COUNT,
  DOXTER_SECONDS_PER_QUESTION,
  type StudentRecord,
  type QuizQuestion,
  type DoxterPhase,
  type DoxterRoomState,
} from './src/data/schoolData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = '1979';

// ── Shared Attendance Store (in-memory for today) ─────────────────────────────
let attendanceDayKey = getTodayKey();
let attendanceStudents: StudentRecord[] = createFreshAttendance();

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function createFreshAttendance(): StudentRecord[] {
  return INITIAL_STUDENTS.map((s) => ({
    ...s,
    present: false,
    time: null,
    photos: [],
  }));
}

function ensureSameDayAttendance() {
  const today = getTodayKey();
  if (attendanceDayKey !== today) {
    attendanceDayKey = today;
    attendanceStudents = createFreshAttendance();
  }
}

function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ── DOXTER Real-Time Multiplayer Rooms ────────────────────────────────────────
interface InternalPlayer {
  id: string;
  name: string;
  score: number;
  answers: Record<number, { optionIndex: number; pointsEarned: number; correct: boolean }>;
  ws: WebSocket | null;
}

interface InternalRoom {
  code: string;
  topicTitle: string;
  questions: QuizQuestion[];
  hostId: string;
  hostWs: WebSocket | null;
  phase: DoxterPhase;
  questionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  autoNextAt: number | null;
  players: Map<string, InternalPlayer>;
  questionTimer: ReturnType<typeof setTimeout> | null;
  autoNextTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, InternalRoom>();

function generateSixDigitCode(): string {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function buildStateForRecipient(
  room: InternalRoom,
  role: 'teacher' | 'student',
  playerId: string | null,
): DoxterRoomState {
  const q = room.questions[room.questionIndex] ?? null;
  const revealAnswer = room.phase === 'question_result' || room.phase === 'finished';

  let answeredCount = 0;
  const counts: [number, number, number, number] = [0, 0, 0, 0];

  const playersList = Array.from(room.players.values())
    .map((p) => {
      const ans = p.answers[room.questionIndex];
      if (ans) {
        answeredCount++;
        if (ans.optionIndex >= 0 && ans.optionIndex < 4) {
          counts[ans.optionIndex]++;
        }
      }
      return {
        id: p.id,
        name: p.name,
        score: p.score,
        answeredCurrent: Boolean(ans),
        lastCorrect: revealAnswer ? Boolean(ans?.correct) : null,
        lastPointsEarned: revealAnswer ? (ans?.pointsEarned ?? 0) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selfPlayer = playerId ? room.players.get(playerId) : undefined;
  const selfAnswer = selfPlayer?.answers[room.questionIndex];

  return {
    code: room.code,
    topicTitle: room.topicTitle,
    phase: room.phase,
    questionIndex: room.questionIndex,
    totalQuestions: room.questions.length,
    questionEndsAt: room.questionEndsAt,
    autoNextAt: room.autoNextAt,
    secondsPerQuestion: DOXTER_SECONDS_PER_QUESTION,
    currentQuestion:
      q && room.phase !== 'lobby'
        ? {
            question: q.question,
            options: q.options,
            ...(revealAnswer ? { correctIndex: q.correctIndex } : {}),
          }
        : null,
    players: playersList,
    answeredCount,
    optionCounts: revealAnswer ? counts : null,
    yourRole: role,
    yourPlayerId: playerId,
    yourSelectedOption: selfAnswer ? selfAnswer.optionIndex : null,
  };
}

function safeSend(ws: WebSocket | null, payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomState(room: InternalRoom) {
  safeSend(room.hostWs, {
    type: 'room_state',
    state: buildStateForRecipient(room, 'teacher', null),
  });
  for (const player of room.players.values()) {
    safeSend(player.ws, {
      type: 'room_state',
      state: buildStateForRecipient(room, 'student', player.id),
    });
  }
}

function clearRoomTimers(room: InternalRoom) {
  if (room.questionTimer) {
    clearTimeout(room.questionTimer);
    room.questionTimer = null;
  }
  if (room.autoNextTimer) {
    clearTimeout(room.autoNextTimer);
    room.autoNextTimer = null;
  }
}

function startQuestion(room: InternalRoom, index: number) {
  clearRoomTimers(room);
  room.phase = 'question';
  room.questionIndex = index;
  room.questionStartedAt = Date.now();
  room.questionEndsAt = room.questionStartedAt + DOXTER_SECONDS_PER_QUESTION * 1000;
  room.autoNextAt = null;

  broadcastRoomState(room);

  // Strictly ends after 20 seconds
  room.questionTimer = setTimeout(() => {
    finishCurrentQuestion(room);
  }, DOXTER_SECONDS_PER_QUESTION * 1000);
}

function finishCurrentQuestion(room: InternalRoom) {
  if (room.phase !== 'question') return;
  clearRoomTimers(room);
  room.phase = 'question_result';
  room.questionEndsAt = null;

  const isLast = room.questionIndex >= room.questions.length - 1;
  const AUTO_ADVANCE_MS = 6000;
  room.autoNextAt = Date.now() + AUTO_ADVANCE_MS;

  broadcastRoomState(room);

  room.autoNextTimer = setTimeout(() => {
    if (isLast) {
      room.phase = 'finished';
      room.autoNextAt = null;
      broadcastRoomState(room);
    } else {
      startQuestion(room, room.questionIndex + 1);
    }
  }, AUTO_ADVANCE_MS);
}

function advanceRoomNow(room: InternalRoom) {
  if (room.phase === 'question') {
    finishCurrentQuestion(room);
    return;
  }
  if (room.phase === 'question_result') {
    clearRoomTimers(room);
    room.autoNextAt = null;
    if (room.questionIndex >= room.questions.length - 1) {
      room.phase = 'finished';
      broadcastRoomState(room);
    } else {
      startQuestion(room, room.questionIndex + 1);
    }
  }
}

// ── Server Bootstrap ──────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Attendance REST API
  app.get('/api/attendance', (_req, res) => {
    ensureSameDayAttendance();
    res.json({
      day: attendanceDayKey,
      students: attendanceStudents,
    });
  });

  app.post('/api/attendance/checkin', (req, res) => {
    ensureSameDayAttendance();
    const { studentId, photos } = req.body as { studentId?: number; photos?: string[] };
    const target = attendanceStudents.find((s) => s.id === studentId);
    if (!target) {
      res.status(404).json({ error: 'O‘quvchi topilmadi' });
      return;
    }
    target.present = true;
    target.time = formatHHMM(new Date());
    if (Array.isArray(photos) && photos.length > 0) {
      target.photos = photos.slice(0, 3);
    }
    res.json({ ok: true, student: target, students: attendanceStudents });
  });

  app.post('/api/attendance/toggle', (req, res) => {
    ensureSameDayAttendance();
    const { studentId, password } = req.body as { studentId?: number; password?: string };
    if (password !== ADMIN_PASSWORD) {
      res.status(403).json({ error: 'Admin paroli noto‘g‘ri' });
      return;
    }
    const target = attendanceStudents.find((s) => s.id === studentId);
    if (!target) {
      res.status(404).json({ error: 'O‘quvchi topilmadi' });
      return;
    }
    target.present = !target.present;
    target.time = target.present ? formatHHMM(new Date()) : null;
    if (!target.present) target.photos = [];
    res.json({ ok: true, student: target, students: attendanceStudents });
  });

  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body as { password?: string };
    if (password === ADMIN_PASSWORD) {
      res.json({ ok: true });
    } else {
      res.status(403).json({ ok: false, error: 'Parol noto‘g‘ri' });
    }
  });

  app.get('/download/aloqa-sayt.html', (_req, res) => {
    const filePath = path.resolve(__dirname, 'public', 'aloqa_sayt.html');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'aloqa-sayt.html');
    } else {
      res.status(404).send('Fayl topilmadi');
    }
  });

  // Vite or Static Assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let boundRoomCode: string | null = null;
    let boundRole: 'teacher' | 'student' | null = null;
    let boundClientId: string | null = null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        safeSend(ws, { type: 'error', message: 'Noto‘g‘ri xabar formati' });
        return;
      }

      const type = msg.type;

      if (type === 'create_room') {
        const topicId = typeof msg.topicId === 'string' ? msg.topicId : 'general';
        const pack = QUIZ_PACKS.find((p) => p.id === topicId) ?? QUIZ_PACKS[0];
        let questions = pack.questions.slice(0, DOXTER_QUESTION_COUNT);
        let topicTitle = pack.title;

        if (Array.isArray(msg.customQuestions) && msg.customQuestions.length === DOXTER_QUESTION_COUNT) {
          questions = msg.customQuestions as QuizQuestion[];
          if (typeof msg.customTitle === 'string' && msg.customTitle.trim()) {
            topicTitle = msg.customTitle.trim();
          }
        }

        const code = generateSixDigitCode();
        const hostId = makeId();

        const room: InternalRoom = {
          code,
          topicTitle,
          questions,
          hostId,
          hostWs: ws,
          phase: 'lobby',
          questionIndex: 0,
          questionStartedAt: null,
          questionEndsAt: null,
          autoNextAt: null,
          players: new Map(),
          questionTimer: null,
          autoNextTimer: null,
        };

        rooms.set(code, room);
        boundRoomCode = code;
        boundRole = 'teacher';
        boundClientId = hostId;

        safeSend(ws, { type: 'joined', role: 'teacher', code, clientId: hostId });
        broadcastRoomState(room);
        return;
      }

      if (type === 'join_room') {
        const code = typeof msg.code === 'string' ? msg.code.trim() : '';
        const name = typeof msg.name === 'string' ? msg.name.trim() : '';

        if (!/^\d{6}$/.test(code)) {
          safeSend(ws, { type: 'error', message: '6 xonali kodni to‘g‘ri kiriting' });
          return;
        }
        if (!name || name.length < 2) {
          safeSend(ws, { type: 'error', message: 'Ismingizni kiriting (kamida 2 ta harf)' });
          return;
        }

        const room = rooms.get(code);
        if (!room) {
          safeSend(ws, { type: 'error', message: `${code} kodli DOXTER o‘yini topilmadi` });
          return;
        }
        if (room.phase === 'finished') {
          safeSend(ws, { type: 'error', message: 'Bu o‘yin allaqachon yakunlangan' });
          return;
        }

        const playerId = makeId();
        const player: InternalPlayer = {
          id: playerId,
          name: name.slice(0, 28),
          score: 0,
          answers: {},
          ws,
        };

        room.players.set(playerId, player);
        boundRoomCode = code;
        boundRole = 'student';
        boundClientId = playerId;

        safeSend(ws, { type: 'joined', role: 'student', code, clientId: playerId });
        broadcastRoomState(room);
        return;
      }

      if (type === 'rejoin_room') {
        const code = typeof msg.code === 'string' ? msg.code.trim() : '';
        const clientId = typeof msg.clientId === 'string' ? msg.clientId : '';
        const room = rooms.get(code);
        if (!room) {
          safeSend(ws, { type: 'error', message: 'O‘yin sessiyasi topilmadi' });
          return;
        }
        if (room.hostId === clientId) {
          room.hostWs = ws;
          boundRoomCode = code;
          boundRole = 'teacher';
          boundClientId = clientId;
          safeSend(ws, { type: 'joined', role: 'teacher', code, clientId });
          broadcastRoomState(room);
          return;
        }
        const player = room.players.get(clientId);
        if (player) {
          player.ws = ws;
          boundRoomCode = code;
          boundRole = 'student';
          boundClientId = clientId;
          safeSend(ws, { type: 'joined', role: 'student', code, clientId });
          broadcastRoomState(room);
          return;
        }
        safeSend(ws, { type: 'error', message: 'Sessiya muddati tugagan' });
        return;
      }

      if (type === 'start_game') {
        if (!boundRoomCode || boundRole !== 'teacher') {
          safeSend(ws, { type: 'error', message: 'Faqat ustoz o‘yinni boshlay oladi' });
          return;
        }
        const room = rooms.get(boundRoomCode);
        if (!room || room.phase !== 'lobby') return;
        startQuestion(room, 0);
        return;
      }

      if (type === 'next_question') {
        if (!boundRoomCode || boundRole !== 'teacher') {
          safeSend(ws, { type: 'error', message: 'Faqat ustoz keyingi savolga o‘tkaza oladi' });
          return;
        }
        const room = rooms.get(boundRoomCode);
        if (!room) return;
        advanceRoomNow(room);
        return;
      }

      if (type === 'submit_answer') {
        // Teacher CANNOT select answers
        if (boundRole === 'teacher') {
          safeSend(ws, { type: 'error', message: 'Ustoz javob tanlay olmaydi!' });
          return;
        }
        if (!boundRoomCode || boundRole !== 'student' || !boundClientId) return;
        const room = rooms.get(boundRoomCode);
        if (!room || room.phase !== 'question') return;

        const player = room.players.get(boundClientId);
        if (!player) return;
        if (player.answers[room.questionIndex]) return; // already answered

        const optionIndex = Number(msg.optionIndex);
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) return;

        const q = room.questions[room.questionIndex];
        const correct = q.correctIndex === optionIndex;
        const remainingMs = Math.max(0, (room.questionEndsAt ?? Date.now()) - Date.now());
        const speedBonus = Math.round((remainingMs / (DOXTER_SECONDS_PER_QUESTION * 1000)) * 500);
        const pointsEarned = correct ? 500 + speedBonus : 0;

        player.answers[room.questionIndex] = {
          optionIndex,
          pointsEarned,
          correct,
        };
        player.score += pointsEarned;

        broadcastRoomState(room);
      }
    });

    ws.on('close', () => {
      if (!boundRoomCode || !boundClientId) return;
      const room = rooms.get(boundRoomCode);
      if (!room) return;
      if (boundRole === 'teacher' && room.hostWs === ws) {
        room.hostWs = null;
      } else if (boundRole === 'student') {
        const player = room.players.get(boundClientId);
        if (player && player.ws === ws) {
          player.ws = null;
        }
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aloqa + DOXTER server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
