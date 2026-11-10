/* Shared study maths for the marker (mark.js) and the dashboard (dashboard.js):
   topic mastery from marked answers and quick-recall results, flashcard scheduling, exam countdowns. */
(function () {
  'use strict';
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function mid(r) { return r && r.mark_low != null ? (r.mark_low + r.mark_high) / 2 : null; }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); }

  // Which topic an attempt belongs to: its own topic_pos, or its question's.
  function topicOf(a, qById) { return a.topic_pos != null ? a.topic_pos : (a.question_id && qById[a.question_id] ? qById[a.question_id].topic_pos : null); }

  /* Mastery of one topic, 0-100.
     - Quick recall (Foundation): share of the topic's recall questions whose latest answer was "Got it".
     - Marked answers: the best of the last 5 in the topic, 40 marks = 0 and 70 = full. Exam-style answers count up to 85%;
       reaching 100% needs a First on a First-class stretch question.
     - Recall is a quarter of the score once there are marked answers; on its own it can reach 30%.
     - Fades by 15% if the topic hasn't been touched for 4 weeks. */
  function topicMastery(pos, d) {
    var qs = d.questions || [], qById = d.qById || index(qs);
    var fq = qs.filter(function (q) { return q.tier === 'foundation' && q.topic_pos === pos; });
    var latest = {}, last = 0;
    (d.recalls || []).forEach(function (r) {
      if (r.topic_pos !== pos && !(r.question_id && qById[r.question_id] && qById[r.question_id].topic_pos === pos)) return;
      var t = Date.parse(r.created_at) || 0;
      if (!latest[r.question_id] || latest[r.question_id].t < t) latest[r.question_id] = { t: t, got: r.got };
      last = Math.max(last, t);
    });
    var recallDone = fq.filter(function (q) { return latest[q.id]; }).length;
    var recall = fq.length && recallDone ? fq.filter(function (q) { return latest[q.id] && latest[q.id].got; }).length / fq.length : null;
    var atts = (d.attempts || []).filter(function (a) { return topicOf(a, qById) === pos && mid(a.result) != null; })
      .sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
    var marked = null, best = null;
    atts.slice(0, 5).forEach(function (a) {
      var m = mid(a.result), sc = clamp((m - 40) / 30, 0, 1);
      if (a.tier !== 'first') sc = Math.min(sc, 0.85);
      if (marked == null || sc > marked) marked = sc;
      if (best == null || m > best) best = m;
    });
    if (atts[0]) last = Math.max(last, Date.parse(atts[0].created_at) || 0);
    if (marked == null && recall == null) return { pct: 0, started: false, marked: 0, recallDone: recallDone, recallTotal: fq.length, best: null };
    var m = marked == null ? 0.3 * recall : recall == null ? marked : 0.25 * recall + 0.75 * marked;
    if (last && Date.now() - last > 28 * 864e5) m *= 0.85;
    return { pct: Math.round(m * 100), started: true, marked: atts.length, recallDone: recallDone, recallTotal: fq.length, best: best, last: last };
  }
  function index(qs) { var o = {}; (qs || []).forEach(function (q) { o[q.id] = q; }); return o; }
  function moduleMastery(topics, d) {
    if (!topics || !topics.length) return null;
    d.qById = d.qById || index(d.questions);
    var per = topics.map(function (t) { return topicMastery(t.position, d); });
    return { pct: Math.round(per.reduce(function (s, x) { return s + x.pct; }, 0) / per.length), started: per.filter(function (x) { return x.started; }).length, total: per.length, per: per };
  }

  // Flashcard scheduling (a light SM-2): again = tomorrow, good = 1, 3, then interval x ease, easy = a longer jump.
  function schedule(card, grade) {
    var c = { interval_days: card.interval_days || 0, ease: card.ease || 2.5, reps: card.reps || 0 };
    if (grade === 'again') { c.reps = 0; c.interval_days = 1; c.ease = Math.max(1.3, c.ease - 0.2); }
    else if (grade === 'good') { c.interval_days = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(Math.max(1, c.interval_days) * c.ease); c.reps++; }
    else { c.interval_days = c.reps === 0 ? 3 : Math.round(Math.max(1, c.interval_days) * c.ease * 1.3) + 1; c.ease = Math.min(3.2, c.ease + 0.15); c.reps++; }
    c.interval_days = Math.min(c.interval_days, 120);
    c.due = addDays(c.interval_days);
    return c;
  }

  function daysUntil(date) {
    if (!date) return null;
    var p = String(date).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 864e5);
  }
  function countdown(date) {
    var n = daysUntil(date);
    if (n == null) return '';
    return n < 0 ? 'Exam done' : n === 0 ? 'Exam today' : n === 1 ? 'Exam tomorrow' : n + ' days to go';
  }
  var RAG = { r: 'Not confident', a: 'Getting there', g: 'Confident' };

  window.UnizyStudy = { topicMastery: topicMastery, moduleMastery: moduleMastery, index: index, topicOf: topicOf, schedule: schedule, daysUntil: daysUntil, countdown: countdown, today: todayStr, mid: mid, RAG: RAG };
})();
