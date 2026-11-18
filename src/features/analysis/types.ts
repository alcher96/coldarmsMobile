/** Ответы спортсмена — только из фиксированных списков (никакого свободного текста в модель). */
export type Side = 'left' | 'right';
export type Result = 'loss' | 'win';
export type Technique =
  | 'hook' | 'high_hook' | 'top_roll' | 'open_top_roll' | 'press' | 'flop_press' | 'side_press'
  | 'kings_move' | 'post' | 'hit' | 'none' | 'other';
export type Wrist = 'mine' | 'held_opp' | 'lost' | 'neutral';
export type YesNo = 'yes' | 'no';
/** кто контролировал центр стола большую часть поединка (спрашиваем, только если вывод разбора держится на центре) */
export type Center = 'opp' | 'me' | 'none';
/** рука перед схваткой (эксперт, 2026-11-17) — для правил усталости Т11–Т16 */
export type Fatigue = 'fresh' | 'moderate' | 'tired';

/** kingsMe / kingsOpp — условные вопросы про кингсмув: только если их задал сервер (по позам долго очень открыт угол) */
export type Answers = {
  side?: Side;
  result?: Result;
  technique?: Technique;
  wrist?: Wrist;
  kingsMe?: YesNo;
  kingsOpp?: YesNo;
  center?: Center;
  fatigue?: Fatigue;
  /** «Продолжить к разбору» после оценки видео; auto — видео в очереди вне окна разбора: спросим, только если оценка плохая */
  go?: 'yes' | 'auto' | 'other';
  /** доп. настройки: спортсмен отметил точками себя и соперника на трёх кадрах */
  points?: 'yes';
};
export type KingsQuestion = 'kingsMe' | 'kingsOpp';

export type Claim = { text: string; aspect: string };
export type Tactic = { id: string; situation: string; move: string };
export type AnalysisResult = {
  id: string;
  status: 'done';
  demo: boolean;
  answers: Answers;
  /** какие вопросы про кингсмув задать после вопроса про кисть (пусто — не спрашивать) */
  kingsQuestions: KingsQuestion[];
  badges: string[];
  summary: string;
  mainReason: Claim[];
  secondary: Claim[];
  training: Claim[];
  tactics: Tactic[];
  videoUrl: string;
  /** вступление со слоу-мо для экрана MIRA (annotator/make_intro.py); нет — играем само видео */
  introUrl: string | null;
  /** ширина / высота кадра (< 1 — вертикальное видео) */
  videoRatio: number | null;
  /** качество своего видео (оценка и что мешало); у демо — нет */
  quality?: Quality | null;
};

export type DemoItem = { id: string; badges: string[]; headline: string; kingsQuestions: KingsQuestion[] };

/** Качество видео: 5 минус балл за каждую помеху (annotator/research/video_quality.py); spans — отрезки, с. */
export type QualityIssue = { text: string; spans: [number, number][] };
export type Quality = { score: number; issues: Record<string, QualityIssue> };
