import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  OPTION_LETTERS,
  formatDurationPersian,
  getDifficultyLabel,
  getGradeLabel,
  getSubjectById,
  toPersianDigits,
} from '../data/curriculum';
import { parseStructuredQuestion, renderExamTextToHtml } from './mathText';
import type { ExamConfig, ExamHistoryEntry, GeneratedExam } from '../types/exam';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function downloadExamAsPdf(params: {
  exam: GeneratedExam | null;
  config: ExamConfig;
  result: ExamHistoryEntry | null;
}): Promise<void> {
  const { exam, config, result } = params;
  if (!exam && !result) return;

  const subject = getSubjectById(result ? result.config.subjectId : config.subjectId);
  const grade = result ? result.config.grade : config.grade;
  const difficulty = result ? result.config.difficulty : config.difficulty;
  const questions = result ? result.questions : exam!.questions;
  const title = result ? result.examTitle : exam!.examTitle;

  const lessons = subject.lessonsByGrade[grade] ?? [];
  const lessonIds = result ? result.config.lessonIds : config.lessonIds;
  const allLessons = result ? result.config.allLessons : config.allLessons;
  const scopeText = allLessons
    ? 'همه فصل‌ها'
    : lessons
        .filter((l) => lessonIds.includes(l.id))
        .map((l) => `درس ${toPersianDigits(l.number)}`)
        .join('، ');

  // Pure hex-only offscreen container so Tailwind v4 oklch/lab colors never affect html2canvas
  const container = document.createElement('div');
  container.setAttribute('dir', 'rtl');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = '"Vazirmatn", Tahoma, sans-serif';
  container.style.padding = '36px 40px';
  container.style.boxSizing = 'border-box';
  container.style.lineHeight = '1.8';

  const resultHeaderHtml = result
    ? `
      <div style="display:flex;gap:12px;margin-bottom:20px;background:#f5f5f5;border:1px solid #d4d4d4;border-radius:6px;padding:12px 16px;font-size:13px;">
        <div><strong>نمره:</strong> ${toPersianDigits(result.scoreOutOf20)} از ۲۰ (${toPersianDigits(result.scorePercent)}٪)</div>
        <div>|</div>
        <div style="color:#047857;"><strong>صحیح:</strong> ${toPersianDigits(result.correctCount)}</div>
        <div>|</div>
        <div style="color:#be123c;"><strong>غلط:</strong> ${toPersianDigits(result.wrongCount)}</div>
        <div>|</div>
        <div><strong>نزده:</strong> ${toPersianDigits(result.unansweredCount)}</div>
        <div>|</div>
        <div><strong>زمان:</strong> ${formatDurationPersian(result.timeSpentSeconds)}</div>
      </div>
    `
    : '';

  const analysisSummaryHtml =
    result && result.analysis
      ? `
      <div style="margin-bottom:22px;border:1px solid #d4d4d4;border-radius:6px;padding:14px 16px;background:#fafafa;font-size:13px;">
        <div style="font-weight:800;margin-bottom:6px;color:#111111;">تحلیل عملکرد آزمونا</div>
        <div style="color:#222222;">${escapeHtml(result.analysis.overallSummary)}</div>
      </div>
    `
      : '';

  const questionsHtml = questions
    .map((q, idx) => {
      const num = idx + 1;
      const picked = result ? result.answers[q.id] : undefined;
      const breakdown = result?.analysis?.wrongBreakdowns.find(
        (b) => b.questionId === q.id || b.questionNumber === num
      );

      const optionsHtml = q.options
        .map((opt, optIdx) => {
          let bg = '#fafafa';
          let border = '#d4d4d4';
          let color = '#111111';
          let suffix = '';

          if (result) {
            if (optIdx === q.correctIndex) {
              bg = '#ecfdf5';
              border = '#059669';
              color = '#064e3b';
              suffix = ' (درست)';
            } else if (optIdx === picked) {
              bg = '#fff1f2';
              border = '#e11d48';
              color = '#881337';
              suffix = ' (انتخاب شما)';
            }
          }

          return `
            <div style="border:1px solid ${border};background:${bg};color:${color};border-radius:6px;padding:7px 10px;font-size:12.5px;">
              <strong>${OPTION_LETTERS[optIdx]})</strong> ${renderExamTextToHtml(opt)}${suffix}
            </div>
          `;
        })
        .join('');

      const explanationHtml =
        result && picked !== q.correctIndex && breakdown
          ? `
            <div style="margin-top:8px;background:#f5f5f5;border-radius:6px;padding:8px 10px;font-size:12px;color:#222222;">
              <div><strong>دلیل خطا:</strong> ${renderExamTextToHtml(breakdown.whyWrongSelected)}</div>
              <div style="margin-top:4px;"><strong>توضیح:</strong> ${renderExamTextToHtml(breakdown.correctConceptExplanation)}</div>
              <div style="margin-top:4px;"><strong>نکته طلایی:</strong> ${renderExamTextToHtml(breakdown.keyTakeaway)}</div>
            </div>
          `
          : '';

      const parsedQuestion = parseStructuredQuestion(q.question);
      const questionStemHtml =
        parsedQuestion.items.length === 0
          ? `<div style="font-size:13.5px;font-weight:700;margin-bottom:8px;color:#111111;">
              ${toPersianDigits(num)}. ${renderExamTextToHtml(q.question)}
            </div>`
          : `
            <div style="margin-bottom:8px;color:#111111;">
              <div style="font-size:13.5px;font-weight:700;margin-bottom:6px;">
                ${toPersianDigits(num)}. ${parsedQuestion.intro ? renderExamTextToHtml(parsedQuestion.intro) : ''}
              </div>
              <div style="background:#f8f8f8;border:1px solid #e3e3e3;border-radius:6px;padding:8px 10px;margin-bottom:6px;">
                ${parsedQuestion.items
                  .map(
                    (item) => `
                    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;font-size:12.5px;font-weight:500;color:#1a1a1a;">
                      <span style="background:#e8e8e8;color:#111111;border-radius:4px;padding:1px 6px;font-size:11.5px;font-weight:800;flex-shrink:0;">${escapeHtml(item.label)}</span>
                      <span>${renderExamTextToHtml(item.text)}</span>
                    </div>
                  `
                  )
                  .join('')}
              </div>
              ${
                parsedQuestion.outro
                  ? `<div style="font-size:13.5px;font-weight:700;margin-top:4px;">${renderExamTextToHtml(parsedQuestion.outro)}</div>`
                  : ''
              }
            </div>
          `;

      return `
        <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e5e5e5;page-break-inside:avoid;">
          ${questionStemHtml}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${optionsHtml}
          </div>
          ${explanationHtml}
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111111;padding-bottom:12px;margin-bottom:18px;">
      <div>
        <div style="font-size:18px;font-weight:800;color:#111111;">${escapeHtml(title)}</div>
        <div style="font-size:12px;color:#555555;margin-top:4px;">
          آزمونا (Azmona) · ${getGradeLabel(grade)} · ${subject.name} · ${scopeText} · سطح ${getDifficultyLabel(difficulty)}
        </div>
      </div>
      <div style="font-size:12px;font-weight:700;color:#111111;">
        ${toPersianDigits(questions.length)} سؤال
      </div>
    </div>
    ${resultHeaderHtml}
    ${analysisSummaryHtml}
    <div>${questionsHtml}</div>
  `;

  document.body.appendChild(container);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName = result ? `Azmona-Karnameh-${Date.now()}.pdf` : `Azmona-Exam-${Date.now()}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
