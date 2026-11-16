import {
  DOXTER_QUESTION_COUNT,
  DOXTER_SECONDS_PER_QUESTION,
  INITIAL_STUDENTS,
  QUIZ_PACKS,
  type DoxterRoomState,
  type QuizQuestion,
  type StudentRecord,
} from '../data/schoolData';

const LOCAL_ATT_KEY = 'aloqa_local_attendance_v1';

export function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getLocalAttendance(): StudentRecord[] {
  const fresh = INITIAL_STUDENTS.map((s) => ({
    ...s,
    present: false,
    time: null,
    photos: [],
  }));
  try {
    const raw = localStorage.getItem(LOCAL_ATT_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as { day?: string; students?: StudentRecord[] };
    if (parsed.day === getTodayKey() && Array.isArray(parsed.students)) {
      return parsed.students;
    }
  } catch {
    // ignore
  }
  return fresh;
}

function saveLocalAttendance(students: StudentRecord[]) {
  try {
    localStorage.setItem(
      LOCAL_ATT_KEY,
      JSON.stringify({ day: getTodayKey(), students }),
    );
  } catch {
    // ignore
  }
}

export function localCheckinStudent(studentId: number, photos: string[]): StudentRecord[] {
  const list = getLocalAttendance().map((s) =>
    s.id === studentId
      ? { ...s, present: true, time: formatHHMM(new Date()), photos: photos.slice(0, 3) }
      : s,
  );
  saveLocalAttendance(list);
  return list;
}

export function localToggleStudent(studentId: number): StudentRecord[] {
  const list = getLocalAttendance().map((s) => {
    if (s.id !== studentId) return s;
    const nextPresent = !s.present;
    return {
      ...s,
      present: nextPresent,
      time: nextPresent ? formatHHMM(new Date()) : null,
      photos: nextPresent ? s.photos : [],
    };
  });
  saveLocalAttendance(list);
  return list;
}

// Local BroadcastChannel fallback ONLY when opened directly via file://
interface LocalDoxterRoom {
  code: string;
  topicTitle: string;
  questions: QuizQuestion[];
  phase: DoxterRoomState['phase'];
  questionIndex: number;
  questionEndsAt: number | null;
  autoNextAt: number | null;
  players: Array<{
    id: string;
    name: string;
    score: number;
    answers: Record<number, { optionIndex: number; pointsEarned: number; correct: boolean }>;
  }>;
}

const LOCAL_DOXTER_PREFIX = 'aloqa_doxter_room_';

export class LocalDoxterBridge {
  private channel: BroadcastChannel | null = null;
  private role: 'teacher' | 'student' = 'teacher';
  private clientId = Math.random().toString(36).slice(2, 10);
  private code = '';
  private qTimer: ReturnType<typeof setTimeout> | null = null;
  private nTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessage: (msg: { type: string; state?: DoxterRoomState; role?: string; code?: string; clientId?: string; message?: string }) => void;

  constructor(
    onMessage: (msg: { type: string; state?: DoxterRoomState; role?: string; code?: string; clientId?: string; message?: string }) => void,
  ) {
    this.onMessage = onMessage;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('aloqa_doxter_local_v1');
      this.channel.onmessage = (ev) => {
        const data = ev.data as { type?: string; code?: string; player?: { id: string; name: string }; optionIndex?: number; playerId?: string };
        if (!data || data.code !== this.code) return;
        if (this.role === 'teacher') {
          this.handleHostIncoming(data);
        } else if (data.type === 'room_sync') {
          this.emitLatestState();
        }
      };
    }
  }

  private loadRoom(): LocalDoxterRoom | null {
    try {
      const raw = localStorage.getItem(LOCAL_DOXTER_PREFIX + this.code);
      return raw ? (JSON.parse(raw) as LocalDoxterRoom) : null;
    } catch {
      return null;
    }
  }

  private saveRoom(room: LocalDoxterRoom) {
    try {
      localStorage.setItem(LOCAL_DOXTER_PREFIX + this.code, JSON.stringify(room));
    } catch {
      // ignore
    }
    this.channel?.postMessage({ type: 'room_sync', code: this.code });
    this.emitLatestState(room);
  }

  private handleHostIncoming(data: { type?: string; player?: { id: string; name: string }; optionIndex?: number; playerId?: string }) {
    const room = this.loadRoom();
    if (!room) return;
    if (data.type === 'player_join' && data.player) {
      if (!room.players.some((p) => p.id === data.player!.id)) {
        room.players.push({ ...data.player, score: 0, answers: {} });
        this.saveRoom(room);
      }
    } else if (data.type === 'player_answer' && data.playerId !== undefined && typeof data.optionIndex === 'number') {
      if (room.phase !== 'question') return;
      const p = room.players.find((pl) => pl.id === data.playerId);
      if (!p || p.answers[room.questionIndex]) return;
      const q = room.questions[room.questionIndex];
      const correct = q.correctIndex === data.optionIndex;
      const rem = Math.max(0, (room.questionEndsAt ?? Date.now()) - Date.now());
      const pts = correct ? 500 + Math.round((rem / (DOXTER_SECONDS_PER_QUESTION * 1000)) * 500) : 0;
      p.answers[room.questionIndex] = { optionIndex: data.optionIndex, pointsEarned: pts, correct };
      p.score += pts;
      this.saveRoom(room);
    }
  }

  private emitLatestState(existingRoom?: LocalDoxterRoom | null) {
    const room = existingRoom ?? this.loadRoom();
    if (!room) return;
    const q = room.questions[room.questionIndex] ?? null;
    const reveal = room.phase === 'question_result' || room.phase === 'finished';
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let answeredCount = 0;

    const players = room.players
      .map((p) => {
        const ans = p.answers[room.questionIndex];
        if (ans) {
          answeredCount++;
          if (ans.optionIndex >= 0 && ans.optionIndex < 4) counts[ans.optionIndex]++;
        }
        return {
          id: p.id,
          name: p.name,
          score: p.score,
          answeredCurrent: Boolean(ans),
          lastCorrect: reveal ? Boolean(ans?.correct) : null,
          lastPointsEarned: reveal ? (ans?.pointsEarned ?? 0) : 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    const self = this.role === 'student' ? room.players.find((p) => p.id === this.clientId) : undefined;
    const selfAns = self?.answers[room.questionIndex];

    const state: DoxterRoomState = {
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
              ...(reveal ? { correctIndex: q.correctIndex } : {}),
            }
          : null,
      players,
      answeredCount,
      optionCounts: reveal ? counts : null,
      yourRole: this.role,
      yourPlayerId: this.role === 'student' ? this.clientId : null,
      yourSelectedOption: selfAns ? selfAns.optionIndex : null,
    };

    this.onMessage({ type: 'room_state', state });
  }

  private startQuestion(index: number) {
    if (this.qTimer) clearTimeout(this.qTimer);
    if (this.nTimer) clearTimeout(this.nTimer);
    const room = this.loadRoom();
    if (!room) return;
    room.phase = 'question';
    room.questionIndex = index;
    room.questionEndsAt = Date.now() + DOXTER_SECONDS_PER_QUESTION * 1000;
    room.autoNextAt = null;
    this.saveRoom(room);

    this.qTimer = setTimeout(() => this.finishQuestion(), DOXTER_SECONDS_PER_QUESTION * 1000);
  }

  private finishQuestion() {
    if (this.qTimer) clearTimeout(this.qTimer);
    if (this.nTimer) clearTimeout(this.nTimer);
    const room = this.loadRoom();
    if (!room || room.phase !== 'question') return;
    room.phase = 'question_result';
    room.questionEndsAt = null;
    room.autoNextAt = Date.now() + 6000;
    this.saveRoom(room);

    const isLast = room.questionIndex >= room.questions.length - 1;
    this.nTimer = setTimeout(() => {
      const r = this.loadRoom();
      if (!r) return;
      if (isLast) {
        r.phase = 'finished';
        r.autoNextAt = null;
        this.saveRoom(r);
      } else {
        this.startQuestion(r.questionIndex + 1);
      }
    }, 6000);
  }

  send(payload: Record<string, unknown>) {
    const type = payload.type;
    if (type === 'create_room') {
      this.role = 'teacher';
      this.code = String(Math.floor(100000 + Math.random() * 900000));
      const pack = QUIZ_PACKS.find((p) => p.id === payload.topicId) ?? QUIZ_PACKS[0];
      const questions = Array.isArray(payload.customQuestions) && payload.customQuestions.length === DOXTER_QUESTION_COUNT
        ? (payload.customQuestions as QuizQuestion[])
        : pack.questions.slice(0, DOXTER_QUESTION_COUNT);
      const room: LocalDoxterRoom = {
        code: this.code,
        topicTitle: typeof payload.customTitle === 'string' && payload.customTitle.trim() ? payload.customTitle.trim() : pack.title,
        questions,
        phase: 'lobby',
        questionIndex: 0,
        questionEndsAt: null,
        autoNextAt: null,
        players: [],
      };
      this.onMessage({ type: 'joined', role: 'teacher', code: this.code, clientId: this.clientId });
      this.saveRoom(room);
    } else if (type === 'join_room') {
      const code = String(payload.code ?? '').trim();
      const name = String(payload.name ?? '').trim();
      this.code = code;
      const room = this.loadRoom();
      if (!room) {
        this.onMessage({ type: 'error', message: `${code} kodli DOXTER o‘yini topilmadi` });
        return;
      }
      this.role = 'student';
      this.onMessage({ type: 'joined', role: 'student', code, clientId: this.clientId });
      this.channel?.postMessage({ type: 'player_join', code, player: { id: this.clientId, name } });
      if (!room.players.some((p) => p.id === this.clientId)) {
        room.players.push({ id: this.clientId, name, score: 0, answers: {} });
        this.saveRoom(room);
      } else {
        this.emitLatestState(room);
      }
    } else if (type === 'start_game' && this.role === 'teacher') {
      this.startQuestion(0);
    } else if (type === 'next_question' && this.role === 'teacher') {
      const room = this.loadRoom();
      if (!room) return;
      if (room.phase === 'question') {
        this.finishQuestion();
      } else if (room.phase === 'question_result') {
        if (this.nTimer) clearTimeout(this.nTimer);
        if (room.questionIndex >= room.questions.length - 1) {
          room.phase = 'finished';
          room.autoNextAt = null;
          this.saveRoom(room);
        } else {
          this.startQuestion(room.questionIndex + 1);
        }
      }
    } else if (type === 'submit_answer' && this.role === 'student') {
      const optionIndex = Number(payload.optionIndex);
      this.channel?.postMessage({
        type: 'player_answer',
        code: this.code,
        playerId: this.clientId,
        optionIndex,
      });
      // Also update locally if single-tab
      const room = this.loadRoom();
      if (room && room.phase === 'question') {
        const p = room.players.find((pl) => pl.id === this.clientId);
        if (p && !p.answers[room.questionIndex]) {
          const q = room.questions[room.questionIndex];
          const correct = q.correctIndex === optionIndex;
          const rem = Math.max(0, (room.questionEndsAt ?? Date.now()) - Date.now());
          const pts = correct ? 500 + Math.round((rem / (DOXTER_SECONDS_PER_QUESTION * 1000)) * 500) : 0;
          p.answers[room.questionIndex] = { optionIndex, pointsEarned: pts, correct };
          p.score += pts;
          this.saveRoom(room);
        }
      }
    }
  }

  close() {
    if (this.qTimer) clearTimeout(this.qTimer);
    if (this.nTimer) clearTimeout(this.nTimer);
    this.channel?.close();
    this.channel = null;
  }
}
