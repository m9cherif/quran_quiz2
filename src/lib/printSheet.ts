/**
 * Printable quiz sheet + answer key.
 *
 * Opens a clean document in a new window and calls print(): no print-only CSS
 * has to be threaded through the app shell, and the teacher gets a paper
 * fallback for when the room's wifi gives up.
 */
interface PrintQuestion {
  position?: number;
  text: string;
  type: string;
  points?: number | null;
  duration_seconds?: number | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
  page_number?: number | null;
  hint?: string | null;
  choices?: Array<{ text: string; isCorrect?: boolean; is_correct?: boolean }>;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export function printQuizSheet(
  quiz: { name?: string; description?: string | null; language?: string; code?: string },
  questions: PrintQuestion[],
  labels: {
    answerKey: string;
    question: string;
    points: string;
    seconds: string;
    hint: string;
    noAnswer: string;
    printedFrom: string;
  }
): void {
  const rtl = quiz.language === "ar";
  const isCorrect = (c: { isCorrect?: boolean; is_correct?: boolean }) =>
    Boolean(c.isCorrect ?? c.is_correct);

  const body = questions
    .map((q, i) => {
      const n = q.position ?? i + 1;
      const choices = (q.choices ?? []).filter((c) => String(c.text ?? "").trim());
      const options = choices.length
        ? `<ol class="opts" type="A">${choices
            .map((c) => `<li>${escapeHtml(c.text)}</li>`)
            .join("")}</ol>`
        : `<div class="blank"></div>`;
      const meta = [
        q.points != null ? `${q.points} ${escapeHtml(labels.points)}` : null,
        q.duration_seconds != null ? `${q.duration_seconds}${escapeHtml(labels.seconds)}` : null,
        q.page_number != null ? `p.${q.page_number}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const hint = q.hint ? `<p class="hint">${escapeHtml(labels.hint)}: ${escapeHtml(q.hint)}</p>` : "";
      return `<li class="q"><div class="qhead"><span class="qno">${n}.</span><span class="qtext">${escapeHtml(
        q.text
      )}</span></div><div class="meta">${escapeHtml(meta)}</div>${hint}${options}</li>`;
    })
    .join("");

  const key = questions
    .map((q, i) => {
      const n = q.position ?? i + 1;
      const correct = (q.choices ?? []).find(isCorrect)?.text ?? q.correct_answer_text;
      const explanation = q.explanation
        ? `<span class="exp"> — ${escapeHtml(q.explanation)}</span>`
        : "";
      return `<li><b>${n}.</b> ${escapeHtml(correct || labels.noAnswer)}${explanation}</li>`;
    })
    .join("");

  const html = `<!doctype html><html lang="${escapeHtml(quiz.language ?? "en")}" dir="${rtl ? "rtl" : "ltr"}"><head>
<meta charset="utf-8"><title>${escapeHtml(quiz.name ?? "Quiz")}</title><style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;margin:32px;color:#0f172a;line-height:1.6}
h1{font-size:22px;margin:0 0 4px}
.sub{color:#64748b;font-size:13px;margin:0 0 22px}
ol.qs{list-style:none;padding:0;margin:0}
li.q{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;break-inside:avoid}
.qhead{display:flex;gap:8px;align-items:flex-start}
.qno{font-weight:700;color:#4f46e5}
.qtext{font-size:16px;font-weight:600}
.meta{color:#94a3b8;font-size:11px;margin:4px 0 0}
.hint{color:#b45309;font-size:12px;margin:6px 0 0}
ol.opts{margin:10px 0 0;padding-inline-start:22px}
ol.opts li{margin:4px 0}
.blank{border-bottom:1px dashed #cbd5e1;height:26px;margin-top:12px}
.key{margin-top:28px;padding-top:14px;border-top:2px solid #0f172a;break-before:page}
.key h2{font-size:16px;margin:0 0 8px}
.key ol{list-style:none;padding:0;margin:0;columns:2;font-size:13px}
.key li{margin:3px 0;break-inside:avoid}
.exp{color:#64748b}
footer{margin-top:24px;color:#94a3b8;font-size:11px}
@media print{body{margin:14mm}}
</style></head><body>
<h1>${escapeHtml(quiz.name ?? "Quiz")}</h1>
<p class="sub">${escapeHtml(quiz.description ?? "")}${quiz.code ? ` · ${escapeHtml(quiz.code)}` : ""}</p>
<ol class="qs">${body}</ol>
<section class="key"><h2>${escapeHtml(labels.answerKey)}</h2><ol>${key}</ol></section>
<footer>${escapeHtml(labels.printedFrom)}</footer>
</body></html>`;

  const win = window.open("", "_blank", "noopener,width=900,height=1000");
  if (!win) return; // popup blocked — caller surfaces the toast
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the document a tick to lay out before the print dialog opens.
  setTimeout(() => win.print(), 350);
}
